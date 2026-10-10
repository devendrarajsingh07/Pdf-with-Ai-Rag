"""Redis-backed provider budgets, encrypted caches and safe request context."""
import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timezone
from loguru import logger
from contextvars import ContextVar

import redis
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.core.config import settings

user_context = ContextVar('user_id', default='internal')
request_context = ContextVar('request_id', default='internal')
generation_model = ContextVar('generation_model', default=None)

class ProviderLimited(RuntimeError):
    pass

RESERVE = """
local rpm = tonumber(redis.call('GET', KEYS[1]) or '0')
local tpm = tonumber(redis.call('GET', KEYS[2]) or '0')
local project = tonumber(redis.call('GET', KEYS[3]) or '0')
if rpm >= tonumber(ARGV[1]) or tpm + tonumber(ARGV[3]) > tonumber(ARGV[2]) or project >= tonumber(ARGV[4]) then return 0 end
redis.call('INCR', KEYS[1]); redis.call('INCRBY', KEYS[2], ARGV[3]); redis.call('INCR', KEYS[3])
for i=1,3 do if redis.call('TTL', KEYS[i]) < 0 then redis.call('EXPIRE', KEYS[i], 60) end end
return 1
"""

class ProviderControl:
    def __init__(self):
        self._redis = None

    @property
    def client(self):
        if self._redis is None:
            self._redis = redis.Redis.from_url(settings.redis_url, socket_timeout=3,
                                               socket_connect_timeout=3, decode_responses=False)
        return self._redis

    def fingerprint(self, value: str):
        return hmac.new(settings.ml_service_token.encode(), value.encode(), hashlib.sha256).hexdigest()

    def audit(self, stage: str, model: str, **metadata):
        logger.info(json.dumps({'at': datetime.now(timezone.utc).isoformat(),
            'requestId': request_context.get(), 'userIdHash': self.fingerprint(user_context.get()),
            'stage': stage, 'model': model, **metadata}, sort_keys=True))

    def cache_key(self, model: str, data: object):
        # User-scoped caches never return another user's document text.
        return 'rag:cache:' + self.fingerprint(json.dumps([user_context.get(), model, data], sort_keys=True))

    def get(self, key: str):
        if not settings.redis_url:
            return None
        try:
            raw = self.client.get(key)
            if raw is None:
                return None
            decoded = AESGCM(base64.b64decode(settings.data_encryption_key, validate=True)).decrypt(raw[:12], raw[12:], key.encode())
            return json.loads(decoded)
        except Exception as error:
            raise ProviderLimited('Provider coordination unavailable') from error

    def put(self, key: str, value: object, ttl: int = 300):
        if not settings.redis_url:
            return
        iv = os.urandom(12)
        encrypted = AESGCM(base64.b64decode(settings.data_encryption_key, validate=True)).encrypt(iv, json.dumps(value).encode(), key.encode())
        try:
            self.client.setex(key, ttl, iv + encrypted)
        except redis.RedisError as error:
            # Losing a cache write must not lose a completed inference result.
            # The authoritative worker commit is in PostgreSQL.
            from loguru import logger
            logger.warning('Encrypted provider cache write unavailable')

    def reserve(self, model: str, estimated_tokens: int):
        if not settings.redis_url:
            return
        name = self.fingerprint(model)
        try:
            allowed = self.client.eval(RESERVE, 3, f'rag:gemini:rpm:{name}',
                f'rag:gemini:tpm:{name}', 'rag:gemini:project:rpm',
                settings.gemini_requests_per_minute, settings.gemini_tokens_per_minute,
                max(1, estimated_tokens), settings.gemini_project_requests_per_minute)
            if not allowed:
                self.audit('provider-budget-rejected', model)
                raise ProviderLimited('Provider rate budget reached')
            self.audit('provider-budget-reserved', model, estimatedTokens=max(1, estimated_tokens))
        except redis.RedisError as error:
            raise ProviderLimited('Provider coordination unavailable') from error

    def checkpoint(self, stage: str, data: object):
        if settings.redis_url:
            key = 'rag:checkpoint:' + self.fingerprint(user_context.get() + ':' + request_context.get() + ':' + stage)
            self.put(key, {'stage': stage, 'requestId': request_context.get(), 'data': data}, 86400)

    def completion(self, user_id: str, request_id: str, document_id: str):
        if not settings.redis_url:
            return None
        key = 'rag:checkpoint:' + self.fingerprint(user_id + ':' + request_id + ':complete')
        checkpoint = self.get(key)
        data = checkpoint.get('data') if checkpoint else None
        return data if data and data.get('document_id') == document_id else None

provider_control = ProviderControl()

import base64
from types import SimpleNamespace
from unittest.mock import Mock, patch
import fakeredis
import pytest
from app.core.config import settings
from app.core.provider_control import ProviderControl, ProviderLimited, user_context
from app.services.llm_service import LLMService, GenerationUnavailable


@pytest.fixture
def control(monkeypatch):
    monkeypatch.setattr(settings, 'redis_url', 'redis://localhost:6379')
    monkeypatch.setattr(settings, 'data_encryption_key', base64.b64encode(b'k' * 32).decode())
    monkeypatch.setattr(settings, 'gemini_requests_per_minute', 2)
    monkeypatch.setattr(settings, 'gemini_project_requests_per_minute', 10)
    service = ProviderControl()
    service._redis = fakeredis.FakeRedis()
    return service


def test_cache_encrypted_and_user_scoped(control):
    token = user_context.set('user-one')
    try:
        key = control.cache_key('model', {'text': 'private text'})
        control.put(key, 'secret ticket text')
        assert b'secret ticket text' not in control.client.get(key)
        assert control.get(key) == 'secret ticket text'
        user_context.set('user-two')
        assert control.cache_key('model', {'text': 'private text'}) != key
    finally:
        user_context.reset(token)


def test_atomic_provider_limits(control):
    control.reserve('model', 100)
    control.reserve('model', 100)
    with pytest.raises(ProviderLimited):
        control.reserve('model', 100)
    control.reserve('fallback', 100)


def test_project_budget_cannot_be_bypassed_with_fallback(control, monkeypatch):
    monkeypatch.setattr(settings, 'gemini_project_requests_per_minute', 1)
    control.reserve('primary', 100)
    with pytest.raises(ProviderLimited):
        control.reserve('fallback', 100)


def test_generation_fallback_only_transient(monkeypatch):
    monkeypatch.setattr(settings, 'llm_model', 'primary')
    monkeypatch.setattr(settings, 'llm_fallback_models', 'fallback')
    client = Mock()
    error = RuntimeError('provider limited')
    error.code = 429
    client.models.generate_content.side_effect = [error, SimpleNamespace(text='Answer')]
    service = LLMService()
    with patch.object(service, '_get_client', return_value=client), patch('app.services.llm_service.time.sleep'):
        assert service.generate('question', 'context') == 'Answer'
    assert [call.kwargs['model'] for call in client.models.generate_content.call_args_list] == ['primary', 'fallback']


def test_invalid_credential_does_not_fallback(monkeypatch):
    monkeypatch.setattr(settings, 'llm_fallback_models', 'fallback')
    client = Mock()
    error = RuntimeError('invalid credential')
    error.code = 401
    client.models.generate_content.side_effect = error
    with patch.object(LLMService, '_get_client', return_value=client):
        with pytest.raises(GenerationUnavailable):
            LLMService().generate('question', 'context')
    assert client.models.generate_content.call_count == 1

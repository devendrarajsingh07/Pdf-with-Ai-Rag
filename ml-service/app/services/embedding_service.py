from google import genai
from google.genai import types
from app.core.config import settings
from loguru import logger
import time
import math
from app.core.provider_control import provider_control, ProviderLimited

class EmbeddingService:
    def __init__(self):
        self._client = None

    def _get_client(self):
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        if self._client is None:
            self._client = genai.Client(api_key=settings.gemini_api_key,
                http_options=types.HttpOptions(timeout=90000, retry_options=types.HttpRetryOptions(attempts=1)))
        return self._client
    
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed texts through Gemini's batch-capable embedding call."""
        embeddings = []
        batch_size = 100  # Gemini batch limit
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_embeddings = self._embed_batch_with_retry(batch)
            embeddings.extend(batch_embeddings)
            
            if i + batch_size < len(texts):
                time.sleep(0.1)  # Rate limiting
        
        return embeddings
    
    def embed_query(self, query: str) -> list[float]:
        """Embed a single query."""
        return self._embed_batch_with_retry([query], task='retrieval_query')[0]
    
    def _embed_batch_with_retry(self, texts: list[str], task: str = 'retrieval_document') -> list[list[float]]:
        key = provider_control.cache_key(settings.embedding_model, {'texts': texts, 'task': task, 'dimension': settings.embedding_dimension})
        cached = provider_control.get(key)
        if cached is not None:
            return cached
        last_error = None
        for attempt in range(1, 4):
            try:
                contents = [
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=f"task: {task} | {'query' if task == 'retrieval_query' else 'content'}: {text}")],
                    )
                    for text in texts
                ]
                provider_control.reserve(settings.embedding_model, sum(len(text) for text in texts) // 3)
                result = self._get_client().models.embed_content(
                    model=settings.embedding_model,
                    contents=contents,
                    config=types.EmbedContentConfig(
                        output_dimensionality=settings.embedding_dimension
                    ),
                )
                embeddings = [list(item.values) for item in (result.embeddings or [])]
                if len(embeddings) != len(texts):
                    raise RuntimeError(
                        f"Embedding API returned {len(embeddings)} vectors for {len(texts)} texts"
                    )
                if any(len(vector) != settings.embedding_dimension or not all(math.isfinite(value) for value in vector) for vector in embeddings):
                    raise RuntimeError('Embedding API returned invalid vector dimensions or values')
                provider_control.put(key, embeddings, ttl=3600)
                return embeddings
            except Exception as e:
                last_error = e
                logger.warning('Embedding attempt failed: attempt={}, code={}', attempt, getattr(e, 'code', type(e).__name__))
                if isinstance(e, ProviderLimited):
                    raise
                if attempt < 3:
                    time.sleep(2 ** (attempt - 1))

        raise RuntimeError("Embedding failed after 3 attempts") from last_error

embedding_service = EmbeddingService()

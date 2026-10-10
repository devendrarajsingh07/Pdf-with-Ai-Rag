import pytest
from app.core.config import settings

@pytest.fixture(autouse=True)
def setup_test_env(monkeypatch):
    # Override settings for tests if needed
    monkeypatch.setattr(settings, 'ml_service_token', 'test-service-token-with-at-least-32-characters')
    monkeypatch.setattr(settings, 'qdrant_url', 'http://localhost:6333')
    monkeypatch.setattr(settings, 'qdrant_collection', 'test_collection')
    monkeypatch.setattr(settings, 'reranker_enabled', False)
    monkeypatch.setattr(settings, 'redis_url', '')
    # Unit tests must never download neural weights implicitly.
    monkeypatch.setattr(settings, 'ocr_backend', 'tesseract')

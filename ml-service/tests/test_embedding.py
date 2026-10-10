from types import SimpleNamespace
from unittest.mock import MagicMock
import pytest
from app.core.config import settings
from app.services.embedding_service import EmbeddingService


def result(count):
    return SimpleNamespace(embeddings=[SimpleNamespace(values=[0.1] * settings.embedding_dimension) for _ in range(count)])


def service_with_client(monkeypatch):
    service = EmbeddingService()
    client = MagicMock()
    monkeypatch.setattr(service, '_get_client', lambda: client)
    monkeypatch.setattr('app.services.embedding_service.time.sleep', lambda seconds: None)
    return service, client


def test_batch_returns_one_valid_vector_per_input(monkeypatch):
    service, client = service_with_client(monkeypatch)
    client.models.embed_content.return_value = result(2)
    assert len(service.embed_texts(['first text', 'second text'])) == 2
    assert client.models.embed_content.call_count == 1
    assert len(client.models.embed_content.call_args.kwargs['contents']) == 2


def test_query_retries_transient_failure(monkeypatch):
    service, client = service_with_client(monkeypatch)
    client.models.embed_content.side_effect = [RuntimeError('temporary unavailable'), result(1)]
    assert len(service.embed_query('question')) == settings.embedding_dimension
    assert client.models.embed_content.call_count == 2


def test_invalid_vectors_fail_instead_of_becoming_indexable(monkeypatch):
    service, client = service_with_client(monkeypatch)
    client.models.embed_content.return_value = SimpleNamespace(embeddings=[SimpleNamespace(values=[float('nan')])])
    with pytest.raises(RuntimeError, match='after 3 attempts'):
        service.embed_texts(['first text'])
    assert client.models.embed_content.call_count == 3

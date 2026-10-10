import pytest
from unittest.mock import patch, MagicMock
from app.rag.pipeline import RAGPipeline
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.retrieval import RetrievalResult

@pytest.fixture
def mock_retrieval_service():
    with patch('app.rag.pipeline.retrieval_service') as mock:
        yield mock

@pytest.fixture
def mock_reranking_service():
    with patch('app.rag.pipeline.reranking_service') as mock:
        yield mock

@pytest.fixture
def mock_llm_service():
    with patch('app.rag.pipeline.llm_service') as mock:
        yield mock

def test_rag_pipeline_empty_retrieval(mock_retrieval_service):
    pipeline = RAGPipeline()
    req = ChatRequest(user_id="1", conversation_id="1", question="test")
    
    mock_retrieval_service.retrieve.return_value = []
    
    response = pipeline.run(req)
    assert "not contain enough information" in response.answer
    assert len(response.citations) == 0

def test_rag_pipeline_success(mock_retrieval_service, mock_reranking_service, mock_llm_service):
    pipeline = RAGPipeline()
    req = ChatRequest(user_id="1", conversation_id="1", question="What is AI?")
    
    mock_result = RetrievalResult(
        chunk_id="c1", document_id="d1", document_name="doc.pdf", page_number=1, text="AI is artificial intelligence.", score=0.9
    )
    
    mock_retrieval_service.retrieve.return_value = [mock_result]
    mock_reranking_service.rerank.return_value = [mock_result]
    mock_llm_service.generate.return_value = "AI is artificial intelligence. [Source 1]"
    
    response = pipeline.run(req)
    assert response.answer == "AI is artificial intelligence. [Source 1]"
    assert len(response.citations) > 0
    assert response.retrieved_chunks == 1

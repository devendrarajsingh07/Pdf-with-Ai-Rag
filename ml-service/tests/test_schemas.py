import pytest
from pydantic import ValidationError
from app.schemas.document import DocumentProcessRequest
from app.schemas.retrieval import RetrievalRequest
from app.schemas.chat import ChatRequest

def test_document_process_request_valid():
    req = DocumentProcessRequest(document_id="123", user_id="456", file_path="/tmp/test.pdf")
    assert req.document_id == "123"
    assert req.user_id == "456"
    assert req.file_path == "/tmp/test.pdf"

def test_document_process_request_invalid():
    with pytest.raises(ValidationError):
        DocumentProcessRequest(document_id="123", user_id="456") # Missing file_path

def test_retrieval_request_valid():
    req = RetrievalRequest(user_id="456", query="test query", top_k=10)
    assert req.user_id == "456"
    assert req.query == "test query"
    assert req.top_k == 10

def test_retrieval_request_invalid_top_k():
    with pytest.raises(ValidationError):
        RetrievalRequest(user_id="456", query="test query", top_k=100) # Exceeds max 20

def test_chat_request_valid():
    req = ChatRequest(user_id="456", conversation_id="789", question="How are you?")
    assert req.question == "How are you?"

def test_chat_request_invalid():
    with pytest.raises(ValidationError):
        ChatRequest(user_id="456", conversation_id="789", question="") # Min length 1

import pytest
from app.services.chunking_service import ChunkingService
from app.core.config import settings

def test_chunk_document_basic():
    service = ChunkingService(chunk_size=10, chunk_overlap=2)
    pages = [
        {'page_number': 1, 'text': 'This is a test document with some text.', 'has_text': True, 'extraction_method': 'test'}
    ]
    chunks = service.chunk_document(pages, document_id="doc1", user_id="user1", source_filename="test.pdf")
    
    assert len(chunks) > 0
    assert chunks[0]['document_id'] == "doc1"
    assert chunks[0]['user_id'] == "user1"
    assert chunks[0]['source_filename'] == "test.pdf"
    assert chunks[0]['page_number'] == 1
    assert 'chunk_id' in chunks[0]

def test_chunk_document_empty():
    service = ChunkingService()
    pages = [{'page_number': 1, 'text': '', 'has_text': False, 'extraction_method': 'test'}]
    chunks = service.chunk_document(pages, document_id="doc1", user_id="user1", source_filename="test.pdf")
    assert len(chunks) == 0

def test_split_text_without_separators_always_advances():
    service = ChunkingService(chunk_size=10, chunk_overlap=4)
    chunks = service._split_text("x" * 35)
    assert "".join(chunk if i == 0 else chunk[4:] for i, chunk in enumerate(chunks)) == "x" * 35
    assert all(chunks)

def test_split_text_separator_inside_overlap_always_advances():
    service = ChunkingService(chunk_size=10, chunk_overlap=8)
    text = "abcdefgh. ijklmnopqrstuvwxyz"
    chunks = service._split_text(text)
    assert len(chunks) < len(text)
    assert chunks[-1].endswith("z")

def test_zero_overlap_is_honored():
    service = ChunkingService(chunk_size=10, chunk_overlap=0)
    text = 'abcdefghijklmnopqrstuvwxyz'
    assert ''.join(service._split_text(text)) == text

@pytest.mark.parametrize('size,overlap', [(0, 0), (10, 10), (10, -1)])
def test_invalid_chunk_parameters_are_rejected(size, overlap):
    with pytest.raises(ValueError):
        ChunkingService(chunk_size=size, chunk_overlap=overlap)

import pytest
import os
from pathlib import Path
from app.services.extraction_service import ExtractionService

@pytest.fixture
def dummy_pdf_path(tmp_path):
    # Create a dummy text file to act as PDF for basic mock testing
    # Since fitz requires real PDFs, we will mock the behavior if needed, 
    # but for a simple unit test, we can just test the error handling.
    path = tmp_path / "dummy.pdf"
    path.write_text("Dummy content")
    return str(path)

def test_extraction_service_file_not_found():
    service = ExtractionService()
    with pytest.raises(FileNotFoundError):
        service.extract("non_existent_file.pdf")

# To test actual extraction, we would need a real PDF file.
# In a real setup, we'd include a small sample PDF in the tests folder.

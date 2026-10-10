from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class DocumentProcessRequest(BaseModel):
    document_id: str
    user_id: str
    file_path: str
    document_name: Optional[str] = None

class ChunkMetadata(BaseModel):
    document_id: str
    user_id: str
    page_number: int
    chunk_index: int
    chunk_id: str
    source_filename: str
    section: Optional[str] = None
    text: str
    char_count: int

class DocumentProcessResponse(BaseModel):
    document_id: str
    status: str
    chunks_created: int
    pages_processed: int
    message: str
    analysis: Optional[dict] = None

class DocumentDeleteRequest(BaseModel):
    document_id: str

class DocumentDeleteResponse(BaseModel):
    document_id: str
    deleted_chunks: int
    message: str

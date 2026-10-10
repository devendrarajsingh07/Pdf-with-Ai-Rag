from pydantic import BaseModel, Field
from typing import Optional

class RetrievalRequest(BaseModel):
    user_id: str
    query: str = Field(min_length=1, max_length=8000)
    document_ids: list[str] = Field(default_factory=list, max_length=20)
    top_k: int = Field(default=5, ge=1, le=20)

class RetrievalResult(BaseModel):
    chunk_id: str
    document_id: str
    document_name: str
    page_number: int
    text: str
    score: float
    rerank_score: Optional[float] = None

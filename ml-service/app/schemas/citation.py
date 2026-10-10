from pydantic import BaseModel
from typing import Optional

class Citation(BaseModel):
    document_id: str
    document_name: str
    page_number: int
    chunk_id: str
    excerpt: str
    relevance_score: Optional[float] = None

from pydantic import BaseModel, Field
from typing import Optional
from .citation import Citation

class ChatRequest(BaseModel):
    user_id: str
    conversation_id: str
    question: str = Field(min_length=1, max_length=8000)
    document_ids: list[str] = Field(default_factory=list, max_length=20)
    conversation_history: list[dict] = Field(default_factory=list, max_length=4)

class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    retrieved_chunks: int
    model_used: str

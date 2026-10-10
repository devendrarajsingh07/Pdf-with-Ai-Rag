from fastapi import APIRouter, Depends, HTTPException
from app.schemas.chat import ChatRequest, ChatResponse
from app.rag.pipeline import rag_pipeline
from app.core.auth import verify_token
from loguru import logger
from app.services.llm_service import GenerationUnavailable

router = APIRouter(prefix="/chat", tags=["chat"])

@router.post("", response_model=ChatResponse)
def chat(request: ChatRequest, _=Depends(verify_token)):
    try:
        return rag_pipeline.run(request)
    except GenerationUnavailable:
        raise HTTPException(status_code=503, detail={"code": "GENERATION_UNAVAILABLE", "message": "Answer generation is temporarily unavailable. Please try again shortly."})
    except Exception as e:
        logger.error(f"Chat RAG failed: {e}")
        raise HTTPException(status_code=500, detail={"code": "CHAT_FAILED", "message": "Chat processing failed"})

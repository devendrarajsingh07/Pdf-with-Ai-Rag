from fastapi import APIRouter, Depends
from app.schemas.retrieval import RetrievalRequest, RetrievalResult
from app.services.retrieval_service import retrieval_service
from app.services.reranking_service import reranking_service
from app.core.auth import verify_token

router = APIRouter(prefix="/retrieve", tags=["retrieval"])

@router.post("", response_model=list[RetrievalResult])
def retrieve(request: RetrievalRequest, _=Depends(verify_token)):
    results = retrieval_service.retrieve(request)
    reranked = reranking_service.rerank(request.query, results)
    return reranked

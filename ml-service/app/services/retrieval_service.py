from app.vector.qdrant_client import qdrant_service
from app.services.embedding_service import embedding_service
from app.schemas.retrieval import RetrievalRequest, RetrievalResult
from app.core.config import settings
from loguru import logger
from app.services.document_analysis import expand_query

class RetrievalService:
    def retrieve(self, request: RetrievalRequest) -> list[RetrievalResult]:
        query_vector = embedding_service.embed_query(expand_query(request.query))
        
        results = qdrant_service.search(
            query_vector=query_vector,
            user_id=request.user_id,
            document_ids=request.document_ids,
            top_k=request.top_k
        )
        
        retrieval_results = []
        for r in results:
            retrieval_results.append(RetrievalResult(
                chunk_id=r.get('chunk_id', ''),
                document_id=r.get('document_id', ''),
                document_name=r.get('source_filename', ''),
                page_number=r.get('page_number', 0),
                text=r.get('text', ''),
                score=r.get('score', 0.0)
            ))
        
        logger.info(f"Retrieved {len(retrieval_results)} chunks for query")
        return retrieval_results

retrieval_service = RetrievalService()

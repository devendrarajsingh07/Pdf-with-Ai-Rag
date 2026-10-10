from sentence_transformers import CrossEncoder
from app.core.config import settings
from app.schemas.retrieval import RetrievalResult
from loguru import logger
from typing import Optional

class RerankingService:
    _model: Optional[CrossEncoder] = None
    
    def _get_model(self) -> CrossEncoder:
        if self._model is None:
            logger.info(f"Loading reranker model: {settings.reranker_model}")
            self._model = CrossEncoder(settings.reranker_model, trust_remote_code=False)
        return self._model
    
    def rerank(
        self,
        query: str,
        results: list[RetrievalResult],
        top_n: int = None
    ) -> list[RetrievalResult]:
        if not settings.reranker_enabled or not results:
            return results[:top_n] if top_n else results
        
        try:
            model = self._get_model()
            pairs = [[query, r.text] for r in results]
            scores = model.predict(pairs)
            
            for result, score in zip(results, scores):
                result.rerank_score = float(score)
            
            reranked = sorted(results, key=lambda x: x.rerank_score or 0, reverse=True)
            return reranked[:top_n] if top_n else reranked
        except Exception as e:
            logger.warning(f"Reranking failed, using original order: {e}")
            return results[:top_n] if top_n else results

reranking_service = RerankingService()

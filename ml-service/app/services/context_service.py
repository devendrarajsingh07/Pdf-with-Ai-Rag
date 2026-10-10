from app.schemas.retrieval import RetrievalResult
from loguru import logger

class ContextService:
    MAX_CONTEXT_CHARS = 12000
    
    def build_context(self, results: list[RetrievalResult]) -> str:
        """Build context string from retrieved chunks."""
        if not results:
            return ""
        
        context_parts = []
        total_chars = 0
        
        for i, result in enumerate(results, 1):
            entry = f"[Source {i}] {result.document_name}, Page {result.page_number}:\n{result.text}"
            
            if total_chars + len(entry) > self.MAX_CONTEXT_CHARS:
                logger.info(f"Context limit reached after {i-1} chunks")
                break
            
            context_parts.append(entry)
            total_chars += len(entry)
        
        return "\n\n---\n\n".join(context_parts)

context_service = ContextService()

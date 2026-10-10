from app.schemas.citation import Citation
from app.schemas.retrieval import RetrievalResult
import re

class CitationService:
    def extract_citations(self, answer: str, results: list[RetrievalResult]) -> list[Citation]:
        """Extract citations from [Source N] references in answer."""
        refusal = "The uploaded documents do not contain enough information to answer this question reliably."
        if answer.strip() == refusal:
            return []

        cited_indices = set(re.findall(r'\[Source (\d+)\]', answer))
        
        citations = []
        for idx_str in cited_indices:
            idx = int(idx_str) - 1
            if 0 <= idx < len(results):
                result = results[idx]
                citations.append(Citation(
                    document_id=result.document_id,
                    document_name=result.document_name,
                    page_number=result.page_number,
                    chunk_id=result.chunk_id,
                    excerpt=result.text[:300] + ('...' if len(result.text) > 300 else ''),
                    relevance_score=result.rerank_score or result.score
                ))
        
        # If no [Source N] found but we have results, cite top ones
        if not citations and results:
            for result in results[:3]:
                citations.append(Citation(
                    document_id=result.document_id,
                    document_name=result.document_name,
                    page_number=result.page_number,
                    chunk_id=result.chunk_id,
                    excerpt=result.text[:300] + ('...' if len(result.text) > 300 else ''),
                    relevance_score=result.rerank_score or result.score
                ))
        
        # Sort by page number
        citations.sort(key=lambda c: (c.document_name, c.page_number))
        return citations

citation_service = CitationService()

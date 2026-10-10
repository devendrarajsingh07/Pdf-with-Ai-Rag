from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.retrieval import RetrievalRequest
from app.services.retrieval_service import retrieval_service
from app.services.reranking_service import reranking_service
from app.services.context_service import context_service
from app.services.llm_service import llm_service
from app.services.citation_service import citation_service
from app.core.config import settings
from loguru import logger
import re
from app.services.document_analysis import PNR, DATE
from app.vector.qdrant_client import qdrant_service
from app.schemas.citation import Citation
from app.core.provider_control import generation_model, provider_control, request_context

class RAGPipeline:
    def run(self, request: ChatRequest) -> ChatResponse:
        logger.info('RAG request: requestId={}, userIdHash={}', request_context.get(), provider_control.fingerprint(request.user_id))
        # Exact, short PNR requests are an identifier lookup, not live railway status.
        if re.fullmatch(r'\s*(?:(?:check|show|find|my|what is|give)\s+)?pnr(?:\s+(?:details|number|status))?\s*[?.!]*', request.question, re.I):
            chunks = qdrant_service.document_chunks(request.user_id, request.document_ids)
            answers, citations, seen = [], [], set()
            for chunk in chunks:
                match = PNR.search(chunk.get('text', ''))
                if not match:
                    continue
                number = re.sub(r'\D', '', match.group(1))
                key = (chunk['document_id'], number)
                if key in seen:
                    continue
                seen.add(key)
                source = len(citations) + 1
                dates = ', '.join(dict.fromkeys(m.group() for m in DATE.finditer(chunk['text'])))
                answers.append(f"PNR: {number}" + (f". Dates in this passage: {dates}" if dates else '') + f". [Source {source}]")
                citations.append(Citation(document_id=chunk['document_id'],
                    document_name=chunk.get('source_filename', ''), page_number=chunk['page_number'],
                    chunk_id=chunk['chunk_id'], excerpt=chunk['text'][:700], relevance_score=None))
            if answers:
                return ChatResponse(answer='\n\n'.join(answers) + '\n\nThese are details extracted from the uploaded PDF, not a live PNR status check. Verify OCR-read numbers against the ticket.',
                                    citations=citations, retrieved_chunks=len(chunks), model_used='local-pnr-extraction')
        
        # 1. Retrieve
        retrieval_request = RetrievalRequest(
            user_id=request.user_id,
            query=request.question,
            document_ids=request.document_ids,
            top_k=settings.retrieval_top_k
        )
        results = retrieval_service.retrieve(retrieval_request)
        
        if not results:
            return ChatResponse(
                answer="The uploaded documents do not contain enough information to answer this question reliably.",
                citations=[],
                retrieved_chunks=0,
                model_used=settings.llm_model
            )
        
        # 2. Rerank
        reranked = reranking_service.rerank(
            query=request.question,
            results=results,
            top_n=settings.retrieval_top_n
        )
        
        # 3. Build context
        context = context_service.build_context(reranked)
        
        # 4. Generate
        answer = llm_service.generate(
            question=request.question,
            context=context,
            conversation_history=request.conversation_history
        )
        
        # 5. Extract citations
        citations = citation_service.extract_citations(answer, reranked)
        
        return ChatResponse(
            answer=answer,
            citations=citations,
            retrieved_chunks=len(results),
            model_used=generation_model.get() or settings.llm_model
        )

rag_pipeline = RAGPipeline()

from app.services.extraction_service import extraction_service
from app.services.chunking_service import chunking_service
from app.services.embedding_service import embedding_service
from app.vector.qdrant_client import qdrant_service
from app.schemas.document import DocumentProcessRequest, DocumentProcessResponse
from pathlib import Path
from loguru import logger
from app.core.config import settings
from app.services.document_analysis import analyze_document
from app.core.provider_control import provider_control

class PDFService:
    def process_document(self, request: DocumentProcessRequest) -> DocumentProcessResponse:
        logger.info(f"Processing document {request.document_id}")
        upload_root = Path(settings.upload_dir).resolve()
        file_path = Path(request.file_path).resolve()
        if not file_path.is_relative_to(upload_root):
            raise PermissionError("PDF path is outside the configured upload directory")
        file_path = file_path.resolve(strict=True)
        
        # Extract
        extracted = extraction_service.extract(str(file_path))
        pages = extracted['pages']
        total_pages = extracted['total_pages']
        analysis = analyze_document(pages)
        provider_control.checkpoint('extracted', {'pages': pages, 'analysis': analysis})
        
        source_filename = request.document_name or file_path.name
        
        # Chunk
        chunks = chunking_service.chunk_document(
            pages=pages,
            document_id=request.document_id,
            user_id=request.user_id,
            source_filename=source_filename
        )
        
        if not chunks:
            raise ValueError("No text could be extracted from the PDF")
        
        # Embed
        texts = [c['text'] for c in chunks]
        embeddings = embedding_service.embed_texts(texts)
        
        # Ensure collection exists
        qdrant_service.ensure_collection()
        
        # Upsert to Qdrant
        qdrant_service.upsert_chunks(chunks, embeddings)
        provider_control.checkpoint('indexed', {'documentId': request.document_id, 'chunkIds': [chunk['chunk_id'] for chunk in chunks]})
        qdrant_service.delete_stale_document_chunks(
            request.document_id,
            request.user_id,
            [chunk['chunk_id'] for chunk in chunks],
        )
        provider_control.checkpoint('complete', {'document_id': request.document_id,
            'chunks_created': len(chunks), 'pages_processed': total_pages, 'analysis': analysis, 'status': 'ready'})
        
        return DocumentProcessResponse(
            document_id=request.document_id,
            status='ready',
            chunks_created=len(chunks),
            pages_processed=total_pages,
            message=f"Successfully processed {len(chunks)} chunks from {total_pages} pages",
            analysis=analysis,
        )
    
    def delete_document(self, document_id: str, user_id: str) -> int:
        return qdrant_service.delete_document(document_id, user_id)

pdf_service = PDFService()

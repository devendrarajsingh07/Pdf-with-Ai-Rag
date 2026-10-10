from fastapi import APIRouter, HTTPException, Depends
from app.schemas.document import DocumentProcessRequest, DocumentProcessResponse, DocumentDeleteResponse
from app.services.pdf_service import pdf_service
from app.core.auth import verify_token
from app.vector.qdrant_client import qdrant_service
from loguru import logger
from app.core.provider_control import provider_control

router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("/process", response_model=DocumentProcessResponse)
def process_document(request: DocumentProcessRequest, _=Depends(verify_token)):
    try:
        result = pdf_service.process_document(request)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail={"code": "PDF_NOT_FOUND", "message": "PDF file not found"})
    except PermissionError:
        raise HTTPException(status_code=400, detail={"code": "INVALID_PDF_PATH", "message": "Invalid PDF path"})
    except ValueError:
        raise HTTPException(status_code=422, detail={"code": "NO_EXTRACTABLE_TEXT", "message": "PDF contained no extractable text"})
    except Exception as e:
        logger.error(f"Document processing failed: {e}")
        raise HTTPException(status_code=500, detail={"code": "PROCESSING_FAILED", "message": "Document processing failed"})

@router.post("/reindex", response_model=DocumentProcessResponse)
def reindex_document(request: DocumentProcessRequest, _=Depends(verify_token)):
    try:
        result = pdf_service.process_document(request)
        return result
    except PermissionError:
        raise HTTPException(status_code=400, detail={"code": "INVALID_PDF_PATH", "message": "Invalid PDF path"})
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail={"code": "PDF_NOT_FOUND", "message": "PDF file not found"})
    except Exception as e:
        logger.error(f"Reindex failed: {e}")
        raise HTTPException(status_code=500, detail={"code": "REINDEX_FAILED", "message": "Document reindexing failed"})

@router.get("/{document_id}/chunks")
def count_document_chunks(document_id: str, user_id: str, _=Depends(verify_token)):
    return {"document_id": document_id, "chunks": qdrant_service.count_document_chunks(document_id, user_id)}

@router.get('/{document_id}/completion')
def processing_completion(document_id: str, user_id: str, request_id: str, _=Depends(verify_token)):
    result = provider_control.completion(user_id, request_id, document_id)
    return {'completed': result is not None, 'result': result}

@router.delete("/{document_id}", response_model=DocumentDeleteResponse)
def delete_document(document_id: str, user_id: str, _=Depends(verify_token)):
    deleted = pdf_service.delete_document(document_id, user_id)
    return DocumentDeleteResponse(document_id=document_id, deleted_chunks=deleted, message="Deleted")

from fastapi import APIRouter
from app.vector.qdrant_client import qdrant_service
from app.core.config import settings
from loguru import logger
from fastapi.responses import JSONResponse
from app.core.provider_control import provider_control

router = APIRouter(prefix="/health", tags=["health"])

@router.get("")
def health():
    try:
        collections = qdrant_service.client.get_collections()
        qdrant_status = "ok"
    except Exception as e:
        logger.error(f"Qdrant health check failed: {e}")
        qdrant_status = "error"
    
    redis_status = 'disabled'
    if settings.redis_url:
        try:
            provider_control.client.ping()
            redis_status = 'ok'
        except Exception:
            redis_status = 'error'
    ready = qdrant_status == 'ok' and redis_status != 'error'
    return JSONResponse(status_code=200 if ready else 503, content={
        "status": "ok" if ready else "error",
        "qdrant": qdrant_status,
        "redis": redis_status,
        "llm_model": settings.llm_model,
        "embedding_model": settings.embedding_model,
        "ocr_backend": settings.ocr_backend,
        "ocr_device": settings.ocr_device,
        "cgan_checkpoint_configured": bool(settings.cgan_checkpoint)
    })

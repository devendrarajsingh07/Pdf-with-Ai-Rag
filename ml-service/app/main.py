from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import document_routes, retrieval_routes, chat_routes, health_routes
from app.core.logging import setup_logging
from app.vector.qdrant_client import qdrant_service
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from app.core.provider_control import user_context, request_context, generation_model, provider_control
from app.core.config import settings
import uuid

logger = setup_logging()

app = FastAPI(
    title="RAG ML Service",
    description="AI/ML service for PDF document intelligence",
    version="1.0.0"
)

@app.middleware('http')
async def request_metadata(request: Request, call_next):
    user = user_context.set(request.headers.get('x-user-id', 'internal')[:128])
    request_id = request_context.set(request.headers.get('x-request-id', str(uuid.uuid4()))[:128])
    model = generation_model.set(None)
    try:
        return await call_next(request)
    finally:
        user_context.reset(user)
        request_context.reset(request_id)
        generation_model.reset(model)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"]
)

API_PREFIX = "/api/v1/ml"
app.include_router(document_routes.router, prefix=API_PREFIX)
app.include_router(retrieval_routes.router, prefix=API_PREFIX)
app.include_router(chat_routes.router, prefix=API_PREFIX)
app.include_router(health_routes.router, prefix=API_PREFIX)

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, error: Exception):
    logger.error(f"Unhandled ML service error on {request.url.path}: {error}")
    return JSONResponse(
        status_code=500,
        content={"detail": {"code": "INTERNAL_SERVER_ERROR", "message": "Internal server error"}},
    )

@app.on_event("startup")
async def startup():
    logger.info("ML Service starting...")
    await run_in_threadpool(qdrant_service.ensure_collection)
    if settings.redis_url:
        await run_in_threadpool(provider_control.client.ping)
    logger.info("Qdrant collection ready")

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
from pydantic import model_validator
import base64
from typing import Literal

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""
    qdrant_collection: str = "rag_documents_v2"
    
    llm_provider: str = "gemini"
    gemini_api_key: str = ""
    llm_model: str = "gemini-3.8-flash"
    llm_temperature: float = 0.2
    llm_max_output_tokens: int = 2048
    llm_fallback_models: str = 'gemini-3.7-flash,gemini-3.5-flash'
    redis_url: str = ''
    data_encryption_key: str = ''
    gemini_requests_per_minute: int = Field(default=10, ge=1)
    gemini_tokens_per_minute: int = Field(default=100000, ge=1)
    gemini_project_requests_per_minute: int = Field(default=60, ge=1)
    
    embedding_provider: str = "gemini"
    embedding_model: str = "gemini-embedding-2"
    embedding_dimension: int = 768
    
    reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    reranker_enabled: bool = True
    
    ml_service_token: str = Field(min_length=32)
    upload_dir: str = "../backend/uploads"
    
    chunk_size: int = 1000
    chunk_overlap: int = 200
    retrieval_top_k: int = 10
    retrieval_top_n: int = 5
    
    log_level: str = "INFO"

    tesseract_cmd: str = ""
    ocr_backend: Literal['tesseract', 'doctr', 'cgan_doctr'] = 'doctr'
    ocr_device: Literal['cpu', 'cuda'] = 'cpu'
    ocr_torch_threads: int = Field(default=4, ge=1, le=32)
    cgan_repo_dir: str = '../.tools/pytorch-cyclegan-and-pix2pix'
    cgan_checkpoint: str = ''
    cgan_checkpoint_sha256: str = ''
    cgan_net_g: Literal['resnet_9blocks', 'resnet_6blocks', 'unet_128', 'unet_256'] = 'unet_256'
    cgan_norm: Literal['batch', 'instance', 'none'] = 'batch'
    cgan_use_dropout: bool = False
    cgan_channels: Literal[1, 3] = 3
    cgan_ngf: int = Field(default=64, ge=1, le=128)
    cgan_tile_size: Literal[128, 256, 512] = 256
    cgan_tile_overlap: int = Field(default=32, ge=0, le=64)
    cgan_max_tiles: int = Field(default=512, ge=1, le=2048)

    @model_validator(mode='after')
    def validate_cgan(self):
        if self.cgan_tile_overlap >= self.cgan_tile_size:
            raise ValueError('CGAN_TILE_OVERLAP must be smaller than CGAN_TILE_SIZE')
        if self.cgan_net_g == 'unet_256' and self.cgan_tile_size < 256:
            raise ValueError('unet_256 needs tiles of at least 256 pixels')
        if self.cgan_checkpoint_sha256 and (len(self.cgan_checkpoint_sha256) != 64 or
                any(c not in '0123456789abcdefABCDEF' for c in self.cgan_checkpoint_sha256)):
            raise ValueError('CGAN_CHECKPOINT_SHA256 must be a SHA-256 hex digest')
        return self

    @model_validator(mode='after')
    def validate_encryption(self):
        if self.redis_url:
            try:
                key = base64.b64decode(self.data_encryption_key, validate=True)
            except Exception:
                raise ValueError('Redis requires a base64-encoded DATA_ENCRYPTION_KEY')
            if len(key) != 32:
                raise ValueError('Redis requires a separate 32-byte DATA_ENCRYPTION_KEY')
        return self

    @field_validator("llm_model", mode="before")
    @classmethod
    def migrate_legacy_llm_model(cls, value: object) -> object:
        if value == "gemini-1.5-flash":
            return "gemini-3.8-flash"
        return value

    @field_validator("embedding_model", mode="before")
    @classmethod
    def migrate_legacy_embedding_model(cls, value: object) -> object:
        if value in {"text-embedding-004", "models/text-embedding-004"}:
            return "gemini-embedding-2"
        return value

    @field_validator("qdrant_collection", mode="before")
    @classmethod
    def migrate_legacy_collection(cls, value: object) -> object:
        if value == "rag_documents":
            return "rag_documents_v2"
        return value
    
settings = Settings()

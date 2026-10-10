from typing import List
import uuid
from app.core.config import settings
from loguru import logger

class ChunkingService:
    def __init__(self, chunk_size: int = None, chunk_overlap: int = None):
        self.chunk_size = settings.chunk_size if chunk_size is None else chunk_size
        self.chunk_overlap = settings.chunk_overlap if chunk_overlap is None else chunk_overlap
        if self.chunk_size <= 0 or not 0 <= self.chunk_overlap < self.chunk_size:
            raise ValueError('Chunk size must be positive and overlap must be smaller than chunk size')
    
    def chunk_document(
        self,
        pages: list[dict],
        document_id: str,
        user_id: str,
        source_filename: str
    ) -> list[dict]:
        chunks = []
        chunk_index = 0
        
        for page in pages:
            if not page['text']:
                continue
            
            page_chunks = self._split_text(page['text'])
            
            for text_chunk in page_chunks:
                if not text_chunk.strip():
                    continue
                
                chunk_id = str(uuid.uuid4())
                chunks.append({
                    'chunk_id': chunk_id,
                    'document_id': document_id,
                    'user_id': user_id,
                    'page_number': page['page_number'],
                    'chunk_index': chunk_index,
                    'source_filename': source_filename,
                    'text': text_chunk.strip(),
                    'char_count': len(text_chunk.strip()),
                    'section': None
                })
                chunk_index += 1
        
        logger.info(f"Created {len(chunks)} chunks for document {document_id}")
        return chunks
    
    def _split_text(self, text: str) -> list[str]:
        """Recursive character text splitter with overlap."""
        if len(text) <= self.chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            current_start = start
            end = start + self.chunk_size
            
            if end >= len(text):
                chunks.append(text[start:])
                break
            
            # Try to split at sentence boundary
            split_at = end
            for sep in ['. ', '\n\n', '\n', ' ']:
                idx = text.rfind(sep, start, end)
                if idx + len(sep) > start + self.chunk_overlap:
                    split_at = idx + len(sep)
                    break
            
            chunks.append(text[start:split_at])
            start = max(split_at - self.chunk_overlap, current_start + 1)
        
        return chunks

chunking_service = ChunkingService()

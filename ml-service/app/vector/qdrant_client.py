from qdrant_client import QdrantClient as QdrantClientLib
from qdrant_client.models import (
    Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue, MatchAny,
    HasIdCondition
)
from app.core.config import settings
from app.core.logging import setup_logging
from typing import Optional
import uuid

logger = setup_logging()

class QdrantService:
    def __init__(self):
        self._client: Optional[QdrantClientLib] = None
    
    @property
    def client(self) -> QdrantClientLib:
        if self._client is None:
            self._client = QdrantClientLib(
                url=settings.qdrant_url,
                api_key=settings.qdrant_api_key or None
            )
        return self._client
    
    def ensure_collection(self):
        collections = self.client.get_collections().collections
        names = [c.name for c in collections]
        if settings.qdrant_collection in names:
            collection = self.client.get_collection(settings.qdrant_collection)
            vectors = collection.config.params.vectors
            if not isinstance(vectors, VectorParams):
                raise RuntimeError("Qdrant collection uses named vectors; a single unnamed vector is required")
            if vectors.size != settings.embedding_dimension or vectors.distance != Distance.COSINE:
                raise RuntimeError(
                    "Qdrant collection configuration mismatch: "
                    f"expected size={settings.embedding_dimension}, distance=Cosine; "
                    f"found size={vectors.size}, distance={vectors.distance}"
                )
        else:
            self.client.create_collection(
                collection_name=settings.qdrant_collection,
                vectors_config=VectorParams(
                    size=settings.embedding_dimension,
                    distance=Distance.COSINE
                )
            )
            logger.info(f"Created Qdrant collection: {settings.qdrant_collection}")
    
    def upsert_chunks(self, chunks: list[dict], embeddings: list[list[float]]):
        if len(chunks) != len(embeddings):
            raise ValueError('Each chunk must have exactly one embedding')
        points = []
        for chunk, embedding in zip(chunks, embeddings):
            points.append(PointStruct(
                id=chunk['chunk_id'],
                vector=embedding,
                payload=chunk
            ))
        self.client.upsert(
            collection_name=settings.qdrant_collection,
            points=points,
            wait=True,
        )
        logger.info(f"Upserted {len(points)} chunks to Qdrant")
    
    def search(
        self,
        query_vector: list[float],
        user_id: str,
        document_ids: list[str],
        top_k: int = 10
    ) -> list[dict]:
        filter_conditions = [
            FieldCondition(key="user_id", match=MatchValue(value=user_id))
        ]
        if document_ids:
            filter_conditions.append(
                FieldCondition(key="document_id", match=MatchAny(any=document_ids))
            )
        results = self.client.query_points(
            collection_name=settings.qdrant_collection,
            query=query_vector,
            query_filter=Filter(must=filter_conditions),
            limit=top_k,
            with_payload=True
        ).points
        return [
            {
                **hit.payload,
                'score': hit.score
            }
            for hit in results
        ]
    
    def delete_stale_document_chunks(
        self, document_id: str, user_id: str, keep_chunk_ids: list[str]
    ) -> None:
        self.client.delete(
            collection_name=settings.qdrant_collection,
            points_selector=Filter(
                must=[
                    FieldCondition(key="document_id", match=MatchValue(value=document_id)),
                    FieldCondition(key="user_id", match=MatchValue(value=user_id)),
                ],
                must_not=[HasIdCondition(has_id=keep_chunk_ids)],
            ),
            wait=True,
        )

    def document_chunks(self, user_id: str, document_ids: list[str]) -> list[dict]:
        if not document_ids:
            return []
        chunks, offset = [], None
        while True:
            points, offset = self.client.scroll(
                collection_name=settings.qdrant_collection,
                scroll_filter=Filter(must=[
                    FieldCondition(key='user_id', match=MatchValue(value=user_id)),
                    FieldCondition(key='document_id', match=MatchAny(any=document_ids)),
                ]), limit=100, offset=offset, with_payload=True, with_vectors=False,
            )
            chunks.extend(point.payload or {} for point in points)
            if offset is None:
                return chunks

    def delete_document(self, document_id: str, user_id: str) -> int:
        count = self.count_document_chunks(document_id, user_id)
        self.client.delete(
            collection_name=settings.qdrant_collection,
            points_selector=Filter(
                must=[
                    FieldCondition(key="document_id", match=MatchValue(value=document_id)),
                    FieldCondition(key="user_id", match=MatchValue(value=user_id)),
                ]
            ),
            wait=True,
        )
        logger.info(f"Deleted chunks for document {document_id}")
        return count

    def count_document_chunks(self, document_id: str, user_id: str) -> int:
        result = self.client.count(
            collection_name=settings.qdrant_collection,
            count_filter=Filter(
                must=[
                    FieldCondition(key="document_id", match=MatchValue(value=document_id)),
                    FieldCondition(key="user_id", match=MatchValue(value=user_id)),
                ]
            )
        )
        return result.count

qdrant_service = QdrantService()

"""
vector_store.py — Qdrant Cloud abstraction layer for RepoIntel AI.

This module provides a thin interface over Qdrant so the vector database
can be swapped in the future without touching the core RAG pipeline.

Public interface:
  - upsert(repo_id, documents, vectors)   → stores embeddings
  - search(repo_id, query_vector, k)      → [(Document, score), ...]
  - delete_collection(repo_id)            → removes all vectors for a repo
  - count(repo_id)                        → number of stored vectors
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from django.conf import settings
from langchain_core.documents import Document
from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models
from qdrant_client.http.exceptions import UnexpectedResponse

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

_client: QdrantClient | None = None


def _get_client() -> QdrantClient:
    """Return a singleton Qdrant client, initialised from settings."""
    global _client
    if _client is None:
        qdrant_url = getattr(settings, 'QDRANT_URL', '')
        qdrant_api_key = getattr(settings, 'QDRANT_API_KEY', '')

        if qdrant_url:
            _client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
            logger.info('Connected to Qdrant Cloud at %s', qdrant_url)
        else:
            # In-memory Qdrant for local development / testing
            _client = QdrantClient(':memory:')
            logger.warning(
                'QDRANT_URL not set — using in-memory Qdrant (data will not persist)'
            )
    return _client


def collection_name(repo_id: int) -> str:
    """Consistent collection naming across indexing and retrieval."""
    return f'repo_{repo_id}'


def _ensure_collection(client: QdrantClient, col_name: str, vector_size: int) -> None:
    """Create the collection if it does not exist yet."""
    try:
        client.get_collection(col_name)
    except (UnexpectedResponse, Exception):
        client.create_collection(
            collection_name=col_name,
            vectors_config=qdrant_models.VectorParams(
                size=vector_size,
                distance=qdrant_models.Distance.COSINE,
            ),
        )
        logger.info('Created Qdrant collection: %s (size=%d)', col_name, vector_size)


def upsert(repo_id: int, documents: list[Document], vectors: list[list[float]]) -> int:
    """
    Store a batch of LangChain Documents + pre-computed embedding vectors.

    Returns the number of points successfully upserted.
    """
    if not documents:
        return 0

    client = _get_client()
    col_name = collection_name(repo_id)
    vector_size = len(vectors[0])
    _ensure_collection(client, col_name, vector_size)

    points = [
        qdrant_models.PointStruct(
            id=i,
            vector=vector,
            payload={
                'page_content': doc.page_content,
                'file_path': doc.metadata.get('file_path', ''),
                'chunk_index': doc.metadata.get('chunk_index', 0),
                'language': doc.metadata.get('language', ''),
                'repository_id': repo_id,
            },
        )
        for i, (doc, vector) in enumerate(zip(documents, vectors))
    ]

    client.upsert(collection_name=col_name, points=points)
    logger.debug('Upserted %d points into collection %s', len(points), col_name)
    return len(points)


def upsert_batch(
    repo_id: int,
    documents: list[Document],
    vectors: list[list[float]],
    id_offset: int = 0,
) -> int:
    """
    Store a batch with a custom ID offset (used for sequential batch uploads
    so IDs don't collide across batches in the same collection).
    """
    if not documents:
        return 0

    client = _get_client()
    col_name = collection_name(repo_id)
    vector_size = len(vectors[0])
    _ensure_collection(client, col_name, vector_size)

    points = [
        qdrant_models.PointStruct(
            id=id_offset + i,
            vector=vector,
            payload={
                'page_content': doc.page_content,
                'file_path': doc.metadata.get('file_path', ''),
                'chunk_index': doc.metadata.get('chunk_index', 0),
                'language': doc.metadata.get('language', ''),
                'repository_id': repo_id,
            },
        )
        for i, (doc, vector) in enumerate(zip(documents, vectors))
    ]

    client.upsert(collection_name=col_name, points=points)
    return len(points)


def search(
    repo_id: int,
    query_vector: list[float],
    k: int = 8,
) -> list[tuple[Document, float]]:
    """
    Semantic search against the repository's Qdrant collection.

    Returns a list of (Document, cosine_similarity_score) tuples,
    highest-score first — same contract as LangChain's
    similarity_search_with_relevance_scores().
    """
    client = _get_client()
    col_name = collection_name(repo_id)

    try:
        results = client.search(
            collection_name=col_name,
            query_vector=query_vector,
            limit=k,
            with_payload=True,
        )
    except (UnexpectedResponse, Exception) as exc:
        logger.error('Qdrant search failed for collection %s: %s', col_name, exc)
        return []

    chunks: list[tuple[Document, float]] = []
    for hit in results:
        payload = hit.payload or {}
        doc = Document(
            page_content=payload.get('page_content', ''),
            metadata={
                'file_path': payload.get('file_path', ''),
                'chunk_index': payload.get('chunk_index', 0),
                'language': payload.get('language', ''),
            },
        )
        # Qdrant cosine distance score is in [0, 1]; higher = more similar
        chunks.append((doc, float(hit.score)))

    return chunks


def delete_collection(repo_id: int) -> None:
    """Remove all vectors for a repository from Qdrant."""
    client = _get_client()
    col_name = collection_name(repo_id)
    try:
        client.delete_collection(col_name)
        logger.info('Deleted Qdrant collection: %s', col_name)
    except Exception as exc:
        logger.debug('No Qdrant collection to delete for repo %d: %s', repo_id, exc)


def count(repo_id: int) -> int:
    """Return the number of vectors stored for a repository."""
    client = _get_client()
    col_name = collection_name(repo_id)
    try:
        info = client.get_collection(col_name)
        return info.points_count or 0
    except Exception:
        return 0


def recreate_collection(repo_id: int, vector_size: int) -> None:
    """Delete then recreate a Qdrant collection (used at start of indexing)."""
    delete_collection(repo_id)
    col_name = collection_name(repo_id)
    client = _get_client()
    client.create_collection(
        collection_name=col_name,
        vectors_config=qdrant_models.VectorParams(
            size=vector_size,
            distance=qdrant_models.Distance.COSINE,
        ),
    )
    logger.info('Recreated Qdrant collection: %s (size=%d)', col_name, vector_size)

"""
indexing_service.py — Chunk code files, embed with Gemini via LangChain, store in Qdrant Cloud.

Pipeline:
  1. Chunk source files into overlapping text segments.
  2. Embed each batch using GoogleGenerativeAIEmbeddings (LangChain).
  3. Store vectors + metadata in Qdrant Cloud via the vector_store abstraction.
  4. Persist CodeChunk records to PostgreSQL for metadata queries.

The vector_store module is the only Qdrant-aware layer — this service has
no direct qdrant-client imports, keeping the RAG pipeline decoupled from
the vector database implementation.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from pathlib import Path

from django.conf import settings
from langchain_core.documents import Document
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from . import vector_store

logger = logging.getLogger(__name__)

CHUNK_SIZE = 2000
CHUNK_OVERLAP = 200
MAX_EMBED_RETRIES = 3
RETRY_BACKOFF_SECONDS = 1.5


def _batch_size() -> int:
    return getattr(settings, 'EMBEDDING_BATCH_SIZE', 50)


@dataclass
class IndexingStats:
    files_processed: int = 0
    chunks_total: int = 0
    chunks_stored: int = 0
    chunks_failed: int = 0
    batches_processed: int = 0
    batches_failed: int = 0
    embedding_dimensions: int | None = None
    elapsed_seconds: float = 0.0
    failed_chunks: list[dict] = field(default_factory=list)


# ── Public helpers (used by retriever and tasks) ──────────────────────────────

def collection_name(repo_id: int) -> str:
    """Consistent collection naming used by both indexing and retrieval."""
    return vector_store.collection_name(repo_id)


# Backward-compatible alias
_collection_name = collection_name


def get_langchain_embeddings() -> GoogleGenerativeAIEmbeddings:
    """
    Return a configured LangChain GoogleGenerativeAIEmbeddings instance.

    Shared by the indexing and retrieval pipelines so both use the same
    model and API key.
    """
    model_name = getattr(settings, 'GEMINI_EMBEDDING_MODEL', 'gemini-embedding-001')
    model_name = model_name.replace('models/', '')

    return GoogleGenerativeAIEmbeddings(
        model=f'models/{model_name}',
        google_api_key=settings.GOOGLE_API_KEY,
    )


# ── Chunking ─────────────────────────────────────────────────────────────────

def chunk_text(text: str) -> list[str]:
    """Split *text* into overlapping character-level chunks."""
    if len(text) <= CHUNK_SIZE:
        return [text] if text.strip() else []

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        chunk = text[start:end]

        if end < len(text):
            last_nl = chunk.rfind('\n')
            if last_nl > CHUNK_SIZE // 2:
                end = start + last_nl + 1
                chunk = text[start:end]

        if chunk.strip():
            chunks.append(chunk)

        if end >= len(text):
            break

        next_start = end - CHUNK_OVERLAP
        if next_start <= start:
            next_start = end
        start = next_start

    return chunks


# ── Embedding with retry ──────────────────────────────────────────────────────

def _embed_batch_with_retry(
    embeddings: GoogleGenerativeAIEmbeddings,
    documents: list[Document],
    stats: IndexingStats,
) -> list[list[float]] | None:
    """Embed a batch of LangChain Documents with exponential backoff retry."""
    texts = [doc.page_content for doc in documents]
    for attempt in range(1, MAX_EMBED_RETRIES + 1):
        try:
            batch_start = time.perf_counter()
            vectors = embeddings.embed_documents(texts)
            elapsed = time.perf_counter() - batch_start

            if vectors and stats.embedding_dimensions is None:
                stats.embedding_dimensions = len(vectors[0])
                logger.info(
                    'Embedding dimensions: %d (model=%s)',
                    stats.embedding_dimensions,
                    settings.GEMINI_EMBEDDING_MODEL,
                )

            logger.debug(
                'Embedded batch of %d chunks in %.2fs (attempt %d)',
                len(texts),
                elapsed,
                attempt,
            )
            return vectors
        except Exception as exc:
            logger.warning(
                'Embedding batch failed (%d chunks, attempt %d/%d): %s',
                len(texts),
                attempt,
                MAX_EMBED_RETRIES,
                exc,
            )
            if attempt < MAX_EMBED_RETRIES:
                time.sleep(RETRY_BACKOFF_SECONDS * attempt)

    stats.batches_failed += 1
    return None


# ── Main indexing pipeline ────────────────────────────────────────────────────

def index_repository(repo_id: int, files: list[dict]) -> int:
    """
    Chunk all *files*, embed with Gemini via LangChain, persist in Qdrant and PostgreSQL.

    Returns the total number of chunks stored.
    """
    from apps.repositories.models import CodeChunk

    started_at = time.perf_counter()
    stats = IndexingStats(files_processed=len(files))
    batch_size = _batch_size()

    logger.info(
        'Starting embedding pipeline for repo %d: %d files, batch_size=%d',
        repo_id,
        len(files),
        batch_size,
    )

    # Build LangChain Document objects from file chunks
    pending_docs: list[Document] = []
    pending_meta: list[dict] = []  # parallel list for PostgreSQL persistence
    for file_info in files:
        file_path = file_info['path']
        language = file_info.get('language', 'Unknown')
        for chunk_index, chunk in enumerate(chunk_text(file_info['content'])):
            if not chunk.strip():
                continue
            pending_docs.append(Document(
                page_content=chunk,
                metadata={
                    'file_path': file_path,
                    'chunk_index': chunk_index,
                    'language': language,
                },
            ))
            pending_meta.append({
                'file_path': file_path,
                'language': language,
                'chunk_index': chunk_index,
                'content': chunk,
            })

    stats.chunks_total = len(pending_docs)
    logger.info('Prepared %d chunks from %d files for repo %d', stats.chunks_total, len(files), repo_id)

    if stats.chunks_total == 0:
        logger.warning('No chunks to index for repo %d', repo_id)
        return 0

    # Clear existing data in both Qdrant and PostgreSQL
    vector_store.delete_collection(repo_id)
    CodeChunk.objects.filter(repository_id=repo_id).delete()

    # Pre-create the Qdrant collection with the correct vector size
    # We know the dimensions from settings; the first successful embed will confirm.
    vector_size = getattr(settings, 'QDRANT_VECTOR_SIZE', 768)
    vector_store.recreate_collection(repo_id, vector_size)

    # Initialise LangChain embeddings
    lc_embeddings = get_langchain_embeddings()

    stored = 0
    chunk_counter = 0

    for batch_start in range(0, len(pending_docs), batch_size):
        batch_docs = pending_docs[batch_start: batch_start + batch_size]
        batch_meta = pending_meta[batch_start: batch_start + batch_size]

        batch_embed_start = time.perf_counter()
        vectors = _embed_batch_with_retry(lc_embeddings, batch_docs, stats)
        batch_elapsed = time.perf_counter() - batch_embed_start

        if vectors is None:
            stats.chunks_failed += len(batch_docs)
            for item in batch_meta:
                stats.failed_chunks.append({
                    'file_path': item['file_path'],
                    'chunk_index': item['chunk_index'],
                })
            logger.error(
                'Skipping batch %d–%d after %d retries (%d chunks lost)',
                batch_start,
                batch_start + len(batch_docs) - 1,
                MAX_EMBED_RETRIES,
                len(batch_docs),
            )
            continue

        try:
            # If dimensions from first real batch differ from settings, update
            if stats.embedding_dimensions and stats.embedding_dimensions != vector_size:
                logger.warning(
                    'Embedding dimension mismatch: settings=%d actual=%d. '
                    'Recreating Qdrant collection with correct size.',
                    vector_size,
                    stats.embedding_dimensions,
                )
                vector_store.recreate_collection(repo_id, stats.embedding_dimensions)

            # Store in Qdrant using batch offset for stable point IDs
            vector_store.upsert_batch(
                repo_id=repo_id,
                documents=batch_docs,
                vectors=vectors,
                id_offset=chunk_counter,
            )

            # Persist metadata to PostgreSQL
            CodeChunk.objects.bulk_create([
                CodeChunk(
                    repository_id=repo_id,
                    file_path=item['file_path'],
                    chunk_text=item['content'],
                    chunk_index=item['chunk_index'],
                )
                for item in batch_meta
            ])

            stored += len(batch_docs)
            chunk_counter += len(batch_docs)
            stats.batches_processed += 1
            stats.chunks_stored = stored

            logger.info(
                'Stored batch %d/%d: %d vectors in %.2fs (total stored: %d/%d)',
                (batch_start // batch_size) + 1,
                (len(pending_docs) + batch_size - 1) // batch_size,
                len(batch_docs),
                batch_elapsed,
                stored,
                stats.chunks_total,
            )
        except Exception as exc:
            stats.chunks_failed += len(batch_docs)
            stats.batches_failed += 1
            logger.error(
                'Qdrant upsert failed for batch starting at %d (%d chunks): %s',
                batch_start,
                len(batch_docs),
                exc,
            )

    stats.elapsed_seconds = time.perf_counter() - started_at
    qdrant_count = vector_store.count(repo_id)

    logger.info(
        'Embedding pipeline complete for repo %d: stored=%d/%d, failed=%d, '
        'batches_ok=%d, batches_failed=%d, qdrant_count=%d, dims=%s, elapsed=%.2fs',
        repo_id,
        stats.chunks_stored,
        stats.chunks_total,
        stats.chunks_failed,
        stats.batches_processed,
        stats.batches_failed,
        qdrant_count,
        stats.embedding_dimensions,
        stats.elapsed_seconds,
    )

    if stats.failed_chunks:
        sample = stats.failed_chunks[:5]
        logger.warning(
            'Failed chunks sample for repo %d (showing %d of %d): %s',
            repo_id,
            len(sample),
            len(stats.failed_chunks),
            sample,
        )

    if stats.chunks_stored == 0:
        raise RuntimeError(
            f'Embedding pipeline stored 0/{stats.chunks_total} chunks for repo {repo_id}. '
            f'Embedding failures: {stats.chunks_failed}, storage failures: {stats.batches_failed}. '
            'Check server logs for details (API key, model name, or Qdrant connection).'
        )

    return stats.chunks_stored


def delete_collection(repo_id: int) -> None:
    """Remove the Qdrant collection for a repository."""
    vector_store.delete_collection(repo_id)

"""
retriever.py — Semantic retrieval from Qdrant Cloud using LangChain + Gemini embeddings.

Uses the vector_store abstraction layer so this module has no direct
qdrant-client imports. The return type and function signature are unchanged
for full backward compatibility with rag_service.py.
"""
import logging
import time

from apps.repositories.services.indexing_service import get_langchain_embeddings
from apps.repositories.services import vector_store

logger = logging.getLogger(__name__)


def retrieve_relevant_chunks(
    repo_id: int,
    question: str,
    n_results: int = 8,
) -> list[dict]:
    """
    Retrieve the top-k most relevant code chunks for *question* from repo *repo_id*.

    Each returned dict has:
      file_path, content, chunk_index, language, relevance_score
    """
    started_at = time.perf_counter()

    # Check collection is non-empty before embedding the query
    chunk_count = vector_store.count(repo_id)
    if chunk_count == 0:
        logger.warning('Qdrant collection is empty for repo %d', repo_id)
        return []

    logger.debug(
        'Retrieving top-%d chunks from %d vectors for repo %d',
        n_results,
        chunk_count,
        repo_id,
    )

    # Embed the question using the same model as indexing
    lc_embeddings = get_langchain_embeddings()
    try:
        query_vector = lc_embeddings.embed_query(question)
    except Exception as exc:
        logger.error('Failed to embed query for repo %d: %s', repo_id, exc)
        return []

    # Semantic search via Qdrant
    search_start = time.perf_counter()
    results = vector_store.search(
        repo_id=repo_id,
        query_vector=query_vector,
        k=min(n_results, chunk_count),
    )
    search_elapsed = time.perf_counter() - search_start

    chunks: list[dict] = []
    for doc, score in results:
        chunks.append({
            'content': doc.page_content,
            'file_path': doc.metadata.get('file_path', ''),
            'chunk_index': doc.metadata.get('chunk_index', 0),
            'language': doc.metadata.get('language', ''),
            'relevance_score': round(float(score), 4),
        })

    logger.info(
        'Retrieved %d chunks for repo %d in %.2fs (search=%.2fs)',
        len(chunks),
        repo_id,
        time.perf_counter() - started_at,
        search_elapsed,
    )
    if chunks:
        logger.debug(
            'Top relevance scores for repo %d: %s',
            repo_id,
            [c['relevance_score'] for c in chunks[:3]],
        )

    return chunks

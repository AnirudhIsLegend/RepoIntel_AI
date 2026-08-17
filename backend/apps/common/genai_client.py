"""
Shared Google Gemini client and embedding helpers.
"""
from __future__ import annotations

import logging
import math
from functools import lru_cache

from django.conf import settings
from google import genai
from google.genai import types as genai_types

logger = logging.getLogger(__name__)

# Legacy model shut down 2026-01-14; map to current GA embedding model.
_DEPRECATED_EMBEDDING_MODELS = frozenset({
    'text-embedding-004',
    'models/text-embedding-004',
    'embedding-001',
    'models/embedding-001',
})


@lru_cache(maxsize=1)
def get_genai_client() -> genai.Client:
    if not settings.GOOGLE_API_KEY:
        raise ValueError('GOOGLE_API_KEY is not configured.')
    return genai.Client(api_key=settings.GOOGLE_API_KEY)


def resolve_embedding_model() -> str:
    """Return SDK-ready embedding model name (no ``models/`` prefix)."""
    configured = settings.GEMINI_EMBEDDING_MODEL
    short = configured.replace('models/', '')
    if configured in _DEPRECATED_EMBEDDING_MODELS or short in _DEPRECATED_EMBEDDING_MODELS:
        logger.warning(
            'Embedding model %s is deprecated; using gemini-embedding-001',
            configured,
        )
        return 'gemini-embedding-001'
    return short


def _l2_normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vector))
    if norm == 0:
        return vector
    return [x / norm for x in vector]


def _embed_config(task_type: str) -> genai_types.EmbedContentConfig:
    dims = getattr(settings, 'GEMINI_EMBEDDING_DIMENSIONS', 768)
    config_kwargs: dict = {'task_type': task_type}
    if dims:
        config_kwargs['output_dimensionality'] = dims
    return genai_types.EmbedContentConfig(**config_kwargs)


def _normalize_vectors(vectors: list[list[float]], model: str) -> list[list[float]]:
    dims = getattr(settings, 'GEMINI_EMBEDDING_DIMENSIONS', 768)
    if dims and model.startswith('gemini-embedding'):
        return [_l2_normalize(v) for v in vectors]
    return vectors


def _embed_one(client: genai.Client, model: str, text: str, task_type: str) -> list[float]:
    result = client.models.embed_content(
        model=model,
        contents=text,
        config=_embed_config(task_type),
    )
    return list(result.embeddings[0].values)


def embed_texts(
    texts: list[str],
    task_type: str = 'RETRIEVAL_DOCUMENT',
) -> list[list[float]]:
    """Embed texts with Gemini; L2-normalize when using reduced dimensionality."""
    if not texts:
        return []

    client = get_genai_client()
    model = resolve_embedding_model()
    config = _embed_config(task_type)

    result = client.models.embed_content(model=model, contents=texts, config=config)
    vectors = [list(e.values) for e in result.embeddings]

    # gemini-embedding-2 returns a single pooled vector for multi-text batches.
    if len(vectors) != len(texts):
        logger.info(
            'Batch embed returned %d vector(s) for %d texts with %s; embedding individually',
            len(vectors),
            len(texts),
            model,
        )
        vectors = [_embed_one(client, model, text, task_type) for text in texts]

    return _normalize_vectors(vectors, model)


def embed_query(text: str) -> list[float]:
    return embed_texts([text], task_type='RETRIEVAL_QUERY')[0]

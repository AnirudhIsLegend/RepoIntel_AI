# RepoIntel AI - Production Deployment Refactor Specification

## Objective

Refactor the current development-oriented architecture into a
production-ready deployment while preserving all existing functionality.

## Required Changes

### 1. Database Migration

-   Replace SQLite with Neon PostgreSQL.
-   Update Django database configuration to use environment variables.
-   Run migrations and ensure all models work unchanged.
-   Remove references to `db.sqlite3` for production.

Environment variables: - DB_NAME - DB_USER - DB_PASSWORD - DB_HOST -
DB_PORT

------------------------------------------------------------------------

### 2. Background Processing

Current implementation uses raw `threading.Thread`.

Replace with: - Celery - Redis (Upstash Redis recommended)

Requirements: - Move repository ingestion to Celery tasks. - Move
embedding generation to Celery tasks. - Add retries with exponential
backoff. - Track task status.

------------------------------------------------------------------------

### 3. Repository Processing

Current: Repository is cloned into `backend/cloned_repos/`.

Change: 1. Clone repository. 2. Parse files. 3. Generate chunks. 4.
Generate embeddings. 5. Store metadata and vectors. 6. Delete cloned
repository after successful indexing. 7. Clean up even on failure.

------------------------------------------------------------------------

### 4. Authentication

Implement JWT authentication.

Requirements: - Register - Login - Refresh token - Protect repository
and chat APIs.

------------------------------------------------------------------------

### 5. Rate Limiting

Add throttling to: - Repository analysis endpoint - Chat endpoint

Prevent abuse of Gemini API.

------------------------------------------------------------------------

### 6. Input Validation

Validate GitHub URLs.

Accept only: https://github.com/`<owner>`{=html}/`<repository>`{=html}

Reject invalid URLs before cloning.

------------------------------------------------------------------------

### 7. Environment Variables

Move secrets to `.env`.

Include: - GOOGLE_API_KEY - SECRET_KEY - DB credentials - REDIS_URL -
GEMINI_MODEL - GEMINI_EMBEDDING_MODEL

------------------------------------------------------------------------



### 8. Vector Database

Use **Qdrant Cloud** as the production vector database.

Requirements:
- Replace the local ChromaDB implementation with Qdrant.
- Store repository code embeddings in Qdrant.
- Preserve the existing metadata:
  - file_path
  - chunk_index
  - language
  - repository_id
- Use cosine similarity for semantic retrieval.
- Integrate Qdrant with the existing LangChain RAG pipeline.
- Store Qdrant credentials and configuration through environment variables.
- Implement the vector-store layer separately from the RAG business logic so that the vector database can be replaced in the future without modifying the core RAG pipeline.
- Ensure repository deletion also removes its corresponding vectors from Qdrant.

------------------------------------------------------------------------

### 9. Frontend

Replace polling with Server-Sent Events (preferred) or WebSockets for
indexing progress.

If not feasible, implement exponential backoff polling.

------------------------------------------------------------------------

### 10. Deployment

Frontend: - Vercel

Backend: - Railway or Render - Gunicorn

Database: - Neon PostgreSQL

Background Jobs: - Celery - Upstash Redis

Vector Store: - ChromaDB (persistent volume)

------------------------------------------------------------------------

### 11. Docker

Create: - Dockerfile - docker-compose.yml

Services: - Django - Redis - ChromaDB volume

------------------------------------------------------------------------

### 12. Logging

Replace print statements with Python logging.

Include: - INFO - WARNING - ERROR

Log: - Repository indexing - Embedding failures - Gemini failures -
Celery task failures

------------------------------------------------------------------------

### 13. Error Handling

Provide graceful error responses.

Clean temporary repositories on failure.

Retry transient API failures.

------------------------------------------------------------------------

### 14. Code Quality

Do not change existing API contracts unless necessary.

Keep folder structure consistent.

Maintain current RAG workflow: GitHub URL → Clone → Parse → Chunk →
Embed → ChromaDB → Retrieve → Gemini → Response

------------------------------------------------------------------------

## Deliverables

1.  Production-ready backend.
2.  Docker configuration.
3.  Neon PostgreSQL integration.
4.  Celery + Redis integration.
5.  JWT authentication.
6.  Rate limiting.
7.  Automatic repository cleanup.
8.  Environment-based configuration.
9.  Deployment documentation.
10. Migration guide from development to production.

## Constraints

-   Preserve existing functionality.
-   Preserve RAG behavior.
-   Avoid unnecessary refactoring.
-   Write clean, modular, maintainable code.
-   Add comments only where they improve clarity.

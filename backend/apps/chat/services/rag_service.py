"""
rag_service.py — Build RAG prompt via LangChain LCEL, call Gemini, return answer + source citations.

Migration notes:
  - Prompt is now a ChatPromptTemplate instead of an f-string.
  - LLM is ChatGoogleGenerativeAI instead of raw client.models.generate_content().
  - Chain uses LCEL: prompt | llm | StrOutputParser().
  - Retrieval is still called explicitly (not chained) because we need raw chunks
    for the sources/chunks fields in the API response.
  - Return contract is unchanged: {answer, sources, chunks}.
"""
import logging

from django.conf import settings
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

from .retriever import retrieve_relevant_chunks

logger = logging.getLogger(__name__)

# ─── LangChain components (initialised lazily) ──────────────────────────────

_RAG_SYSTEM_PROMPT = (
    "You are a senior software architect and developer assistant "
    "helping a new developer understand a codebase.\n\n"
    "You have access to relevant code snippets retrieved via semantic search "
    "from the repository."
)

_RAG_HUMAN_TEMPLATE = """{history}
────────────────────────────────────────
RETRIEVED CODE CONTEXT:
{context}
────────────────────────────────────────

Developer's Question: {question}

Instructions:
- Answer thoroughly and accurately, basing your response ONLY on the code provided.
- Always cite specific file names when referencing code (e.g., "In `auth.py`, ...").
- If asked to trace a request flow, show the step-by-step sequence through files using arrows (→).
- If asked about architecture, explain layers and how components interact.
- Include short, relevant code snippets (in markdown code blocks) where helpful.
- Use clear markdown formatting (headings, bullet lists, code blocks).
- If the provided code is insufficient to fully answer, say so clearly.

Answer:"""

_PROMPT = ChatPromptTemplate.from_messages([
    ("system", _RAG_SYSTEM_PROMPT),
    ("human", _RAG_HUMAN_TEMPLATE),
])


def _get_llm() -> ChatGoogleGenerativeAI:
    """Return a configured ChatGoogleGenerativeAI instance."""
    return ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GOOGLE_API_KEY,
        temperature=0.3,
        convert_system_message_to_human=False,
    )


def _build_rag_chain():
    """Build the LCEL chain: prompt → LLM → string output."""
    llm = _get_llm()
    return _PROMPT | llm | StrOutputParser()


def chat_with_repository(
    repo_id: int,
    question: str,
    chat_history: list[dict] | None = None,
) -> dict:
    """
    Answer *question* about *repo_id* using RAG with LangChain LCEL.

    Returns:
      {
        "answer":  str,
        "sources": [str, ...],          # unique file paths
        "chunks":  [{file_path, content, relevance_score}, ...]  # top 5
      }
    """
    # 1. Retrieve relevant chunks (via LangChain Chroma retriever)
    chunks = retrieve_relevant_chunks(repo_id, question, n_results=8)
    if not chunks:
        return {
            "answer": (
                "I couldn't find relevant code in this repository to answer your question. "
                "The repository may still be indexing — please wait until status is **Ready**."
            ),
            "sources": [],
            "chunks": [],
        }

    # 2. Group chunks by file for context (same grouping logic as before)
    file_chunks: dict[str, list[str]] = {}
    for chunk in chunks:
        fp = chunk['file_path']
        file_chunks.setdefault(fp, []).append(chunk['content'])

    context_sections = []
    for fp, contents in file_chunks.items():
        combined = "\n...\n".join(contents)
        context_sections.append(f"=== {fp} ===\n{combined}")
    context = "\n\n".join(context_sections)

    # 3. Build prior conversation history (last 4 turns)
    history_str = ""
    if chat_history:
        parts = []
        for msg in chat_history[-4:]:
            role = "User" if msg.get('role') == 'user' else "Assistant"
            parts.append(f"{role}: {msg.get('content', '')}")
        history_str = "Previous conversation context:\n" + "\n".join(parts)

    # 4. Invoke the LCEL chain
    chain = _build_rag_chain()
    try:
        answer = chain.invoke({
            "context": context,
            "question": question,
            "history": history_str,
        })
    except Exception as exc:
        logger.error("LangChain RAG chain failed: %s", exc)
        answer = "Sorry, I encountered an error generating the answer. Please try again."

    sources = list(file_chunks.keys())

    return {
        "answer": answer,
        "sources": sources,
        "chunks": [
            {
                "file_path":       c['file_path'],
                "content":         c['content'][:600],
                "relevance_score": c['relevance_score'],
            }
            for c in chunks[:5]
        ],
    }

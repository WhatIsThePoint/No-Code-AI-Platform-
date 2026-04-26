"""
RAG chat inference: local embedding → pgvector retrieval → Ollama generation.

100% local: no outbound API calls. The embedder runs on CPU, retrieval is
PostgreSQL cosine-similarity (`<=>`), generation is the Ollama HTTP API.
"""

from __future__ import annotations

import json
import os
import threading
from dataclasses import dataclass
from typing import Iterator

import requests

_EMBED_MODEL = None
_EMBED_LOCK = threading.Lock()

EMBED_DIM = 384
# Default retrieval breadth. Sized for our 6 GB GPU + small Ollama models:
# K=8 doubles recall vs the old K=3 default while staying inside the 8K
# context window we set on the LLM (see `num_ctx` below). Going past 10
# blows the window on phi3:mini (4K) and gemma2:2b (8K) and amplifies the
# "lost in the middle" effect on 3B-class models.
TOP_K = 8
# Ollama silently defaults `num_ctx` to 2048 — at K=8 with ~750-token chunks
# that truncates ~70% of the retrieved context. 8192 is the largest window
# all three supported engines can honor (gemma2:2b cap = 8K).
NUM_CTX = 8192

# Strict RAG prompt — instructs the LLM to refuse when context is empty
# rather than hallucinate from its own training data. Ollama uses the
# `/api/generate` endpoint; `system` and `prompt` are sent separately.
SYSTEM_PROMPT = (
    "You are a helpful assistant that answers questions strictly from the "
    "provided context. If the context does not contain the answer, reply "
    "exactly: \"I don't know based on the provided documents.\" "
    "Cite the source numbers (e.g., [1], [2]) when you use them. "
    "Keep answers concise and factual."
)


@dataclass
class ChatSource:
    text: str
    source_name: str | None
    document_id: str | None
    score: float
    chunk_index: int


def _get_embedding_model():
    global _EMBED_MODEL
    if _EMBED_MODEL is None:
        with _EMBED_LOCK:
            if _EMBED_MODEL is None:
                from sentence_transformers import SentenceTransformer

                _EMBED_MODEL = SentenceTransformer(
                    os.environ.get(
                        "EMBEDDING_MODEL",
                        "sentence-transformers/all-MiniLM-L6-v2",
                    )
                )
    return _EMBED_MODEL


def _embed_query(text: str) -> list[float]:
    model = _get_embedding_model()
    vec = model.encode([text], show_progress_bar=False, normalize_embeddings=True)[0]
    return vec.tolist()


def retrieve_context(
    pipeline_id: str, query_vector: list[float], top_k: int = TOP_K
) -> list[ChatSource]:
    """Cosine-similarity search over document_chunks for this pipeline."""
    import psycopg2
    from pgvector.psycopg2 import register_vector

    dsn = os.environ.get("PGVECTOR_DSN")
    if not dsn:
        raise RuntimeError("PGVECTOR_DSN environment variable not set")

    conn = psycopg2.connect(dsn)
    try:
        register_vector(conn)
        with conn.cursor() as cur:
            # `1 - (embedding <=> query)` converts cosine distance to similarity in [0, 1].
            cur.execute(
                """
                SELECT
                    text_content,
                    source_name,
                    document_id,
                    chunk_index,
                    1 - (embedding <=> %s::vector) AS similarity
                FROM document_chunks
                WHERE pipeline_id = %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (query_vector, pipeline_id, query_vector, top_k),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    return [
        ChatSource(
            text=r[0],
            source_name=r[1],
            document_id=r[2],
            chunk_index=r[3] or 0,
            score=float(r[4]),
        )
        for r in rows
    ]


def build_prompt(query: str, sources: list[ChatSource]) -> str:
    if not sources:
        context_block = "(no relevant documents found)"
    else:
        parts = []
        for i, s in enumerate(sources, start=1):
            label = s.source_name or s.document_id or "unknown"
            parts.append(f"[{i}] (source: {label})\n{s.text.strip()}")
        context_block = "\n\n".join(parts)

    return (
        f"Context:\n{context_block}\n\n"
        f"Question: {query}\n\n"
        f"Answer:"
    )


# Models the RAGConfig node is allowed to select. Anything outside this set
# is ignored in favor of OLLAMA_MODEL so a bad client payload can't trigger
# a download of an arbitrary model.
_ALLOWED_MODELS = {"llama3.2:3b", "llama3.2:1b", "phi3:mini", "gemma2:2b"}


def call_ollama(
    prompt: str, system: str = SYSTEM_PROMPT, model: str | None = None
) -> str:
    url = os.environ.get("OLLAMA_URL", "http://ollama:11434").rstrip("/")
    chosen = model if model in _ALLOWED_MODELS else os.environ.get(
        "OLLAMA_MODEL", "llama3.2:3b"
    )

    resp = requests.post(
        f"{url}/api/generate",
        json={
            "model": chosen,
            "system": system,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.2, "num_ctx": NUM_CTX},
        },
        timeout=120,
    )
    resp.raise_for_status()
    payload = resp.json()
    # Ollama returns {"response": "...", "done": true, ...}
    return (payload.get("response") or "").strip()


def _sources_payload(sources: list[ChatSource]) -> list[dict]:
    return [
        {
            "rank": i + 1,
            "text": s.text,
            "source_name": s.source_name,
            "document_id": s.document_id,
            "chunk_index": s.chunk_index,
            "score": round(s.score, 4),
        }
        for i, s in enumerate(sources)
    ]


def chat(
    pipeline_id: str,
    query: str,
    top_k: int = TOP_K,
    model: str | None = None,
) -> dict:
    """Full RAG turn. Returns {answer, sources_used}."""
    query_vec = _embed_query(query)
    sources = retrieve_context(pipeline_id, query_vec, top_k=top_k)
    prompt = build_prompt(query, sources)
    answer = call_ollama(prompt, model=model)

    return {
        "answer": answer,
        "sources_used": _sources_payload(sources),
    }


def stream_ollama(
    prompt: str, system: str = SYSTEM_PROMPT, model: str | None = None
) -> Iterator[str]:
    """Yield successive `response` tokens from Ollama's streaming /api/generate."""
    url = os.environ.get("OLLAMA_URL", "http://ollama:11434").rstrip("/")
    chosen = model if model in _ALLOWED_MODELS else os.environ.get(
        "OLLAMA_MODEL", "llama3.2:3b"
    )

    with requests.post(
        f"{url}/api/generate",
        json={
            "model": chosen,
            "system": system,
            "prompt": prompt,
            "stream": True,
            "options": {"temperature": 0.2, "num_ctx": NUM_CTX},
        },
        stream=True,
        timeout=120,
    ) as resp:
        resp.raise_for_status()
        for raw in resp.iter_lines(decode_unicode=True):
            if not raw:
                continue
            try:
                obj = json.loads(raw)
            except json.JSONDecodeError:
                continue
            chunk = obj.get("response")
            if chunk:
                yield chunk
            if obj.get("done"):
                break


def chat_stream(
    pipeline_id: str,
    query: str,
    top_k: int = TOP_K,
    model: str | None = None,
) -> Iterator[dict]:
    """
    Yields NDJSON-ready dicts for streaming RAG turns:
        {"type": "sources", "sources_used": [...]}      (always first)
        {"type": "token",   "text": "..."}              (repeated, may be empty-skipped)
        {"type": "done",    "answer": "..."}            (final, full text for persistence)
        {"type": "error",   "error": "...", "detail":...} (on failure mid-stream)

    Sources go first so the UI can render the citation chips before the answer
    starts arriving — that's what makes [N] popovers work as the text streams in.
    """
    query_vec = _embed_query(query)
    sources = retrieve_context(pipeline_id, query_vec, top_k=top_k)
    yield {"type": "sources", "sources_used": _sources_payload(sources)}

    prompt = build_prompt(query, sources)
    parts: list[str] = []
    try:
        for chunk in stream_ollama(prompt, model=model):
            parts.append(chunk)
            yield {"type": "token", "text": chunk}
    except requests.exceptions.ConnectionError:
        yield {
            "type": "error",
            "error": "ollama_unavailable",
            "detail": "Local LLM service is not reachable.",
        }
        return
    except requests.exceptions.Timeout:
        yield {"type": "error", "error": "ollama_timeout"}
        return
    except requests.exceptions.HTTPError as exc:
        yield {
            "type": "error",
            "error": "ollama_error",
            "detail": str(exc)[:300],
        }
        return

    yield {"type": "done", "answer": "".join(parts).strip()}

"""
Unit tests for the RAG chat endpoint and the underlying rag_chat service.

Mocks Ollama (`requests.post`) and pgvector retrieval to keep tests pure.
"""

from unittest.mock import MagicMock, patch

import pytest
import requests

USER_HEADERS = {"X-User-Id": "user-123", "X-User-Role": "data_scientist"}


# ── Route-level: input validation ────────────────────────────────────────────


def test_chat_requires_user_header(client):
    resp = client.post("/pipelines/p-1/chat", json={"message": "hi"})
    assert resp.status_code == 401
    assert resp.get_json()["error"] == "missing_user_id"


def test_chat_rejects_empty_message(client):
    resp = client.post("/pipelines/p-1/chat", json={"message": "   "}, headers=USER_HEADERS)
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "empty_message"


def test_chat_rejects_oversized_message(client):
    big = "x" * 5000
    resp = client.post(
        "/pipelines/p-1/chat", json={"message": big}, headers=USER_HEADERS
    )
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "message_too_long"


# ── Route-level: happy path + error mapping ──────────────────────────────────


@patch("app.routes.chat.rag_chat")
def test_chat_success_returns_answer_and_sources(mock_chat, client):
    mock_chat.return_value = {
        "answer": "The dataset has 150 rows.",
        "sources_used": [
            {
                "rank": 1,
                "text": "rows: 150",
                "source_name": "iris.pdf",
                "document_id": "doc-1",
                "chunk_index": 0,
                "score": 0.81,
            }
        ],
    }
    resp = client.post(
        "/pipelines/p-1/chat",
        json={"message": "How many rows?"},
        headers=USER_HEADERS,
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["answer"].startswith("The dataset")
    assert len(body["sources_used"]) == 1
    assert body["sources_used"][0]["source_name"] == "iris.pdf"
    mock_chat.assert_called_once_with(pipeline_id="p-1", query="How many rows?")


@patch("app.routes.chat.rag_chat")
def test_chat_maps_ollama_unreachable_to_503(mock_chat, client):
    mock_chat.side_effect = requests.exceptions.ConnectionError("nope")
    resp = client.post(
        "/pipelines/p-1/chat", json={"message": "ping"}, headers=USER_HEADERS
    )
    assert resp.status_code == 503
    assert resp.get_json()["error"] == "ollama_unavailable"


@patch("app.routes.chat.rag_chat")
def test_chat_maps_ollama_timeout_to_504(mock_chat, client):
    mock_chat.side_effect = requests.exceptions.Timeout()
    resp = client.post(
        "/pipelines/p-1/chat", json={"message": "ping"}, headers=USER_HEADERS
    )
    assert resp.status_code == 504


@patch("app.routes.chat.rag_chat")
def test_chat_maps_runtime_error_to_500(mock_chat, client):
    mock_chat.side_effect = RuntimeError("PGVECTOR_DSN not set")
    resp = client.post(
        "/pipelines/p-1/chat", json={"message": "ping"}, headers=USER_HEADERS
    )
    assert resp.status_code == 500
    assert resp.get_json()["error"] == "rag_misconfigured"


# ── Service-level: build_prompt + chat() composition ─────────────────────────


def test_build_prompt_inserts_no_documents_marker():
    from app.services.rag_chat import build_prompt

    prompt = build_prompt("What is X?", [])
    assert "no relevant documents found" in prompt
    assert "Question: What is X?" in prompt


def test_build_prompt_numbers_and_labels_sources():
    from app.services.rag_chat import ChatSource, build_prompt

    sources = [
        ChatSource(
            text="alpha", source_name="a.pdf", document_id="d1", score=0.9, chunk_index=0
        ),
        ChatSource(
            text="beta", source_name=None, document_id="d2", score=0.7, chunk_index=1
        ),
    ]
    prompt = build_prompt("Q?", sources)
    assert "[1] (source: a.pdf)" in prompt
    assert "[2] (source: d2)" in prompt
    assert "alpha" in prompt and "beta" in prompt


@patch("app.services.rag_chat.call_ollama")
@patch("app.services.rag_chat.retrieve_context")
@patch("app.services.rag_chat._embed_query")
def test_chat_pipeline_returns_ranked_sources(mock_embed, mock_retrieve, mock_ollama):
    from app.services.rag_chat import ChatSource, chat

    mock_embed.return_value = [0.0] * 384
    mock_retrieve.return_value = [
        ChatSource(
            text="iris has 150 rows",
            source_name="iris.pdf",
            document_id="d-1",
            score=0.812345,
            chunk_index=0,
        ),
        ChatSource(
            text="three classes",
            source_name="iris.pdf",
            document_id="d-1",
            score=0.5,
            chunk_index=1,
        ),
    ]
    mock_ollama.return_value = "150 rows, 3 classes [1][2]"

    result = chat("p-1", "tell me about iris")

    assert result["answer"] == "150 rows, 3 classes [1][2]"
    assert [s["rank"] for s in result["sources_used"]] == [1, 2]
    # Score is rounded to 4 decimals.
    assert result["sources_used"][0]["score"] == pytest.approx(0.8123, abs=1e-4)


@patch("app.services.rag_chat.call_ollama")
@patch("app.services.rag_chat.retrieve_context")
@patch("app.services.rag_chat._embed_query")
def test_chat_pipeline_with_empty_context(mock_embed, mock_retrieve, mock_ollama):
    """When no chunks match, the LLM is still called but sources_used is empty."""
    from app.services.rag_chat import chat

    mock_embed.return_value = [0.0] * 384
    mock_retrieve.return_value = []
    mock_ollama.return_value = "I don't know based on the provided documents."

    result = chat("p-1", "What is the airspeed velocity of an unladen swallow?")
    assert result["sources_used"] == []
    assert "don't know" in result["answer"]


def test_call_ollama_posts_expected_payload(monkeypatch):
    from app.services import rag_chat as svc

    monkeypatch.setenv("OLLAMA_URL", "http://ollama-test:11434")
    monkeypatch.setenv("OLLAMA_MODEL", "llama3.2:3b")

    mock_resp = MagicMock()
    mock_resp.json.return_value = {"response": "  hello world  ", "done": True}
    mock_resp.raise_for_status = MagicMock()

    with patch("app.services.rag_chat.requests.post", return_value=mock_resp) as mock_post:
        out = svc.call_ollama("Context:\nfoo\n\nQuestion: ?\n\nAnswer:")

    assert out == "hello world"
    args, kwargs = mock_post.call_args
    assert args[0] == "http://ollama-test:11434/api/generate"
    body = kwargs["json"]
    assert body["model"] == "llama3.2:3b"
    assert body["stream"] is False
    assert body["system"].startswith("You are a helpful assistant")
    assert body["options"]["temperature"] == 0.2

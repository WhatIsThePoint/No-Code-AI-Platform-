import api from "./axios";
import { useAuthStore } from "../store/authSlice";

export interface RAGDocument {
  document_id: string;
  source_name: string;
  status: "queued" | "running" | "ready" | "error";
  chunk_count: number;
  size_bytes: number;
  created_at: string | null;
  error_message?: string;
}

export interface ChatSource {
  rank: number;
  text: string;
  source_name: string | null;
  document_id: string | null;
  chunk_index: number;
  score: number;
}

export interface ChatResponse {
  answer: string;
  sources_used: ChatSource[];
}

export interface ChatTurn {
  turn_id?: string;
  message: string;
  answer: string;
  source_count: number;
  thread_id?: string;
  feedback?: number | null;
  created_at: string | null;
}

export interface ChatThread {
  thread_id: string;
  title: string;
  turn_count: number;
  created_at: string | null;
  last_message_at: string | null;
}

export const ragApi = {
  uploadDocument: (pipelineId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<{ document_id: string; task_id: string; status: string }>(
      `/pipelines/${pipelineId}/documents`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  },

  listDocuments: (pipelineId: string) =>
    api.get<{ items: RAGDocument[]; total: number }>(
      `/pipelines/${pipelineId}/documents`
    ),

  chat: (pipelineId: string, message: string, threadId?: string) =>
    api.post<ChatResponse & { thread_id?: string }>(
      `/pipelines/${pipelineId}/chat`,
      { message, ...(threadId ? { thread_id: threadId } : {}) },
    ),

  chatHistory: (pipelineId: string, threadId?: string) =>
    api.get<{ items: ChatTurn[] }>(
      `/pipelines/${pipelineId}/chat/history`,
      threadId ? { params: { thread_id: threadId } } : undefined,
    ),

  listThreads: (pipelineId: string) =>
    api.get<{ items: ChatThread[] }>(`/pipelines/${pipelineId}/chat/threads`),

  createThread: (pipelineId: string) =>
    api.post<ChatThread>(`/pipelines/${pipelineId}/chat/threads`),

  getThread: (pipelineId: string, threadId: string) =>
    api.get<{ thread_id: string; items: ChatTurn[] }>(
      `/pipelines/${pipelineId}/chat/threads/${threadId}`,
    ),

  deleteThread: (pipelineId: string, threadId: string) =>
    api.delete<{ deleted: number }>(
      `/pipelines/${pipelineId}/chat/threads/${threadId}`,
    ),

  documentChunks: (
    pipelineId: string,
    documentId: string,
    params?: { page?: number; page_size?: number },
  ) =>
    api.get<{
      document_id: string;
      source_name: string | null;
      page: number;
      page_size: number;
      total: number;
      items: { chunk_index: number; text: string; chars: number }[];
    }>(`/pipelines/${pipelineId}/documents/${documentId}/chunks`, { params }),

  rateTurn: (pipelineId: string, turnId: string, value: -1 | 0 | 1) =>
    api.post<{ turn_id: string; feedback: number }>(
      `/pipelines/${pipelineId}/chat/turns/${turnId}/feedback`,
      { value },
    ),

  /**
   * Stream a RAG turn token-by-token. Uses native `fetch` (not axios) because
   * axios buffers the entire response before resolving — the whole point of
   * this endpoint is to read the body incrementally.
   *
   * NDJSON wire format (see ml-training/routes/chat.py):
   *   {"type":"sources","sources_used":[...]}
   *   {"type":"token","text":"..."}            (repeated)
   *   {"type":"done","answer":"..."}
   *   {"type":"error","error":"...","detail":"..."}
   */
  chatStream: async (
    pipelineId: string,
    message: string,
    handlers: {
      onThread?: (threadId: string) => void;
      onSources?: (sources: ChatSource[]) => void;
      onToken?: (chunk: string) => void;
      onDone?: (finalAnswer: string) => void;
      onError?: (error: string, detail?: string) => void;
    },
    signal?: AbortSignal,
    threadId?: string,
  ): Promise<void> => {
    const token = useAuthStore.getState().accessToken;
    const resp = await fetch(`/api/pipelines/${pipelineId}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ message, ...(threadId ? { thread_id: threadId } : {}) }),
      signal,
    });

    if (!resp.ok || !resp.body) {
      let detail: string | undefined;
      try {
        const txt = await resp.text();
        detail = txt.slice(0, 300);
      } catch {
        /* ignore */
      }
      handlers.onError?.(`http_${resp.status}`, detail);
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    const dispatch = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let evt: { type?: string; [k: string]: unknown };
      try {
        evt = JSON.parse(trimmed);
      } catch {
        return;
      }
      switch (evt.type) {
        case "thread":
          handlers.onThread?.(String(evt.thread_id ?? ""));
          break;
        case "sources":
          handlers.onSources?.((evt.sources_used as ChatSource[]) ?? []);
          break;
        case "token":
          handlers.onToken?.(String(evt.text ?? ""));
          break;
        case "done":
          handlers.onDone?.(String(evt.answer ?? ""));
          break;
        case "error":
          handlers.onError?.(
            String(evt.error ?? "stream_error"),
            evt.detail ? String(evt.detail) : undefined
          );
          break;
      }
    };

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf("\n");
      while (nl !== -1) {
        dispatch(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");
      }
    }
    if (buffer.trim()) dispatch(buffer);
  },
};

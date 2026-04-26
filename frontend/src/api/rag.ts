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
  message: string;
  answer: string;
  source_count: number;
  created_at: string | null;
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

  chat: (pipelineId: string, message: string) =>
    api.post<ChatResponse>(`/pipelines/${pipelineId}/chat`, { message }),

  chatHistory: (pipelineId: string) =>
    api.get<{ items: ChatTurn[] }>(`/pipelines/${pipelineId}/chat/history`),

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
      onSources?: (sources: ChatSource[]) => void;
      onToken?: (chunk: string) => void;
      onDone?: (finalAnswer: string) => void;
      onError?: (error: string, detail?: string) => void;
    },
    signal?: AbortSignal
  ): Promise<void> => {
    const token = useAuthStore.getState().accessToken;
    const resp = await fetch(`/api/pipelines/${pipelineId}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ message }),
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

    while (true) {
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

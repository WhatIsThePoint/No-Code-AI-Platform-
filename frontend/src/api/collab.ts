import api from "./axios";

export interface ChatMention {
  user_id: string;
  email: string | null;
  full_name: string | null;
}

export interface ChatMessage {
  id: string;
  pipeline_id: string;
  user_id: string;
  full_name: string | null;
  message: string;
  created_at: string;
  /** Sprint 7 Module 6 — server-resolved mentions extracted from message text. */
  mentioned_user_ids?: string[];
  mentions?: ChatMention[];
}

export type ExternalMeetingProvider =
  | "zoom"
  | "teams"
  | "jitsi"
  | "whereby"
  | "other";

export interface Meeting {
  meeting_id: string;
  pipeline_id: string;
  hangout_link: string;
  created_by: string;
  created_by_name?: string;
  start_at?: string;
  end_at?: string;
  provider?: ExternalMeetingProvider;
}

export const collabApi = {
  listMessages: (pipelineId: string, limit = 50) =>
    api.get<{ items: ChatMessage[] }>(
      `/pipelines/${pipelineId}/messages?limit=${limit}`
    ),

  createMeeting: (pipelineId: string, title?: string) =>
    api.post<Meeting>(`/pipelines/${pipelineId}/meetings`, {
      title: title ?? "Pipeline Collab Session",
    }),

  createExternalMeeting: (
    pipelineId: string,
    body: { url: string; provider?: ExternalMeetingProvider; title?: string }
  ) =>
    api.post<Meeting>(`/pipelines/${pipelineId}/meetings/external`, {
      url: body.url,
      provider: body.provider ?? "other",
      title: body.title ?? "Pipeline Collab Session",
    }),

  listMeetings: (pipelineId: string) =>
    api.get<Meeting[]>(`/pipelines/${pipelineId}/meetings`),

  googleLinkStatus: () =>
    api.get<{ configured: boolean; linked: boolean }>(`/auth/google/status`),

  googleLinkUrl: () =>
    api.get<{ authorization_url: string }>(`/auth/google/link`),

  googleUnlink: () => api.delete(`/auth/google/unlink`),
};

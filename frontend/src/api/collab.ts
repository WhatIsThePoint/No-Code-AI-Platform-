import api from "./axios";

export interface ChatMessage {
  id: string;
  pipeline_id: string;
  user_id: string;
  full_name: string | null;
  message: string;
  created_at: string;
}

export interface Meeting {
  meeting_id: string;
  pipeline_id: string;
  hangout_link: string;
  created_by: string;
  created_by_name?: string;
  start_at?: string;
  end_at?: string;
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

  listMeetings: (pipelineId: string) =>
    api.get<Meeting[]>(`/pipelines/${pipelineId}/meetings`),

  googleLinkStatus: () =>
    api.get<{ configured: boolean; linked: boolean }>(`/auth/google/status`),

  googleLinkUrl: () =>
    api.get<{ authorization_url: string }>(`/auth/google/link`),

  googleUnlink: () => api.delete(`/auth/google/unlink`),
};

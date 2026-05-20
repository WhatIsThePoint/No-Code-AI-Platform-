import api from "./axios";
import type {
  OwnerType,
  Pipeline,
  PipelineEdge,
  PipelineNode,
  PipelineType,
  StepNote,
} from "../types/pipeline";

export const pipelinesApi = {
  list: (params?: {
    owner_type?: OwnerType;
    company_id?: string;
    page?: number;
    limit?: number;
  }) =>
    api.get<{ items: Pipeline[]; total: number; page: number; limit: number }>(
      "/pipelines",
      { params }
    ),

  get: (id: string) => api.get<Pipeline>(`/pipelines/${id}`),

  create: (payload: {
    name: string;
    type?: PipelineType;
    owner_type: OwnerType;
    company_id?: string;
    nodes?: PipelineNode[];
    edges?: PipelineEdge[];
  }) => api.post<Pipeline>("/pipelines", payload),

  update: (
    id: string,
    payload: {
      name?: string;
      type?: PipelineType;
      nodes?: PipelineNode[];
      edges?: PipelineEdge[];
    }
  ) => api.put<Pipeline>(`/pipelines/${id}`, payload),

  delete: (id: string) => api.delete(`/pipelines/${id}`),

  startTraining: (
    pipelineId: string,
    payload: {
      algorithm: string;
      task_type: string;
      hyperparams: Record<string, number | string | boolean>;
      dataset_id: string;
      target_column?: string;
    }
  ) =>
    api.post<{ task_id: string; status: string }>(
      `/pipelines/${pipelineId}/train`,
      payload
    ),

  listNotes: (pipelineId: string, nodeId: string) =>
    api.get<{ items: StepNote[] }>(`/pipelines/${pipelineId}/nodes/${nodeId}/notes`),

  createNote: (pipelineId: string, nodeId: string, content: string) =>
    api.post<StepNote>(`/pipelines/${pipelineId}/nodes/${nodeId}/notes`, { content }),

  updateNote: (pipelineId: string, nodeId: string, noteId: string, content: string) =>
    api.patch<StepNote>(`/pipelines/${pipelineId}/nodes/${nodeId}/notes/${noteId}`, { content }),

  deleteNote: (pipelineId: string, nodeId: string, noteId: string) =>
    api.delete(`/pipelines/${pipelineId}/nodes/${nodeId}/notes/${noteId}`),
};

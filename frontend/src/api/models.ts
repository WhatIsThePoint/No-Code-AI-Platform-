import api from "./axios";
import type { ModelVersion } from "../types/model";

export const modelsApi = {
  listVersions: (pipelineId: string) =>
    api.get<{ items: ModelVersion[]; total: number }>(`/pipelines/${pipelineId}/models`),

  getVersion: (versionId: string) =>
    api.get<ModelVersion>(`/models/${versionId}`),

  downloadModel: (versionId: string): void => {
    // Trigger browser download via anchor tag (auth header forwarded via cookie on same origin)
    const link = document.createElement("a");
    link.href = `/api/models/${versionId}/download`;
    link.download = "";
    link.click();
  },

  deleteVersion: (versionId: string) =>
    api.delete(`/models/${versionId}`),
};

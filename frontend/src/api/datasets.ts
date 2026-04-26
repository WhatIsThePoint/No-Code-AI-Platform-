import api from "./axios";
import type { Dataset, PreprocessingConfig } from "../types/dataset";

export const datasetsApi = {
  list: (params?: { company_id?: string; page?: number; limit?: number }) =>
    api.get<{ items: Dataset[]; total: number; page: number; limit: number }>(
      "/datasets",
      { params }
    ),

  get: (id: string) => api.get<Dataset>(`/datasets/${id}`),

  upload: (file: File, opts?: { company_id?: string; description?: string }) => {
    const form = new FormData();
    form.append("file", file);
    if (opts?.company_id) form.append("company_id", opts.company_id);
    if (opts?.description) form.append("description", opts.description);
    return api.post<{ dataset_id: string; task_id: string; status: string }>(
      "/datasets/upload",
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  },

  sqlConnect: (payload: {
    db_type: "postgres" | "mysql";
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    query: string;
    company_id?: string;
    description?: string;
  }) => api.post<{ dataset_id: string; task_id: string }>("/datasets/sql-connect", payload),

  preview: (id: string, rows = 50) =>
    api.get<{ columns: string[]; rows: unknown[][]; total_rows: number }>(
      `/datasets/${id}/preview`,
      { params: { rows } }
    ),

  getProfile: (id: string) => api.get(`/datasets/${id}/profile`),

  preprocess: (id: string, config: PreprocessingConfig) =>
    api.post<{ task_id: string; status: string }>(`/datasets/${id}/preprocess`, config),

  delete: (id: string) => api.delete(`/datasets/${id}`),
};

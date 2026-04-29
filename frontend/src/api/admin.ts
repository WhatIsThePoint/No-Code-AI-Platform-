import api from "./axios";
import type {
  AdminUser,
  AdminCompany,
  AdminSubscription,
  AuditLog,
  PlatformStats,
  AdminAnnouncement,
  Paginated,
} from "../types/admin";

export const adminApi = {
  // Users
  listUsers: (params?: { q?: string; page?: number; limit?: number; is_active?: boolean }) =>
    api.get<Paginated<AdminUser>>("/admin/users", { params }),

  getUser: (userId: string) => api.get<AdminUser>(`/admin/users/${userId}`),

  updateUser: (userId: string, data: { is_active?: boolean; role?: string; tier?: string }) =>
    api.patch<AdminUser>(`/admin/users/${userId}`, data),

  deleteUser: (userId: string) => api.delete(`/admin/users/${userId}`),

  // Companies
  listCompanies: (params?: { q?: string; page?: number; limit?: number }) =>
    api.get<Paginated<AdminCompany>>("/admin/companies", { params }),

  deleteCompany: (companyId: string) => api.delete(`/admin/companies/${companyId}`),

  // Subscriptions
  listSubscriptions: (params?: { page?: number; limit?: number }) =>
    api.get<Paginated<AdminSubscription>>("/admin/subscriptions", { params }),

  overrideSubscription: (
    userId: string,
    plan: string,
    status?: string,
    quota?: { max_chunks?: number | null; max_vram_mb?: number | null },
  ) => {
    const body: Record<string, unknown> = { plan, status };
    if (quota && Object.prototype.hasOwnProperty.call(quota, "max_chunks")) {
      body.max_chunks = quota.max_chunks;
    }
    if (quota && Object.prototype.hasOwnProperty.call(quota, "max_vram_mb")) {
      body.max_vram_mb = quota.max_vram_mb;
    }
    return api.patch(`/admin/subscriptions/${userId}`, body);
  },

  // Logs
  listLogs: (params?: { action?: string; page?: number; limit?: number }) =>
    api.get<Paginated<AuditLog>>("/admin/logs", { params }),

  // Stats
  getStats: () => api.get<PlatformStats>("/admin/stats"),

  // Announcements
  listAnnouncements: () => api.get<AdminAnnouncement[]>("/admin/announcements"),

  createAnnouncement: (title: string, body: string, is_active?: boolean) =>
    api.post<{ id: string; title: string }>("/admin/announcements", { title, body, is_active }),

  updateAnnouncement: (id: string, data: { title?: string; body?: string; is_active?: boolean }) =>
    api.patch(`/admin/announcements/${id}`, data),

  deleteAnnouncement: (id: string) => api.delete(`/admin/announcements/${id}`),

  // ── Ops Console (live telemetry) ─────────────────────────────────────────
  getQueueDepths: () => api.get<QueueSnapshot>("/admin/system/queues"),
  getSystemHealth: () => api.get<SystemHealthSnapshot>("/admin/system/health"),

  getMigrationDrift: () =>
    api.get<MigrationDriftReport>("/admin/system/migration-drift"),

  getFailedLogins: (hours?: number) =>
    api.get<FailedLoginsReport>("/admin/security/failed-logins", {
      params: hours ? { hours } : undefined,
    }),

  exportUser: (userId: string) =>
    api.get(`/admin/users/${userId}/export.zip`, { responseType: "blob" }),

  impersonateUser: (userId: string) =>
    api.post<ImpersonationResponse>(`/admin/users/${userId}/impersonate`),

  endImpersonation: (userId: string) =>
    api.post<{ ok: boolean }>(`/admin/users/${userId}/impersonate/end`),
  listOllamaModels: () => api.get<OllamaModelList>("/admin/ollama/models"),
  deleteOllamaModel: (modelName: string) =>
    api.delete<{ deleted: string }>(
      `/admin/ollama/models/${encodeURIComponent(modelName)}`
    ),
};

export interface SystemHealthService {
  service: string;
  status: "up" | "down";
  latency_ms: number;
  message?: string;
}

export interface SystemHealthSnapshot {
  checked_at: number;
  all_up: boolean;
  up_count: number;
  total: number;
  services: SystemHealthService[];
}

export interface FailedLoginAttempt {
  id: string;
  ip_address: string | null;
  email: string | null;
  created_at: string;
}

export interface FailedLoginsReport {
  window_hours: number;
  since: string;
  total: number;
  top_ips: { ip_address: string; attempts: number }[];
  recent: FailedLoginAttempt[];
}

export interface ImpersonationResponse {
  access_token: string;
  expires_in: number;
  target: {
    user_id: string;
    email: string;
    full_name: string | null;
    role: "data_scientist" | "engineer" | "analyst" | "super_admin";
    tier: "free" | "solo" | "company" | "super_admin";
  };
}

export interface MigrationDriftReport {
  status: "ok" | "drift" | "unavailable";
  message?: string;
  tables_only_in_init_sql?: string[];
  tables_only_in_live_db?: string[];
  column_diffs?: {
    table: string;
    only_in_init_sql: string[];
    only_in_live_db: string[];
  }[];
  alembic_only_allowlist?: string[];
  init_sql_source?: string;
}

export interface QueueSnapshot {
  redis_ok: boolean;
  redis_error: string | null;
  queues: Record<string, number | null>;
  total_pending: number;
}

export interface OllamaModel {
  name: string;
  size_bytes: number;
  modified_at: string | null;
  digest: string | null;
  family: string | null;
  parameter_size: string | null;
  quantization: string | null;
}

export interface OllamaModelList {
  models: OllamaModel[];
  count: number;
}

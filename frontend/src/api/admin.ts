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

  overrideSubscription: (userId: string, plan: string, status?: string) =>
    api.patch(`/admin/subscriptions/${userId}`, { plan, status }),

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
};

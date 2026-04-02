import api from "./axios";
import type { LoginResponse, RegisterPayload, User } from "../types/auth";

export const authApi = {
  register: (payload: RegisterPayload) =>
    api.post<{ user_id: string; email: string }>("/auth/register", payload),

  login: (email: string, password: string) =>
    api.post<LoginResponse>("/auth/login", { email, password }),

  verify2FA: (session_token: string, code: string) =>
    api.post<LoginResponse>("/auth/2fa/verify", { session_token, code }),

  refresh: () => api.post<{ access_token: string }>("/auth/refresh"),

  logout: () => api.post("/auth/logout"),

  getMe: () => api.get<User>("/users/me"),

  updateMe: (payload: Partial<Pick<User, "full_name" | "role">>) =>
    api.patch<User>("/users/me", payload),

  enable2FA: () =>
    api.post<{ secret: string; qr_uri: string; qr_image_base64: string }>(
      "/auth/2fa/enable"
    ),

  confirm2FA: (code: string) => api.post("/auth/2fa/confirm", { code }),

  disable2FA: () => api.delete("/auth/2fa/disable"),
};

import axios from "axios";
import { useAuthStore } from "../store/authSlice";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true, // send cookies (refresh token)
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Request interceptor: attach access token ──────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: auto-refresh on 401 ────────────────────────────────
let _isRefreshing = false;
let _refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== "/auth/refresh"
    ) {
      if (_isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise((resolve) => {
          _refreshQueue.push((newToken: string) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      _isRefreshing = true;

      try {
        const { data } = await api.post<{ access_token: string }>("/auth/refresh");
        const newToken = data.access_token;
        useAuthStore.getState().setToken(newToken);

        // Drain queued requests
        _refreshQueue.forEach((cb) => cb(newToken));
        _refreshQueue = [];

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        useAuthStore.getState().clearAuth();
        _refreshQueue = [];
        window.location.replace("/login");
        return Promise.reject(error);
      } finally {
        _isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ── 429 retry-after handler ─────────────────────────────────────────────────
api.interceptors.response.use(undefined, async (error) => {
  const cfg = error.config;
  if (error.response?.status === 429 && !cfg._rateLimitRetried) {
    cfg._rateLimitRetried = true;
    const retryAfter = Number(error.response.headers["retry-after"]) || 2;
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return api(cfg);
  }
  return Promise.reject(error);
});

export default api;

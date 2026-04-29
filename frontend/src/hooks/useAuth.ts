import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { adminApi } from "../api/admin";
import { useAuthStore } from "../store/authSlice";

export function useAuth() {
  const { user, accessToken, isAuthenticated, setAuth, setToken, clearAuth } =
    useAuthStore();
  const navigate = useNavigate();

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await authApi.login(email, password);
      if (data.requires_2fa) {
        return { requires2FA: true, session_token: data.session_token };
      }
      // Store token first so the getMe() request can authenticate
      setToken(data.access_token!);
      const { data: userData } = await authApi.getMe();
      setAuth(userData, data.access_token!);
      return { requires2FA: false, user: userData };
    },
    [setAuth, setToken]
  );

  const logout = useCallback(async () => {
    // If the active session is an impersonation, "logout" should drop us back
    // into the super-admin's own session — not destroy it. Without this, an
    // admin who clicks Logout while viewing-as a user has no way back to the
    // admin dashboard short of signing in again.
    const imp = useAuthStore.getState().impersonation;
    if (imp) {
      useAuthStore.getState().endImpersonation();
      try {
        await adminApi.endImpersonation(imp.targetUserId);
      } catch {
        // Best-effort audit; original session is already restored client-side.
      }
      navigate("/admin");
      return;
    }
    try {
      await authApi.logout();
    } finally {
      clearAuth();
      navigate("/login");
    }
  }, [clearAuth, navigate]);

  const refreshUser = useCallback(async () => {
    const { data } = await authApi.getMe();
    if (accessToken) setAuth(data, accessToken);
  }, [accessToken, setAuth]);

  return { user, isAuthenticated, login, logout, refreshUser };
}

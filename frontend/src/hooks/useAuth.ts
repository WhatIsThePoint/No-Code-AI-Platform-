import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { useAuthStore } from "../store/authSlice";

export function useAuth() {
  const { user, accessToken, isAuthenticated, setAuth, clearAuth } =
    useAuthStore();
  const navigate = useNavigate();

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await authApi.login(email, password);
      if (data.requires_2fa) {
        return { requires2FA: true, session_token: data.session_token };
      }
      // Fetch full user profile
      const { data: userData } = await authApi.getMe();
      setAuth(userData, data.access_token!);
      return { requires2FA: false };
    },
    [setAuth]
  );

  const logout = useCallback(async () => {
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

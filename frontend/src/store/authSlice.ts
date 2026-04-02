import { create } from "zustand";
import type { User } from "../types/auth";

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setToken: (accessToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  setAuth: (user, accessToken) =>
    set({ user, accessToken, isAuthenticated: true }),

  setToken: (accessToken) => set({ accessToken }),

  clearAuth: () =>
    set({ user: null, accessToken: null, isAuthenticated: false }),
}));

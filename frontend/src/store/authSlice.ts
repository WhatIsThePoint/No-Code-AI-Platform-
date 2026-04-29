import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "../types/auth";

interface ImpersonationState {
  /** The super-admin's original token, restored on Exit. */
  originalAccessToken: string;
  /** The super-admin's own profile, restored on Exit. */
  originalUser: User;
  /** Wallclock seconds when the impersonation token expires. */
  expiresAt: number;
  /** Email shown in the banner. */
  targetEmail: string;
  /** User_id of the impersonated account — used to audit-log the End event. */
  targetUserId: string;
}

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  /** When set, the active session is a super-admin impersonating someone. */
  impersonation: ImpersonationState | null;
  setAuth: (user: User, accessToken: string) => void;
  setToken: (accessToken: string) => void;
  clearAuth: () => void;
  /** Swap the active token for an impersonation token. */
  startImpersonation: (
    target: User,
    accessToken: string,
    expiresInSeconds: number,
  ) => void;
  /** Restore the original super-admin token. */
  endImpersonation: () => ImpersonationState | null;
}

// Persisted in `sessionStorage` (not `localStorage`) so closing the tab still
// terminates the session — but a page refresh keeps the user logged in and,
// importantly, preserves an in-flight super-admin impersonation. Without this
// a refresh during impersonation would orphan the original token and force a
// full sign-out / sign-in cycle to recover.
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      impersonation: null,

      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true, impersonation: null }),

      setToken: (accessToken) => set({ accessToken }),

      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          impersonation: null,
        }),

      startImpersonation: (target, accessToken, expiresInSeconds) => {
        const state = get();
        if (!state.user || !state.accessToken) return;
        set({
          user: target,
          accessToken,
          isAuthenticated: true,
          impersonation: {
            originalAccessToken: state.accessToken,
            originalUser: state.user,
            expiresAt: Math.floor(Date.now() / 1000) + expiresInSeconds,
            targetEmail: target.email,
            targetUserId: target.id,
          },
        });
      },

      endImpersonation: () => {
        const state = get();
        const imp = state.impersonation;
        if (!imp) return null;
        set({
          user: imp.originalUser,
          accessToken: imp.originalAccessToken,
          isAuthenticated: true,
          impersonation: null,
        });
        return imp;
      },
    }),
    {
      name: "nocode-ai-auth",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
        impersonation: state.impersonation,
      }),
    },
  ),
);

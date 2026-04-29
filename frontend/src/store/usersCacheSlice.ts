import { create } from "zustand";
import api from "../api/axios";

interface PublicUser {
  user_id: string;
  full_name: string | null;
  email: string;
}

interface UsersCacheState {
  byId: Record<string, PublicUser | null>;
  inflight: Record<string, Promise<PublicUser | null> | undefined>;
  resolve: (userId: string | null | undefined) => Promise<PublicUser | null>;
  /** Synchronous read — returns the cached entry or null if not loaded yet. */
  get: (userId: string | null | undefined) => PublicUser | null;
  /** Pre-seed entries from a known source (e.g., company members). */
  seed: (users: PublicUser[]) => void;
}

export const useUsersCache = create<UsersCacheState>((set, get) => ({
  byId: {},
  inflight: {},
  get: (userId) => {
    if (!userId) return null;
    const cached = get().byId[userId];
    return cached ?? null;
  },
  seed: (users) =>
    set((s) => {
      const next = { ...s.byId };
      for (const u of users) next[u.user_id] = u;
      return { byId: next };
    }),
  resolve: async (userId) => {
    if (!userId) return null;
    const state = get();
    if (userId in state.byId) return state.byId[userId];
    if (state.inflight[userId]) return state.inflight[userId]!;
    const promise = (async () => {
      try {
        const { data } = await api.get<PublicUser>(`/users/public/${userId}`);
        set((s) => ({ byId: { ...s.byId, [userId]: data } }));
        return data;
      } catch {
        // Cache the miss so we don't retry on every render.
        set((s) => ({ byId: { ...s.byId, [userId]: null } }));
        return null;
      } finally {
        set((s) => {
          const next = { ...s.inflight };
          delete next[userId];
          return { inflight: next };
        });
      }
    })();
    set((s) => ({ inflight: { ...s.inflight, [userId]: promise } }));
    return promise;
  },
}));

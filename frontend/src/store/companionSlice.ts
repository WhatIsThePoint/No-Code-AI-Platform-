import { create } from "zustand";
import type { CompanionContext } from "../api/companion";

/**
 * Sprint 7 Module 4 — shared store the persistent Companion FAB reads
 * to find out what the user is currently looking at, so its answers can
 * be tailored to the active screen instead of generic.
 *
 * Pages call `useCompanionStore.getState().setContext({...})` (or the
 * `useReportCompanionContext` hook below) to publish their state. The
 * FAB grabs the latest snapshot at send-time.
 */
interface CompanionStore {
  context: CompanionContext;
  setContext: (ctx: CompanionContext) => void;
  clearContext: () => void;
  /** Shallow-merge extra fields into the current pipeline context (canvas → page bridge). */
  mergePipelineExtras: (extras: NonNullable<CompanionContext["pipeline"]>) => void;
  /** Replace the recent_errors buffer. Pass [] to clear. */
  setRecentErrors: (errors: string[]) => void;
}

export const useCompanionStore = create<CompanionStore>((set) => ({
  context: {},
  setContext: (ctx) => set({ context: ctx }),
  clearContext: () => set({ context: {} }),
  mergePipelineExtras: (extras) =>
    set((state) => ({
      context: {
        ...state.context,
        pipeline: { ...(state.context.pipeline ?? {}), ...extras },
      },
    })),
  setRecentErrors: (errors) =>
    set((state) => ({ context: { ...state.context, recent_errors: errors } })),
}));

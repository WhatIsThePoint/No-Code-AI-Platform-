import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NotificationKind =
  | "chat_message"
  | "mention"
  | "training_done"
  | "training_failed"
  | "document_indexed"
  | "meeting_started"
  | "info"
  | "warning";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  /** ISO timestamp. */
  created_at: string;
  /** Optional click target — internal route. */
  href?: string;
  /** Pipeline / dataset / etc. id this notification belongs to. */
  ref_id?: string;
  read: boolean;
}

interface NotificationsState {
  items: AppNotification[];
  push: (n: Omit<AppNotification, "id" | "created_at" | "read"> & {
    id?: string;
    created_at?: string;
  }) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
  /** Keep at most this many — the drawer is for recent context, not a permanent log. */
  cap: number;
}

const MAX = 50;

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useNotifications = create<NotificationsState>()(
  persist(
    (set) => ({
      items: [],
      cap: MAX,
      push: (n) =>
        set((s) => {
          const entry: AppNotification = {
            id: n.id ?? makeId(),
            kind: n.kind,
            title: n.title,
            body: n.body,
            created_at: n.created_at ?? new Date().toISOString(),
            href: n.href,
            ref_id: n.ref_id,
            read: false,
          };
          const next = [entry, ...s.items.filter((x) => x.id !== entry.id)];
          return { items: next.slice(0, MAX) };
        }),
      markRead: (id) =>
        set((s) => ({
          items: s.items.map((it) => (it.id === id ? { ...it, read: true } : it)),
        })),
      markAllRead: () =>
        set((s) => ({ items: s.items.map((it) => ({ ...it, read: true })) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "ncai-notifications",
      // Persist only the items array; cap is a constant.
      partialize: (s) => ({ items: s.items }),
    },
  ),
);

export const unreadCountSelector = (s: NotificationsState): number =>
  s.items.reduce((n, it) => n + (it.read ? 0 : 1), 0);

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "default" | "highContrast";

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: "default",
      setMode: (mode) => set({ mode }),
      toggle: () =>
        set({ mode: get().mode === "highContrast" ? "default" : "highContrast" }),
    }),
    { name: "ncai-theme" },
  ),
);

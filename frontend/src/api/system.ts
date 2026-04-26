import api from "./axios";

export type HardwareProfile =
  | "high"
  | "mid"
  | "low"
  | "cpu_mid"
  | "cpu_low";

export interface HardwareSnapshot {
  gpu_detected: boolean;
  gpu: { name: string; total_mb: number; free_mb: number } | null;
  ram: { total_mb: number; free_mb: number };
  profile: HardwareProfile;
  recommended_top_k: number;
  max_top_k: number;
}

export const systemApi = {
  getHardware: () => api.get<HardwareSnapshot>("/system/hardware"),
};

let _cache: Promise<HardwareSnapshot> | null = null;

/** Module-level cache so every RAGConfigNode shares a single GET. */
export function fetchHardwareOnce(): Promise<HardwareSnapshot> {
  if (!_cache) {
    _cache = systemApi
      .getHardware()
      .then((r) => r.data)
      .catch((err) => {
        // Reset so a later call can retry; surface a conservative fallback.
        _cache = null;
        throw err;
      });
  }
  return _cache;
}

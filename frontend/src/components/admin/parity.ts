// Shared Parity design tokens for the Admin Ops Console panels.
// Mirrors the local constants inside AdminPage.tsx so the three new panels
// stay visually consistent without re-defining the palette in each file.

export const P = {
  paper: "#fafaf7",
  paper2: "#f3f2ec",
  paper3: "#ebeae3",
  ink: "#0b0d0e",
  ink2: "#2a2e31",
  ink3: "#4a4e51",
  rule: "#d8d5c7",
  ruleSoft: "#e8e6dd",
  muted: "#6b6b63",
  muted2: "#8a8a80",
  accent: "#d2541c",
  accentInk: "#b94612",
  accentSoft: "#f5e7d8",
  ok: "#2f6f3e",
  okSoft: "#e1ecdf",
  bad: "#b54141",
  badSoft: "#f1dcdc",
} as const;

export const MONO =
  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "—";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / 1024 ** 2;
  return `${mb.toFixed(0)} MB`;
}

export function formatMb(mb: number): string {
  return `${(mb / 1024).toFixed(1)} GB`;
}

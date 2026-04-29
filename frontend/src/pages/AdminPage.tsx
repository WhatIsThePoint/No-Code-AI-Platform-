import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/SearchRounded";
import BlockIcon from "@mui/icons-material/BlockRounded";
import CheckCircleIcon from "@mui/icons-material/CheckCircleRounded";
import DeleteIcon from "@mui/icons-material/DeleteOutlineRounded";
import AddIcon from "@mui/icons-material/AddRounded";
import RefreshIcon from "@mui/icons-material/RefreshRounded";
import PaymentIcon from "@mui/icons-material/PaymentRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import { useNavigate } from "react-router-dom";
import { adminApi } from "../api/admin";
import type { User } from "../types/auth";
import type {
  AdminUser,
  AuditLog,
  PlatformStats,
  AdminAnnouncement,
} from "../types/admin";
import type { PlanId, SubscriptionStatus } from "../types/billing";
import { useAuthStore } from "../store/authSlice";
import { QueueMonitorPanel } from "../components/admin/QueueMonitorPanel";
import { LiveHardwarePanel } from "../components/admin/LiveHardwarePanel";
import { ModelRegistryPanel } from "../components/admin/ModelRegistryPanel";
import { HealthcheckPanel } from "../components/admin/HealthcheckPanel";
import { FailedLoginsPanel } from "../components/admin/FailedLoginsPanel";
import { MigrationDriftPanel } from "../components/admin/MigrationDriftPanel";
import { ConfirmDialog } from "../components/common/ConfirmDialog";

// ────────────────────────────────────────────────────────────
// Parity design tokens — editorial paper/ink palette.
// Kept as constants (not a theme override) so this page doesn't
// leak into the rest of the MUI app.
// ────────────────────────────────────────────────────────────
const P = {
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

const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

const STAT_TILES: {
  key: keyof PlatformStats;
  label: string;
  foot: string;
}[] = [
  { key: "total_users", label: "Total users", foot: "All accounts" },
  { key: "active_users", label: "Active", foot: "Not suspended" },
  { key: "suspended_users", label: "Suspended", foot: "Blocked logins" },
  { key: "total_companies", label: "Collaborators", foot: "Workspaces" },
  { key: "paid_subscriptions", label: "Paid subs", foot: "solo + collab" },
];

const PLAN_OPTIONS: { value: PlanId; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "solo_monthly", label: "Solo · monthly" },
  { value: "solo_yearly", label: "Solo · yearly" },
  { value: "company_monthly", label: "Collaborator · monthly" },
  { value: "company_yearly", label: "Collaborator · yearly" },
];

const STATUS_OPTIONS: { value: SubscriptionStatus; label: string }[] = [
  { value: "active", label: "active" },
  { value: "trialing", label: "trialing" },
  { value: "past_due", label: "past_due" },
  { value: "canceled", label: "canceled" },
  { value: "incomplete", label: "incomplete" },
];

function StatTile({
  label,
  value,
  foot,
}: {
  label: string;
  value: number | undefined;
  foot: string;
}) {
  return (
    <Box
      sx={{
        p: "20px 22px",
        borderRight: `1px solid ${P.rule}`,
        "&:last-of-type": { borderRight: 0 },
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        bgcolor: P.paper,
      }}
    >
      <Box
        sx={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: P.muted2,
        }}
      >
        {label}
      </Box>
      <Box
        sx={{
          fontFamily: MONO,
          fontSize: 26,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: P.ink,
          lineHeight: 1.1,
        }}
      >
        {value ?? "—"}
      </Box>
      <Box
        sx={{
          fontFamily: MONO,
          fontSize: 10,
          color: P.muted,
        }}
      >
        {foot}
      </Box>
    </Box>
  );
}

function ParityChip({
  label,
  tone = "neutral",
  onClick,
}: {
  label: string;
  tone?: "neutral" | "ok" | "bad" | "accent";
  onClick?: () => void;
}) {
  const palettes: Record<string, { bg: string; fg: string; border: string }> = {
    neutral: { bg: P.paper2, fg: P.ink2, border: P.rule },
    ok: { bg: P.okSoft, fg: P.ok, border: P.ok },
    bad: { bg: P.badSoft, fg: P.bad, border: P.bad },
    accent: { bg: P.accentSoft, fg: P.accentInk, border: P.accent },
  };
  const c = palettes[tone];
  return (
    <Box
      component="span"
      onClick={onClick}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: "8px",
        py: "2px",
        fontFamily: MONO,
        fontSize: 10,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: c.fg,
        bgcolor: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: "2px",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {label}
    </Box>
  );
}

const parityButton = (variant: "primary" | "ghost" | "danger" = "ghost") => {
  const base = {
    px: "12px",
    py: "6px",
    minHeight: 32,
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: "-0.005em",
    textTransform: "none" as const,
    borderRadius: "2px",
    boxShadow: "none",
    "&:hover": { boxShadow: "none" },
  };
  if (variant === "primary") {
    return {
      ...base,
      bgcolor: P.ink,
      color: P.paper,
      border: `1px solid ${P.ink}`,
      "&:hover": { bgcolor: P.accent, borderColor: P.accent, boxShadow: "none" },
    };
  }
  if (variant === "danger") {
    return {
      ...base,
      bgcolor: "transparent",
      color: P.bad,
      border: `1px solid ${P.rule}`,
      "&:hover": { bgcolor: P.badSoft, borderColor: P.bad, boxShadow: "none" },
    };
  }
  return {
    ...base,
    bgcolor: "transparent",
    color: P.ink,
    border: `1px solid ${P.rule}`,
    "&:hover": { borderColor: P.ink, bgcolor: "transparent", boxShadow: "none" },
  };
};

const parityTextField = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "2px",
    bgcolor: P.paper,
    fontFamily: MONO,
    fontSize: 12,
    "& fieldset": { borderColor: P.rule },
    "&:hover fieldset": { borderColor: P.ink2 },
    "&.Mui-focused fieldset": { borderColor: P.ink, borderWidth: 1 },
  },
  "& .MuiInputLabel-root": {
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: P.muted,
    "&.Mui-focused": { color: P.ink },
  },
};

export function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userTotal, setUserTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);

  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [annLoading, setAnnLoading] = useState(false);

  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    tone: "success" | "error";
  }>({ open: false, msg: "", tone: "success" });

  const [annDialog, setAnnDialog] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");

  const [subDialog, setSubDialog] = useState<{
    open: boolean;
    userId: string | null;
    plan: PlanId;
    status: SubscriptionStatus;
    // Quota overrides — empty string means "clear the override".
    maxChunks: string;
    maxVramMb: string;
    // Snapshot of the values originally loaded so we only PATCH dirty fields.
    initialMaxChunks: string;
    initialMaxVramMb: string;
  }>({
    open: false,
    userId: null,
    plan: "free",
    status: "active",
    maxChunks: "",
    maxVramMb: "",
    initialMaxChunks: "",
    initialMaxVramMb: "",
  });

  // Single confirm-dialog slot driven by whichever destructive action armed
  // it last. The action's actual work lives on `onConfirm`, which we run
  // through a busy flag so a slow API call can't be re-clicked into a
  // double-mutation.
  const [confirm, setConfirm] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmText?: string;
    confirmLabel?: string;
    busy: boolean;
    onConfirm: () => Promise<void>;
  }>({
    open: false,
    title: "",
    description: "",
    busy: false,
    onConfirm: async () => undefined,
  });

  const closeConfirm = () =>
    setConfirm((prev) => (prev.busy ? prev : { ...prev, open: false }));

  const runConfirm = async () => {
    setConfirm((prev) => ({ ...prev, busy: true }));
    try {
      await confirm.onConfirm();
    } finally {
      setConfirm((prev) => ({ ...prev, open: false, busy: false }));
    }
  };

  const showSnack = (msg: string, tone: "success" | "error" = "success") =>
    setSnack({ open: true, msg, tone });

  const loadStatsAndLogs = () => {
    adminApi
      .getStats()
      .then((r) => setStats(r.data))
      .catch(() => {});
    setLogsLoading(true);
    adminApi
      .listLogs({ limit: 100 })
      .then((r) => setLogs(r.data.items))
      .finally(() => setLogsLoading(false));
  };

  useEffect(() => {
    if (tab === 0) loadStatsAndLogs();
  }, [tab]);

  useEffect(() => {
    if (tab !== 1) return;
    setUsersLoading(true);
    adminApi
      .listUsers({ q: userSearch })
      .then((r) => {
        setUsers(r.data.items);
        setUserTotal(r.data.total);
      })
      .finally(() => setUsersLoading(false));
  }, [tab, userSearch]);

  useEffect(() => {
    if (tab !== 2) return;
    setAnnLoading(true);
    adminApi
      .listAnnouncements()
      .then((r) => setAnnouncements(r.data))
      .finally(() => setAnnLoading(false));
  }, [tab]);

  const filteredUsers = useMemo(() => users, [users]);

  if (user?.role !== "super_admin") {
    return (
      <Box sx={{ p: 4, bgcolor: P.paper, minHeight: "80vh" }}>
        <Alert
          severity="error"
          sx={{
            borderRadius: "2px",
            bgcolor: P.badSoft,
            color: P.bad,
            border: `1px solid ${P.bad}`,
            fontFamily: MONO,
            fontSize: 12,
          }}
        >
          Access denied · super_admin role required.
        </Alert>
      </Box>
    );
  }

  const handleSuspend = async (userId: string, isActive: boolean) => {
    try {
      await adminApi.updateUser(userId, { is_active: !isActive });
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === userId ? { ...u, is_active: !isActive } : u
        )
      );
      showSnack(isActive ? "User suspended" : "User reactivated");
    } catch {
      showSnack("Action failed", "error");
    }
  };

  const handleDeleteUser = (userId: string) => {
    const target = users.find((u) => u.user_id === userId);
    const email = target?.email ?? userId;
    setConfirm({
      open: true,
      title: "Delete user",
      description: `This permanently removes ${email} and all of their datasets, pipelines, and trained models. This cannot be undone.`,
      // Typed-confirmation gate: the user has to retype the email so a
      // mis-clicked Delete on a row two below the intended one can't go through.
      confirmText: email,
      confirmLabel: "Delete user",
      busy: false,
      onConfirm: async () => {
        try {
          await adminApi.deleteUser(userId);
          setUsers((prev) => prev.filter((u) => u.user_id !== userId));
          showSnack("User deleted");
        } catch {
          showSnack("Delete failed", "error");
        }
      },
    });
  };

  const handleImpersonate = async (u: AdminUser) => {
    try {
      const { data } = await adminApi.impersonateUser(u.user_id);
      const targetUser: User = {
        id: data.target.user_id,
        email: data.target.email,
        full_name: data.target.full_name,
        role: data.target.role,
        tier: data.target.tier,
        totp_enabled: false,
        created_at: new Date().toISOString(),
      };
      useAuthStore.getState().startImpersonation(
        targetUser,
        data.access_token,
        data.expires_in,
      );
      showSnack("Now viewing as " + u.email);
      navigate("/dashboard");
    } catch {
      showSnack("Could not start the impersonation session", "error");
    }
  };

  const handleExportUser = async (u: AdminUser) => {
    try {
      const res = await adminApi.exportUser(u.user_id);
      const blob =
        res.data instanceof Blob
          ? res.data
          : new Blob([res.data as BlobPart], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeEmail = u.email.replace(/[^a-zA-Z0-9._-]+/g, "_");
      a.href = url;
      a.download = `user_${safeEmail}_export.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showSnack("Export downloaded");
    } catch {
      showSnack("Export failed", "error");
    }
  };

  const closeSubDialog = () =>
    setSubDialog({
      open: false,
      userId: null,
      plan: "free",
      status: "active",
      maxChunks: "",
      maxVramMb: "",
      initialMaxChunks: "",
      initialMaxVramMb: "",
    });

  const openSubDialog = async (u: AdminUser) => {
    const guessPlan: PlanId =
      u.tier === "company"
        ? "company_monthly"
        : u.tier === "solo"
        ? "solo_monthly"
        : "free";
    // Hydrate quota fields from the user's current subscription so the
    // dialog shows what's already been overridden, not blanks.
    let chunks = "";
    let vram = "";
    try {
      const { data } = await adminApi.getUser(u.user_id);
      const sub = (data as unknown as { subscription?: { max_chunks: number | null; max_vram_mb: number | null } }).subscription;
      if (sub?.max_chunks != null) chunks = String(sub.max_chunks);
      if (sub?.max_vram_mb != null) vram = String(sub.max_vram_mb);
    } catch {
      /* fall back to blank — admin can still set fresh values */
    }
    setSubDialog({
      open: true,
      userId: u.user_id,
      plan: guessPlan,
      status: "active",
      maxChunks: chunks,
      maxVramMb: vram,
      initialMaxChunks: chunks,
      initialMaxVramMb: vram,
    });
  };

  const parseQuota = (raw: string): { provided: boolean; value: number | null; valid: boolean } => {
    const trimmed = raw.trim();
    if (trimmed === "") return { provided: true, value: null, valid: true };
    const n = Number(trimmed);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      return { provided: true, value: null, valid: false };
    }
    return { provided: true, value: n, valid: true };
  };

  const submitSubOverride = async () => {
    if (!subDialog.userId) return;
    const quota: { max_chunks?: number | null; max_vram_mb?: number | null } = {};
    if (subDialog.maxChunks !== subDialog.initialMaxChunks) {
      const parsed = parseQuota(subDialog.maxChunks);
      if (!parsed.valid) {
        showSnack("Max chunks must be a non-negative integer", "error");
        return;
      }
      quota.max_chunks = parsed.value;
    }
    if (subDialog.maxVramMb !== subDialog.initialMaxVramMb) {
      const parsed = parseQuota(subDialog.maxVramMb);
      if (!parsed.valid) {
        showSnack("Max VRAM (MB) must be a non-negative integer", "error");
        return;
      }
      quota.max_vram_mb = parsed.value;
    }
    try {
      await adminApi.overrideSubscription(
        subDialog.userId,
        subDialog.plan,
        subDialog.status,
        quota,
      );
      showSnack("Subscription overridden");
      closeSubDialog();
      const r = await adminApi.listUsers({ q: userSearch });
      setUsers(r.data.items);
    } catch {
      showSnack("Override failed", "error");
    }
  };

  const handleToggleAnnouncement = async (id: string, isActive: boolean) => {
    try {
      await adminApi.updateAnnouncement(id, { is_active: !isActive });
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_active: !isActive } : a))
      );
    } catch {
      showSnack("Update failed", "error");
    }
  };

  const handleDeleteAnnouncement = (id: string) => {
    const target = announcements.find((a) => a.id === id);
    const titleSnippet = target?.title?.trim() || "this announcement";
    setConfirm({
      open: true,
      title: "Delete announcement",
      description: `Remove "${titleSnippet}"? Users currently seeing this banner will stop seeing it on their next page load.`,
      confirmLabel: "Delete",
      busy: false,
      onConfirm: async () => {
        try {
          await adminApi.deleteAnnouncement(id);
          setAnnouncements((prev) => prev.filter((a) => a.id !== id));
          showSnack("Announcement deleted");
        } catch {
          showSnack("Delete failed", "error");
        }
      },
    });
  };

  const handleCreateAnn = async () => {
    if (!annTitle.trim() || !annBody.trim()) return;
    try {
      await adminApi.createAnnouncement(annTitle.trim(), annBody.trim(), true);
      setAnnDialog(false);
      setAnnTitle("");
      setAnnBody("");
      const r = await adminApi.listAnnouncements();
      setAnnouncements(r.data);
      showSnack("Announcement created");
    } catch {
      showSnack("Failed to create announcement", "error");
    }
  };

  return (
    <Box
      sx={{
        bgcolor: P.paper,
        color: P.ink,
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        minHeight: "100vh",
        mx: -3,
        my: -3,
        px: 4,
        py: 4,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          pb: 3,
          borderBottom: `1px solid ${P.rule}`,
          mb: 3,
        }}
      >
        <Box>
          <Box
            sx={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: P.accentInk,
              mb: 1,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              "&::before": {
                content: '""',
                display: "inline-block",
                width: 6,
                height: 6,
                bgcolor: P.accent,
                borderRadius: "50%",
              },
            }}
          >
            § Super admin
          </Box>
          <Typography
            sx={{
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              color: P.ink,
              lineHeight: 1.1,
            }}
          >
            Control room
          </Typography>
          <Typography
            sx={{
              mt: 0.5,
              fontSize: 13,
              color: P.muted,
            }}
          >
            Platform operators only · all actions are audit-logged.
          </Typography>
        </Box>
        <Button
          size="small"
          startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
          onClick={loadStatsAndLogs}
          sx={parityButton("ghost")}
        >
          Refresh
        </Button>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          minHeight: 36,
          borderBottom: `1px solid ${P.rule}`,
          mb: 3,
          "& .MuiTabs-indicator": {
            bgcolor: P.accent,
            height: 2,
          },
          "& .MuiTab-root": {
            minHeight: 36,
            px: 0,
            mr: 4,
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: P.muted,
            "&.Mui-selected": { color: P.ink },
          },
        }}
      >
        <Tab label="Stats & Logs" />
        <Tab label="User Management" />
        <Tab label="Announcements" />
        <Tab label="Ops Console" />
      </Tabs>

      {/* ─── Tab 3: Ops Console (live telemetry) ─── */}
      {tab === 3 && (
        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            alignItems: "start",
          }}
        >
          <LiveHardwarePanel />
          <QueueMonitorPanel />
          <Box sx={{ gridColumn: { xs: "1", md: "1 / -1" } }}>
            <HealthcheckPanel />
          </Box>
          <Box sx={{ gridColumn: { xs: "1", md: "1 / -1" } }}>
            <FailedLoginsPanel />
          </Box>
          <Box sx={{ gridColumn: { xs: "1", md: "1 / -1" } }}>
            <MigrationDriftPanel />
          </Box>
          <Box sx={{ gridColumn: { xs: "1", md: "1 / -1" } }}>
            <ModelRegistryPanel />
          </Box>
        </Box>
      )}

      {/* ─── Tab 0: Stats & Logs ─── */}
      {tab === 0 && (
        <Box>
          {/* Stats strip */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(2, 1fr)",
                sm: "repeat(3, 1fr)",
                md: "repeat(5, 1fr)",
              },
              border: `1px solid ${P.rule}`,
              bgcolor: P.paper,
              mb: 4,
            }}
          >
            {STAT_TILES.map((t) => (
              <StatTile
                key={t.key}
                label={t.label}
                value={stats?.[t.key]}
                foot={t.foot}
              />
            ))}
          </Box>

          {/* Audit logs table */}
          <Box
            sx={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              pb: 1.5,
              mb: 1.5,
              borderBottom: `1px solid ${P.rule}`,
            }}
          >
            <Box
              sx={{
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: P.muted,
              }}
            >
              Audit log · last 100
            </Box>
            <Box
              sx={{
                fontFamily: MONO,
                fontSize: 11,
                color: P.muted,
              }}
            >
              {logs.length} events
            </Box>
          </Box>

          {logsLoading ? (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <CircularProgress size={18} sx={{ color: P.ink }} />
            </Box>
          ) : logs.length === 0 ? (
            <Box
              sx={{
                py: 6,
                textAlign: "center",
                fontFamily: MONO,
                fontSize: 12,
                color: P.muted,
                border: `1px dashed ${P.rule}`,
              }}
            >
              No audit events yet.
            </Box>
          ) : (
            <Box sx={{ border: `1px solid ${P.rule}`, bgcolor: P.paper }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "180px 180px 1fr 140px",
                  bgcolor: P.paper2,
                  borderBottom: `1px solid ${P.rule}`,
                  fontFamily: MONO,
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: P.muted,
                  "& > div": {
                    p: "10px 14px",
                    borderRight: `1px solid ${P.rule}`,
                  },
                  "& > div:last-of-type": { borderRight: 0 },
                }}
              >
                <Box>Time</Box>
                <Box>Action</Box>
                <Box>Target</Box>
                <Box>IP</Box>
              </Box>
              {logs.map((l) => (
                <Box
                  key={l.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "180px 180px 1fr 140px",
                    borderBottom: `1px solid ${P.ruleSoft}`,
                    "&:last-of-type": { borderBottom: 0 },
                    "&:hover": { bgcolor: P.paper2 },
                    "& > div": {
                      p: "10px 14px",
                      borderRight: `1px solid ${P.ruleSoft}`,
                      fontFamily: MONO,
                      fontSize: 11,
                      color: P.ink2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                    "& > div:last-of-type": { borderRight: 0 },
                  }}
                >
                  <Box>{new Date(l.created_at).toLocaleString()}</Box>
                  <Box sx={{ color: `${P.accentInk} !important` }}>
                    {l.action}
                  </Box>
                  <Box>
                    {l.target_type && l.target_id
                      ? `${l.target_type}:${l.target_id.slice(0, 8)}`
                      : "—"}
                  </Box>
                  <Box>{l.ip_address ?? "—"}</Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* ─── Tab 1: User Management ─── */}
      {tab === 1 && (
        <Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 2,
              gap: 2,
            }}
          >
            <TextField
              size="small"
              placeholder="Search email or name…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              sx={{ ...parityTextField, width: 360 }}
              InputProps={{
                startAdornment: (
                  <SearchIcon
                    sx={{ fontSize: 16, color: P.muted, mr: 1 }}
                  />
                ),
              }}
            />
            <Box
              sx={{
                fontFamily: MONO,
                fontSize: 11,
                color: P.muted,
              }}
            >
              {userTotal} user{userTotal === 1 ? "" : "s"} total
            </Box>
          </Box>

          {usersLoading ? (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <CircularProgress size={18} sx={{ color: P.ink }} />
            </Box>
          ) : (
            <Box sx={{ border: `1px solid ${P.rule}`, bgcolor: P.paper }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(220px, 2fr) minmax(140px, 1.2fr) 110px 120px 110px 180px",
                  bgcolor: P.paper2,
                  borderBottom: `1px solid ${P.rule}`,
                  fontFamily: MONO,
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: P.muted,
                  "& > div": {
                    p: "10px 14px",
                    borderRight: `1px solid ${P.rule}`,
                  },
                  "& > div:last-of-type": { borderRight: 0 },
                }}
              >
                <Box>Email</Box>
                <Box>Name</Box>
                <Box>Role</Box>
                <Box>Tier</Box>
                <Box>Status</Box>
                <Box>Actions</Box>
              </Box>
              {filteredUsers.length === 0 ? (
                <Box
                  sx={{
                    p: 6,
                    textAlign: "center",
                    fontFamily: MONO,
                    fontSize: 12,
                    color: P.muted,
                  }}
                >
                  No users match.
                </Box>
              ) : (
                filteredUsers.map((u) => (
                  <Box
                    key={u.user_id}
                    sx={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(220px, 2fr) minmax(140px, 1.2fr) 110px 120px 110px 180px",
                      borderBottom: `1px solid ${P.ruleSoft}`,
                      "&:last-of-type": { borderBottom: 0 },
                      "&:hover": { bgcolor: P.paper2 },
                      "& > div": {
                        p: "10px 14px",
                        borderRight: `1px solid ${P.ruleSoft}`,
                        fontSize: 12,
                        color: P.ink2,
                        display: "flex",
                        alignItems: "center",
                        overflow: "hidden",
                      },
                      "& > div:last-of-type": { borderRight: 0 },
                    }}
                  >
                    <Box
                      sx={{
                        fontFamily: MONO,
                        color: `${P.ink} !important`,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {u.email}
                    </Box>
                    <Box
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {u.full_name ?? "—"}
                    </Box>
                    <Box>
                      <ParityChip
                        label={u.role}
                        tone={u.role === "super_admin" ? "accent" : "neutral"}
                      />
                    </Box>
                    <Box>
                      <ParityChip
                        label={u.tier === "company" ? "collaborator" : u.tier}
                      />
                    </Box>
                    <Box>
                      <ParityChip
                        label={u.is_active ? "active" : "suspended"}
                        tone={u.is_active ? "ok" : "bad"}
                      />
                    </Box>
                    <Box sx={{ gap: "4px" }}>
                      <Tooltip
                        title={u.is_active ? "Suspend" : "Reactivate"}
                        arrow
                      >
                        <IconButton
                          size="small"
                          onClick={() => handleSuspend(u.user_id, u.is_active)}
                          aria-label={u.is_active ? "Suspend user" : "Reactivate user"}
                          sx={{
                            borderRadius: "2px",
                            color: u.is_active ? P.bad : P.ok,
                          }}
                        >
                          {u.is_active ? (
                            <BlockIcon sx={{ fontSize: 16 }} />
                          ) : (
                            <CheckCircleIcon sx={{ fontSize: 16 }} />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Override subscription" arrow>
                        <IconButton
                          size="small"
                          onClick={() => openSubDialog(u)}
                          aria-label="Override subscription"
                          sx={{ borderRadius: "2px", color: P.accentInk }}
                        >
                          <PaymentIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View as user" arrow>
                        <IconButton
                          size="small"
                          onClick={() => handleImpersonate(u)}
                          aria-label="View as user"
                          disabled={u.user_id === user?.id || !u.is_active}
                          sx={{ borderRadius: "2px", color: P.accentInk }}
                        >
                          <VisibilityRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Export user data (GDPR)" arrow>
                        <IconButton
                          size="small"
                          onClick={() => handleExportUser(u)}
                          aria-label="Export user data"
                          sx={{ borderRadius: "2px", color: P.ink2 }}
                        >
                          <DownloadRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete" arrow>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteUser(u.user_id)}
                          aria-label="Delete user"
                          sx={{ borderRadius: "2px", color: P.bad }}
                        >
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                ))
              )}
            </Box>
          )}
        </Box>
      )}

      {/* ─── Tab 2: Announcements ─── */}
      {tab === 2 && (
        <Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 2,
            }}
          >
            <Box
              sx={{
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: P.muted,
              }}
            >
              {announcements.length} announcement
              {announcements.length === 1 ? "" : "s"}
            </Box>
            <Button
              startIcon={<AddIcon sx={{ fontSize: 14 }} />}
              onClick={() => setAnnDialog(true)}
              sx={parityButton("primary")}
            >
              New announcement
            </Button>
          </Box>

          {annLoading ? (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <CircularProgress size={18} sx={{ color: P.ink }} />
            </Box>
          ) : announcements.length === 0 ? (
            <Box
              sx={{
                py: 6,
                textAlign: "center",
                fontFamily: MONO,
                fontSize: 12,
                color: P.muted,
                border: `1px dashed ${P.rule}`,
              }}
            >
              No announcements.
            </Box>
          ) : (
            <Box
              sx={{
                border: `1px solid ${P.rule}`,
                borderBottom: 0,
                bgcolor: P.paper,
              }}
            >
              {announcements.map((a) => (
                <Box
                  key={a.id}
                  sx={{
                    p: "20px 22px",
                    borderBottom: `1px solid ${P.rule}`,
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 2,
                    alignItems: "flex-start",
                    "&:hover": { bgcolor: P.paper2 },
                  }}
                >
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
                      <Typography
                        sx={{
                          fontSize: 15,
                          fontWeight: 600,
                          letterSpacing: "-0.01em",
                          color: P.ink,
                        }}
                      >
                        {a.title}
                      </Typography>
                      <ParityChip
                        label={a.is_active ? "active" : "hidden"}
                        tone={a.is_active ? "ok" : "neutral"}
                        onClick={() =>
                          handleToggleAnnouncement(a.id, a.is_active)
                        }
                      />
                    </Box>
                    <Typography
                      sx={{
                        fontSize: 13,
                        color: P.muted,
                        lineHeight: 1.55,
                        mb: 1,
                      }}
                    >
                      {a.body}
                    </Typography>
                    <Box
                      sx={{
                        fontFamily: MONO,
                        fontSize: 10,
                        color: P.muted2,
                      }}
                    >
                      {a.created_at
                        ? new Date(a.created_at).toLocaleString()
                        : ""}
                    </Box>
                  </Box>
                  <Tooltip title="Delete" arrow>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteAnnouncement(a.id)}
                      aria-label="Delete announcement"
                      sx={{ borderRadius: "2px", color: P.bad }}
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* ─── Create announcement dialog ─── */}
      <Dialog
        open={annDialog}
        onClose={() => setAnnDialog(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: "2px",
            bgcolor: P.paper,
            border: `1px solid ${P.rule}`,
            boxShadow: "none",
          },
        }}
      >
        <DialogTitle
          sx={{
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: P.ink,
            borderBottom: `1px solid ${P.rule}`,
            px: 3,
            py: 2,
          }}
        >
          New announcement
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: "20px !important", pb: 2 }}>
          <TextField
            label="Title"
            fullWidth
            value={annTitle}
            onChange={(e) => setAnnTitle(e.target.value)}
            sx={{ ...parityTextField, mb: 2, mt: 1 }}
          />
          <TextField
            label="Body"
            fullWidth
            multiline
            rows={4}
            value={annBody}
            onChange={(e) => setAnnBody(e.target.value)}
            sx={parityTextField}
          />
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            borderTop: `1px solid ${P.rule}`,
            gap: 1,
          }}
        >
          <Button
            onClick={() => setAnnDialog(false)}
            sx={parityButton("ghost")}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateAnn}
            disabled={!annTitle.trim() || !annBody.trim()}
            sx={parityButton("primary")}
          >
            Publish
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Subscription override dialog ─── */}
      <Dialog
        open={subDialog.open}
        onClose={closeSubDialog}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: "2px",
            bgcolor: P.paper,
            border: `1px solid ${P.rule}`,
            boxShadow: "none",
          },
        }}
      >
        <DialogTitle
          sx={{
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: P.ink,
            borderBottom: `1px solid ${P.rule}`,
            px: 3,
            py: 2,
          }}
        >
          Override subscription
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: "20px !important", pb: 2 }}>
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: 11,
              color: P.muted,
              mb: 2,
            }}
          >
            This bypasses Stripe and writes directly to the subscription row.
            Use sparingly; audit-logged.
          </Typography>
          <TextField
            select
            label="Plan"
            fullWidth
            value={subDialog.plan}
            onChange={(e) =>
              setSubDialog((s) => ({ ...s, plan: e.target.value as PlanId }))
            }
            sx={{ ...parityTextField, mb: 2, mt: 1 }}
          >
            {PLAN_OPTIONS.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Status"
            fullWidth
            value={subDialog.status}
            onChange={(e) =>
              setSubDialog((s) => ({
                ...s,
                status: e.target.value as SubscriptionStatus,
              }))
            }
            sx={{ ...parityTextField, mb: 2 }}
          >
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {s.label}
              </MenuItem>
            ))}
          </TextField>

          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: P.muted,
              mt: 0.5,
              mb: 1,
            }}
          >
            Quota overrides
          </Typography>
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: 10,
              color: P.muted2,
              mb: 1.5,
            }}
          >
            Leave blank to clear the override and fall back to the plan default.
          </Typography>
          <TextField
            label="Max chunks"
            type="number"
            fullWidth
            value={subDialog.maxChunks}
            onChange={(e) =>
              setSubDialog((s) => ({ ...s, maxChunks: e.target.value }))
            }
            placeholder="e.g. 5000"
            inputProps={{ min: 0, max: 50000, "aria-label": "Max chunks override" }}
            helperText="Per-user ceiling for indexed RAG chunks (0 – 50 000)."
            sx={{ ...parityTextField, mb: 2 }}
          />
          <TextField
            label="Max VRAM (MB)"
            type="number"
            fullWidth
            value={subDialog.maxVramMb}
            onChange={(e) =>
              setSubDialog((s) => ({ ...s, maxVramMb: e.target.value }))
            }
            placeholder="e.g. 4096"
            inputProps={{ min: 0, max: 16384, "aria-label": "Max VRAM in megabytes" }}
            helperText="Hard ceiling on Ollama model size for this user (0 – 16 384 MB)."
            sx={parityTextField}
          />
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            borderTop: `1px solid ${P.rule}`,
            gap: 1,
          }}
        >
          <Button onClick={closeSubDialog} sx={parityButton("ghost")}>
            Cancel
          </Button>
          <Button onClick={submitSubOverride} sx={parityButton("primary")}>
            Apply override
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snack.tone}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{
            borderRadius: "2px",
            border: `1px solid ${snack.tone === "success" ? P.ok : P.bad}`,
            bgcolor: snack.tone === "success" ? P.okSoft : P.badSoft,
            color: snack.tone === "success" ? P.ok : P.bad,
            fontFamily: MONO,
            fontSize: 12,
            boxShadow: "none",
          }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>

      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        description={confirm.description}
        confirmText={confirm.confirmText}
        confirmLabel={confirm.confirmLabel}
        busy={confirm.busy}
        onCancel={closeConfirm}
        onConfirm={runConfirm}
      />
    </Box>
  );
}

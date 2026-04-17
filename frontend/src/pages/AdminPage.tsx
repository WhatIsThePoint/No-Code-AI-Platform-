import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import PeopleIcon from "@mui/icons-material/PeopleRounded";
import TrendingUpIcon from "@mui/icons-material/TrendingUpRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import BusinessIcon from "@mui/icons-material/BusinessRounded";
import PaymentIcon from "@mui/icons-material/PaymentRounded";
import { adminApi } from "../api/admin";
import type { AdminUser, AdminCompany, AuditLog, PlatformStats, AdminAnnouncement } from "../types/admin";
import { useAuthStore } from "../store/authSlice";

const STAT_CARDS = [
  { key: "total_users" as const, label: "Total Users", icon: PeopleIcon, gradient: "linear-gradient(135deg, #6366f1, #4f46e5)" },
  { key: "active_users" as const, label: "Active", icon: TrendingUpIcon, gradient: "linear-gradient(135deg, #10b981, #059669)" },
  { key: "suspended_users" as const, label: "Suspended", icon: BlockRoundedIcon, gradient: "linear-gradient(135deg, #ef4444, #dc2626)" },
  { key: "total_companies" as const, label: "Companies", icon: BusinessIcon, gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)" },
  { key: "paid_subscriptions" as const, label: "Paid Subs", icon: PaymentIcon, gradient: "linear-gradient(135deg, #f59e0b, #d97706)" },
];

function StatCard({ label, value, icon: Icon, gradient }: { label: string; value: number; icon: React.ElementType; gradient: string }) {
  return (
    <Card>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              background: gradient,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon sx={{ fontSize: 18, color: "#fff" }} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500, lineHeight: 1 }}>{label}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.2 }}>{value}</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState(0);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userSearch, setUserSearch] = useState("");
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" as "success" | "error" });
  const [annDialog, setAnnDialog] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");

  if (user?.role !== "super_admin") {
    return <Alert severity="error" sx={{ mt: 4 }}>Access denied. Super admin only.</Alert>;
  }

  const showSnack = (msg: string, severity: "success" | "error" = "success") =>
    setSnack({ open: true, msg, severity });

  // Fetch stats on mount
  useEffect(() => {
    adminApi.getStats().then((r) => setStats(r.data)).catch(() => {});
  }, []);

  // Fetch users on tab change or search
  useEffect(() => {
    if (tab !== 1) return;
    setLoading(true);
    adminApi.listUsers({ q: userSearch }).then((r) => {
      setUsers(r.data.items);
      setUserTotal(r.data.total);
    }).finally(() => setLoading(false));
  }, [tab, userSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch companies
  useEffect(() => {
    if (tab !== 2) return;
    setLoading(true);
    adminApi.listCompanies().then((r) => setCompanies(r.data.items)).finally(() => setLoading(false));
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch logs
  useEffect(() => {
    if (tab !== 3) return;
    setLoading(true);
    adminApi.listLogs({ limit: 100 }).then((r) => setLogs(r.data.items)).finally(() => setLoading(false));
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch announcements
  useEffect(() => {
    if (tab !== 4) return;
    adminApi.listAnnouncements().then((r) => setAnnouncements(r.data));
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSuspend = async (userId: string, isActive: boolean) => {
    try {
      await adminApi.updateUser(userId, { is_active: !isActive });
      setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, is_active: !isActive } : u));
      showSnack(isActive ? "User suspended" : "User reactivated");
    } catch {
      showSnack("Action failed", "error");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Delete this user permanently?")) return;
    try {
      await adminApi.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.user_id !== userId));
      showSnack("User deleted");
    } catch {
      showSnack("Delete failed", "error");
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (!confirm("Delete this company?")) return;
    try {
      await adminApi.deleteCompany(companyId);
      setCompanies((prev) => prev.filter((c) => c.company_id !== companyId));
      showSnack("Company deleted");
    } catch {
      showSnack("Delete failed", "error");
    }
  };

  const handleToggleAnnouncement = async (id: string, isActive: boolean) => {
    try {
      await adminApi.updateAnnouncement(id, { is_active: !isActive });
      setAnnouncements((prev) => prev.map((a) => a.id === id ? { ...a, is_active: !isActive } : a));
    } catch {
      showSnack("Update failed", "error");
    }
  };

  const handleCreateAnn = async () => {
    if (!annTitle || !annBody) return;
    try {
      await adminApi.createAnnouncement(annTitle, annBody);
      setAnnDialog(false);
      setAnnTitle(""); setAnnBody("");
      adminApi.listAnnouncements().then((r) => setAnnouncements(r.data));
      showSnack("Announcement created");
    } catch {
      showSnack("Failed to create announcement", "error");
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "12px",
            background: "linear-gradient(135deg, #ef4444, #dc2626)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <AdminPanelSettingsIcon sx={{ fontSize: 22 }} />
        </Box>
        <Typography variant="h4">Super Admin</Typography>
      </Box>

      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }} className="stagger-children">
          {STAT_CARDS.map((sc) => (
            <Grid item xs={6} sm={4} md={2.4} key={sc.key}>
              <StatCard label={sc.label} value={stats[sc.key]} icon={sc.icon} gradient={sc.gradient} />
            </Grid>
          ))}
        </Grid>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Overview" />
        <Tab label="Users" />
        <Tab label="Companies" />
        <Tab label="Audit Logs" />
        <Tab label="Announcements" />
      </Tabs>

      {/* Overview */}
      {tab === 0 && (
        <Typography variant="body2" color="text.secondary">
          Select a tab to manage platform resources.
        </Typography>
      )}

      {/* Users */}
      {tab === 1 && (
        <Box className="animate-fade-in">
          <TextField
            placeholder="Search by email or name..."
            size="small"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            sx={{ mb: 2, width: 360 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: "text.secondary" }} /></InputAdornment>,
            }}
          />
          {loading ? <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress /></Box> : (
            <Paper sx={{ borderRadius: 4, overflow: "hidden" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Email</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Tier</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.full_name ?? "—"}</TableCell>
                      <TableCell><Chip label={u.role} size="small" /></TableCell>
                      <TableCell><Chip label={u.tier} size="small" variant="outlined" /></TableCell>
                      <TableCell>
                        <Chip
                          label={u.is_active ? "Active" : "Suspended"}
                          color={u.is_active ? "success" : "error"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={u.is_active ? "Suspend" : "Reactivate"}>
                          <IconButton size="small" onClick={() => handleSuspend(u.user_id, u.is_active)}>
                            {u.is_active ? <BlockIcon fontSize="small" color="warning" /> : <CheckCircleIcon fontSize="small" color="success" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => handleDeleteUser(u.user_id)}>
                            <DeleteIcon fontSize="small" color="error" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            {userTotal} user(s) total
          </Typography>
        </Box>
      )}

      {/* Companies */}
      {tab === 2 && (
        loading ? <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress /></Box> : (
          <Paper sx={{ borderRadius: 4, overflow: "hidden" }} className="animate-fade-in">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Slug</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {companies.map((c) => (
                  <TableRow key={c.company_id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.slug}</TableCell>
                    <TableCell>{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDeleteCompany(c.company_id)}>
                          <DeleteIcon fontSize="small" color="error" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )
      )}

      {/* Audit Logs */}
      {tab === 3 && (
        loading ? <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress /></Box> : (
          <Paper sx={{ overflowX: "auto", borderRadius: 4, overflow: "hidden" }} className="animate-fade-in">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Target</TableCell>
                  <TableCell>IP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {new Date(l.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell><Chip label={l.action} size="small" /></TableCell>
                    <TableCell>
                      {l.target_type && l.target_id
                        ? `${l.target_type}: ${l.target_id.slice(0, 8)}…`
                        : "—"}
                    </TableCell>
                    <TableCell>{l.ip_address ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )
      )}

      {/* Announcements */}
      {tab === 4 && (
        <Box className="animate-fade-in">
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAnnDialog(true)}
            sx={{ mb: 2.5 }}
          >
            New Announcement
          </Button>
          <Box className="stagger-children">
            {announcements.map((a) => (
              <Card key={a.id} sx={{ mb: 2 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{a.title}</Typography>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                      <Chip
                        label={a.is_active ? "Active" : "Hidden"}
                        size="small"
                        onClick={() => handleToggleAnnouncement(a.id, a.is_active)}
                        sx={{
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: "0.65rem",
                          bgcolor: a.is_active ? alpha("#10b981", 0.1) : alpha("#94a3b8", 0.1),
                          color: a.is_active ? "#059669" : "#64748b",
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => adminApi.deleteAnnouncement(a.id).then(() =>
                          setAnnouncements((prev) => prev.filter((x) => x.id !== a.id))
                        )}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                    {a.body}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      )}

      {/* Create announcement dialog */}
      <Dialog open={annDialog} onClose={() => setAnnDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>New Announcement</DialogTitle>
        <DialogContent>
          <TextField
            label="Title"
            fullWidth
            value={annTitle}
            onChange={(e) => setAnnTitle(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            label="Body"
            fullWidth
            multiline
            rows={4}
            value={annBody}
            onChange={(e) => setAnnBody(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setAnnDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateAnn}>Create</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        message={snack.msg}
      />
    </Box>
  );
}

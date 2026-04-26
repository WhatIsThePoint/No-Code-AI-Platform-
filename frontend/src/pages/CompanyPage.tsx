import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import { useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { useAuthStore } from "../store/authSlice";

interface Member {
  user_id: string;
  full_name?: string;
  email?: string;
  role: string;
  status: string;
}

interface PendingInvite {
  invitation_id: string;
  token: string;
  company_name: string;
  company_id: string;
  role: string;
  expires_at: string;
}

interface SentInvite {
  invitation_id: string;
  token: string;
  email: string;
  role: string;
  expires_at: string;
}

const ROLE_COLOR: Record<string, string> = {
  owner: "#f59e0b",
  data_scientist: "#8b5cf6",
  pm: "#6366f1",
  analyst: "#10b981",
  viewer: "#94a3b8",
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  data_scientist: "Data Scientist",
  pm: "Project Manager",
  analyst: "Analyst",
  viewer: "Viewer",
};

export function CompanyPage() {
  const user = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [lastInvite, setLastInvite] = useState<SentInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState("");
  const [loading, setLoading] = useState(true);

  const createForm = useForm<{ name: string }>();
  const inviteForm = useForm<{ email: string; role: string }>({
    defaultValues: { role: "data_scientist" },
  });

  const loadPendingInvites = useCallback(async () => {
    try {
      const resp = await api.get("/companies/invitations/pending");
      setPendingInvites(resp.data);
    } catch {
      // ignore
    }
  }, []);

  const loadCompanyData = useCallback(async (cid: string) => {
    const companyResp = await api.get(`/companies/${cid}`);
    setCompanyName(companyResp.data.name);
    setCompanyId(cid);
    const membersResp = await api.get(`/companies/${cid}/members`);
    setMembers(membersResp.data);
  }, []);

  const loadCompany = useCallback(async () => {
    try {
      const resp = await api.get("/companies/mine");
      await loadCompanyData(resp.data.company_id);
    } catch {
      // user may not have a company
    }
  }, [loadCompanyData]);

  useEffect(() => {
    Promise.all([loadCompany(), loadPendingInvites()]).finally(() => setLoading(false));
  }, [loadCompany, loadPendingInvites]);

  // Auto-accept invite from ?invite= query param
  useEffect(() => {
    const token = searchParams.get("invite");
    if (!token || loading) return;
    setSearchParams({}, { replace: true });
    (async () => {
      try {
        const resp = await api.get(`/companies/invitations/accept/${token}`);
        setSnack(`Joined as ${ROLE_LABEL[resp.data.role] ?? resp.data.role}!`);
        await loadCompanyData(resp.data.company_id);
        setPendingInvites((prev) => prev.filter((i) => i.token !== token));
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
        setError(msg || "Failed to accept invitation");
      }
    })();
  }, [searchParams, loading, setSearchParams, loadCompanyData]);

  const handleCreateCompany = async (data: { name: string }) => {
    setError(null);
    try {
      const resp = await api.post("/companies", data);
      setCompanyId(resp.data.company_id);
      setCompanyName(resp.data.name);
      const membersResp = await api.get(`/companies/${resp.data.company_id}/members`);
      setMembers(membersResp.data);
      setSnack("Collaborator workspace created!");
    } catch {
      setError("Failed to create collaborator workspace");
    }
  };

  const handleInvite = async (data: { email: string; role: string }) => {
    if (!companyId) return;
    setError(null);
    try {
      const resp = await api.post(`/companies/${companyId}/invite`, data);
      setLastInvite(resp.data);
      setInviteOpen(false);
      inviteForm.reset({ role: "data_scientist" });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg || "Failed to send invite");
    }
  };

  const handleAcceptInvite = async (token: string) => {
    setError(null);
    try {
      const resp = await api.get(`/companies/invitations/accept/${token}`);
      setSnack(`Joined as ${resp.data.role}!`);
      setCompanyId(resp.data.company_id);
      setPendingInvites((prev) => prev.filter((i) => i.token !== token));
      const companyResp = await api.get(`/companies/${resp.data.company_id}`);
      setCompanyName(companyResp.data.name);
      const membersResp = await api.get(`/companies/${resp.data.company_id}/members`);
      setMembers(membersResp.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(msg || "Failed to accept invitation");
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/company?invite=${token}`;
    navigator.clipboard.writeText(link);
    setSnack("Invite link copied!");
  };

  if (loading) return null;

  const hasCompany = !!companyId;
  const showEmpty = !hasCompany && pendingInvites.length === 0;

  return (
    <Box className="animate-fade-in">
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "12px",
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <BusinessRoundedIcon sx={{ fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="h4">Collaborator</Typography>
        </Box>
      </Box>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
        Create or join a team workspace to collaborate on ML projects.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* ── Pending invitations ──────────────────── */}
      {pendingInvites.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Pending Invitations
          </Typography>
          <Grid container spacing={2}>
            {pendingInvites.map((inv) => (
              <Grid item xs={12} sm={6} key={inv.invitation_id}>
                <Card
                  sx={{
                    border: "1.5px solid",
                    borderColor: alpha("#6366f1", 0.2),
                    bgcolor: alpha("#6366f1", 0.02),
                  }}
                >
                  <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MailOutlineRoundedIcon sx={{ color: "#fff", fontSize: 18 }} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                          {inv.company_name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          You're invited as {ROLE_LABEL[inv.role] ?? inv.role}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1.5 }}>
                      Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </Typography>
                    <Button
                      variant="contained"
                      fullWidth
                      startIcon={<CheckCircleRoundedIcon />}
                      onClick={() => handleAcceptInvite(inv.token)}
                    >
                      Accept & Join
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* ── No company, no invites ───────────────── */}
      {showEmpty && (
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <Card sx={{ height: "100%" }}>
              <CardContent sx={{ p: 3, textAlign: "center" }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: "16px",
                    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mx: "auto",
                    mb: 2,
                  }}
                >
                  <BusinessRoundedIcon sx={{ color: "#fff", fontSize: 28 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  Create a Collaborator Workspace
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
                  Start a team workspace and invite colleagues to collaborate on ML pipelines.
                </Typography>
                <Box component="form" onSubmit={createForm.handleSubmit(handleCreateCompany)}>
                  <TextField
                    fullWidth
                    label="Workspace Name"
                    size="small"
                    sx={{ mb: 1.5 }}
                    {...createForm.register("name", { required: true })}
                  />
                  <Button type="submit" variant="contained" fullWidth>
                    Create Workspace
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Card sx={{ height: "100%" }}>
              <CardContent sx={{ p: 3, textAlign: "center" }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: "16px",
                    background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mx: "auto",
                    mb: 2,
                  }}
                >
                  <PersonAddAlt1RoundedIcon sx={{ color: "#fff", fontSize: 28 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  Join a Collaborator Workspace
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
                  Ask your team owner to send you an invite. Pending invitations will appear here automatically.
                </Typography>
                <Alert severity="info" sx={{ textAlign: "left" }}>
                  <Typography variant="caption">
                    No pending invitations for <strong>{user?.email}</strong>
                  </Typography>
                </Alert>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ── Company dashboard ────────────────────── */}
      {hasCompany && (
        <Box>
          {/* Company header */}
          <Card sx={{ mb: 3, overflow: "hidden" }}>
            <Box sx={{ height: 4, background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }} />
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "14px",
                    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: "1.1rem",
                  }}
                >
                  {companyName[0]?.toUpperCase()}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{companyName}</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {members.length} member{members.length !== 1 ? "s" : ""}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<GroupAddRoundedIcon />}
                  onClick={() => setInviteOpen(true)}
                >
                  Invite Member
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Members table */}
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 3, pt: 2.5, pb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                <GroupsRoundedIcon sx={{ color: "primary.main", fontSize: 20 }} />
                <Typography variant="subtitle2">Team Members</Typography>
              </Box>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Member</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.user_id} hover>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: "8px",
                              bgcolor: alpha(ROLE_COLOR[m.role] ?? "#94a3b8", 0.1),
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              color: ROLE_COLOR[m.role] ?? "#64748b",
                            }}
                          >
                            {(m.full_name ?? m.email ?? m.user_id)?.[0]?.toUpperCase()}
                          </Box>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                              {m.full_name ?? "—"}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                              {m.email ?? m.user_id.slice(0, 8) + "..."}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={ROLE_LABEL[m.role] ?? m.role}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            fontSize: "0.7rem",
                            bgcolor: alpha(ROLE_COLOR[m.role] ?? "#94a3b8", 0.1),
                            color: ROLE_COLOR[m.role] ?? "#64748b",
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={m.status}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            fontSize: "0.65rem",
                            bgcolor: m.status === "active" ? alpha("#10b981", 0.1) : alpha("#f59e0b", 0.1),
                            color: m.status === "active" ? "#059669" : "#d97706",
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ── Invite dialog ────────────────────────── */}
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Invite a Team Member</DialogTitle>
        <Box component="form" onSubmit={inviteForm.handleSubmit(handleInvite)}>
          <DialogContent>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
              They'll need an account with the same email to accept the invitation.
            </Typography>
            <TextField
              fullWidth
              label="Email"
              margin="normal"
              {...inviteForm.register("email", { required: true })}
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Role</InputLabel>
              <Controller
                name="role"
                control={inviteForm.control}
                render={({ field }) => (
                  <Select {...field} label="Role">
                    <MenuItem value="data_scientist">Data Scientist</MenuItem>
                    <MenuItem value="pm">Project Manager</MenuItem>
                    <MenuItem value="analyst">Analyst</MenuItem>
                    <MenuItem value="viewer">Viewer</MenuItem>
                  </Select>
                )}
              />
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Send Invite</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* ── Invite success dialog (shows token) ─── */}
      <Dialog open={!!lastInvite} onClose={() => setLastInvite(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CheckCircleRoundedIcon sx={{ color: "#10b981" }} />
            Invitation Sent
          </Box>
        </DialogTitle>
        <DialogContent>
          {lastInvite && (
            <Box>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Invitation created for <strong>{lastInvite.email}</strong> as{" "}
                <strong>{ROLE_LABEL[lastInvite.role] ?? lastInvite.role}</strong>.
                Share this link with them:
              </Typography>
              <Paper
                sx={{
                  p: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  bgcolor: alpha("#6366f1", 0.04),
                  border: "1px solid",
                  borderColor: alpha("#6366f1", 0.15),
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    flex: 1,
                    fontFamily: "monospace",
                    fontSize: "0.8rem",
                    wordBreak: "break-all",
                    color: "text.secondary",
                  }}
                >
                  {window.location.origin}/company?invite={lastInvite.token}
                </Typography>
                <Tooltip title="Copy link" arrow>
                  <IconButton size="small" onClick={() => copyInviteLink(lastInvite.token)}>
                    <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Paper>
              <Divider sx={{ my: 2 }} />
              <Alert severity="info" variant="outlined">
                <Typography variant="caption">
                  The invitee must register or log in with <strong>{lastInvite.email}</strong> and visit
                  this link — or navigate to the Collaborator page where the invite will appear automatically.
                  Expires {new Date(lastInvite.expires_at).toLocaleDateString()}.
                </Typography>
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="contained" onClick={() => setLastInvite(null)}>Done</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
        onClose={() => setSnack("")}
        message={snack}
      />
    </Box>
  );
}

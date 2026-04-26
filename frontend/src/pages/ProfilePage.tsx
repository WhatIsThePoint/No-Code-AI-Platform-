import { zodResolver } from "@hookform/resolvers/zod";
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
  Divider,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/PersonRounded";
import SecurityIcon from "@mui/icons-material/SecurityRounded";
import CheckCircleIcon from "@mui/icons-material/CheckCircleRounded";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunchRounded";
import CalendarTodayIcon from "@mui/icons-material/CalendarTodayRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import PaymentRoundedIcon from "@mui/icons-material/PaymentRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { z } from "zod";
import { authApi } from "../api/auth";
import { useAuthStore } from "../store/authSlice";
import { useDatasets } from "../hooks/useDatasets";
import { pipelinesApi } from "../api/pipelines";
import type { Pipeline } from "../types/pipeline";

const schema = z.object({
  full_name: z.string().min(1),
  role: z.enum(["data_scientist", "engineer", "analyst"]),
});

type FormData = z.infer<typeof schema>;
type TwoFAStep = "idle" | "loading" | "scan" | "verify" | "done";

const TIER_CONFIG: Record<string, { label: string; color: string; gradient: string; limits: string }> = {
  free: { label: "Free", color: "#64748b", gradient: "linear-gradient(135deg, #94a3b8, #64748b)", limits: "3 datasets, 2 pipelines" },
  solo: { label: "Solo", color: "#6366f1", gradient: "linear-gradient(135deg, #6366f1, #4f46e5)", limits: "20 datasets, 10 pipelines" },
  company: { label: "Collaborator", color: "#8b5cf6", gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)", limits: "Unlimited" },
  super_admin: { label: "Admin", color: "#f59e0b", gradient: "linear-gradient(135deg, #f59e0b, #d97706)", limits: "Unlimited" },
};

const ROLE_LABELS: Record<string, string> = {
  data_scientist: "Data Scientist",
  engineer: "ML Engineer",
  analyst: "Analyst",
  super_admin: "Platform Admin",
};

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { datasets } = useDatasets();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);

  const [twoFAOpen, setTwoFAOpen] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState<TwoFAStep>("idle");
  const [twoFAError, setTwoFAError] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [twoFASecret, setTwoFASecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [disableOpen, setDisableOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: user?.full_name ?? "",
      role: (user?.role === "super_admin" ? "data_scientist" : user?.role) ?? "data_scientist",
    },
  });

  useEffect(() => {
    pipelinesApi.list().then((r) => setPipelines(r.data.items)).catch(() => {});
  }, []);

  const onSubmit = async (data: FormData) => {
    setSuccess(false);
    setError(null);
    try {
      const { data: updated } = await authApi.updateMe(data);
      setAuth(updated, accessToken!);
      setSuccess(true);
    } catch {
      setError("Failed to update profile");
    }
  };

  const handleEnable2FA = async () => {
    setTwoFAOpen(true);
    setTwoFAStep("loading");
    setTwoFAError(null);
    try {
      const { data } = await authApi.enable2FA();
      setQrImage(data.qr_image_base64);
      setTwoFASecret(data.secret);
      setTwoFAStep("scan");
    } catch {
      setTwoFAError("Failed to start 2FA setup");
      setTwoFAStep("idle");
    }
  };

  const handleConfirm2FA = async () => {
    setTwoFAError(null);
    try {
      await authApi.confirm2FA(totpCode);
      if (user && accessToken) {
        setAuth({ ...user, totp_enabled: true }, accessToken);
      }
      setTwoFAStep("done");
    } catch {
      setTwoFAError("Invalid code. Please try again.");
    }
  };

  const handleDisable2FA = async () => {
    try {
      await authApi.disable2FA();
      if (user && accessToken) {
        setAuth({ ...user, totp_enabled: false }, accessToken);
      }
      setDisableOpen(false);
    } catch {
      setError("Failed to disable 2FA");
    }
  };

  const closeTwoFADialog = () => {
    setTwoFAOpen(false);
    setTwoFAStep("idle");
    setQrImage(null);
    setTwoFASecret(null);
    setTotpCode("");
    setTwoFAError(null);
  };

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "?";

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  const tier = TIER_CONFIG[user?.tier ?? "free"];
  const trainedPipelines = pipelines.filter((p) => p.status === "done").length;

  return (
    <Box className="animate-fade-in">
      {/* ── Header ──────────────────────────────────── */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 4 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "12px",
            background: tier.gradient,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <PersonIcon sx={{ fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="h4" sx={{ lineHeight: 1.2 }}>Profile</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Manage your account settings and preferences
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* ── Left column: Identity card ─────────── */}
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              position: "relative",
              overflow: "hidden",
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 100,
                background: tier.gradient,
                opacity: 0.1,
              },
            }}
          >
            <CardContent sx={{ textAlign: "center", pt: 4, pb: 3, position: "relative" }}>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: "22px",
                  background: tier.gradient,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mx: "auto",
                  mb: 2,
                  color: "#fff",
                  fontSize: "1.6rem",
                  fontWeight: 800,
                  boxShadow: `0 8px 25px -5px ${alpha(tier.color, 0.4)}`,
                }}
              >
                {initials}
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                {user?.full_name ?? "User"}
              </Typography>

              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, justifyContent: "center", mb: 2 }}>
                <EmailRoundedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {user?.email}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", gap: 1, justifyContent: "center", flexWrap: "wrap", mb: 2 }}>
                <Chip
                  icon={<BadgeRoundedIcon />}
                  label={ROLE_LABELS[user?.role ?? "data_scientist"]}
                  size="small"
                  sx={{ fontWeight: 600, bgcolor: alpha("#6366f1", 0.08), color: "#4f46e5", "& .MuiChip-icon": { color: "#6366f1" } }}
                />
                <Chip
                  icon={<WorkspacePremiumRoundedIcon />}
                  label={tier.label}
                  size="small"
                  sx={{ fontWeight: 600, bgcolor: alpha(tier.color, 0.1), color: tier.color, "& .MuiChip-icon": { color: tier.color } }}
                />
                {user?.totp_enabled && (
                  <Chip
                    icon={<SecurityIcon />}
                    label="2FA"
                    size="small"
                    sx={{ fontWeight: 600, bgcolor: alpha("#10b981", 0.1), color: "#059669", "& .MuiChip-icon": { color: "#10b981" } }}
                  />
                )}
              </Box>

              {memberSince && (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, color: "text.secondary" }}>
                  <CalendarTodayIcon sx={{ fontSize: 13 }} />
                  <Typography variant="caption">Member since {memberSince}</Typography>
                </Box>
              )}
            </CardContent>

            <Divider />

            {/* Usage stats */}
            <CardContent sx={{ py: 2.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontSize: "0.7rem" }}>Usage Overview</Typography>
              {[
                { icon: <StorageRoundedIcon />, label: "Datasets", value: datasets.length, color: "#6366f1" },
                { icon: <AccountTreeRoundedIcon />, label: "Pipelines", value: pipelines.length, color: "#8b5cf6" },
                { icon: <CheckCircleIcon />, label: "Trained", value: trainedPipelines, color: "#10b981" },
              ].map((stat) => (
                <Box key={stat.label} sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "8px",
                      bgcolor: alpha(stat.color, 0.08),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      "& .MuiSvgIcon-root": { fontSize: 16, color: stat.color },
                    }}
                  >
                    {stat.icon}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {stat.label}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </CardContent>

            <Divider />

            {/* Quick links */}
            <CardContent sx={{ py: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontSize: "0.7rem" }}>Quick Links</Typography>
              {[
                { icon: <StorageRoundedIcon />, label: "Datasets", path: "/data" },
                { icon: <AccountTreeRoundedIcon />, label: "Pipelines", path: "/pipelines" },
                { icon: <BusinessRoundedIcon />, label: "Company", path: "/company" },
                { icon: <PaymentRoundedIcon />, label: "Billing", path: "/billing" },
              ].map((link) => (
                <Button
                  key={link.path}
                  fullWidth
                  size="small"
                  startIcon={link.icon}
                  endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 14 }} />}
                  onClick={() => navigate(link.path)}
                  sx={{
                    justifyContent: "flex-start",
                    color: "text.secondary",
                    fontWeight: 500,
                    mb: 0.5,
                    px: 1.5,
                    "& .MuiButton-endIcon": { ml: "auto" },
                  }}
                >
                  {link.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Right column ───────────────────────── */}
        <Grid item xs={12} md={8}>
          {/* Tier card */}
          <Card sx={{ mb: 3, overflow: "hidden" }}>
            <Box sx={{ height: 4, background: tier.gradient }} />
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "12px",
                    background: tier.gradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <WorkspacePremiumRoundedIcon sx={{ color: "#fff" }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{tier.label} Plan</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>{tier.limits}</Typography>
                </Box>
                <Button
                  component={RouterLink}
                  to="/billing"
                  variant="outlined"
                  size="small"
                  endIcon={<ArrowForwardRoundedIcon />}
                >
                  {user?.tier === "free" ? "Upgrade" : "Manage"}
                </Button>
              </Box>
              {user?.tier === "free" && (
                <Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      Datasets: {datasets.length} / 3
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      Pipelines: {pipelines.length} / 2
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min((datasets.length / 3) * 100, 100)}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Edit form */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "12px",
                    bgcolor: alpha("#6366f1", 0.08),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <SettingsRoundedIcon sx={{ color: "primary.main" }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Account Settings</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>Update your personal information</Typography>
                </Box>
              </Box>

              {success && <Alert severity="success" sx={{ mb: 2 }}>Profile updated successfully</Alert>}
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

              <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Email"
                      value={user?.email}
                      disabled
                      sx={{ "& .MuiInputBase-root": { bgcolor: alpha("#f1f5f9", 0.5) } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Full Name"
                      {...register("full_name")}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Role</InputLabel>
                      <Controller
                        name="role"
                        control={control}
                        render={({ field }) => (
                          <Select {...field} label="Role">
                            <MenuItem value="data_scientist">Data Scientist</MenuItem>
                            <MenuItem value="engineer">ML Engineer</MenuItem>
                            <MenuItem value="analyst">Analyst</MenuItem>
                          </Select>
                        )}
                      />
                    </FormControl>
                  </Grid>
                </Grid>
                <Button type="submit" variant="contained" sx={{ mt: 2.5 }} disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* 2FA management */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "12px",
                    background: user?.totp_enabled
                      ? "linear-gradient(135deg, #10b981, #059669)"
                      : alpha("#6366f1", 0.08),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <SecurityIcon sx={{ color: user?.totp_enabled ? "#fff" : "primary.main" }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Two-Factor Authentication</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Add an extra layer of security to your account
                  </Typography>
                </Box>
                {user?.totp_enabled ? (
                  <Chip
                    icon={<CheckCircleIcon />}
                    label="Enabled"
                    size="small"
                    sx={{
                      bgcolor: alpha("#10b981", 0.12),
                      color: "#059669",
                      fontWeight: 600,
                      "& .MuiChip-icon": { color: "#10b981" },
                    }}
                  />
                ) : (
                  <Chip label="Not enabled" size="small" variant="outlined" />
                )}
              </Box>

              <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
                {user?.totp_enabled
                  ? "Your account is protected with TOTP-based two-factor authentication. You'll need your authenticator app to sign in."
                  : "Protect your account by requiring a 6-digit code from an authenticator app (Google Authenticator, Authy, 1Password) every time you sign in."}
              </Typography>

              {user?.totp_enabled ? (
                <Button variant="outlined" color="error" onClick={() => setDisableOpen(true)}>
                  Disable 2FA
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleEnable2FA}
                  sx={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                >
                  Enable Two-Factor Authentication
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Upgrade CTA for free tier */}
          {user?.tier === "free" && (
            <Card
              sx={{
                overflow: "hidden",
                background: `linear-gradient(135deg, ${alpha("#6366f1", 0.04)}, ${alpha("#8b5cf6", 0.06)})`,
                border: 1,
                borderColor: alpha("#6366f1", 0.2),
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: "14px",
                      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: `0 8px 20px -4px ${alpha("#6366f1", 0.4)}`,
                      flexShrink: 0,
                    }}
                  >
                    <RocketLaunchIcon sx={{ color: "#fff" }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>Unlock the full platform</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Upload larger datasets, train unlimited models, and access advanced features like batch predictions and model comparison.
                    </Typography>
                  </Box>
                  <Button
                    component={RouterLink}
                    to="/billing"
                    variant="contained"
                    endIcon={<ArrowForwardRoundedIcon />}
                    sx={{
                      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    Upgrade
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* 2FA Enable Dialog */}
      <Dialog open={twoFAOpen} onClose={closeTwoFADialog} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {twoFAStep === "done" ? "2FA Enabled" : "Enable Two-Factor Authentication"}
        </DialogTitle>
        <DialogContent>
          {twoFAStep === "loading" && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          )}
          {twoFAStep === "scan" && qrImage && (
            <Box>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password):
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
                <Box
                  component="img"
                  src={`data:image/png;base64,${qrImage}`}
                  alt="2FA QR Code"
                  sx={{ width: 200, height: 200, borderRadius: 2, border: 1, borderColor: "divider" }}
                />
              </Box>
              {twoFASecret && (
                <Tooltip title="Copy to clipboard" arrow>
                  <Typography
                    variant="caption"
                    onClick={() => navigator.clipboard.writeText(twoFASecret)}
                    sx={{
                      display: "block",
                      textAlign: "center",
                      fontFamily: "monospace",
                      color: "text.secondary",
                      mb: 2,
                      wordBreak: "break-all",
                      cursor: "pointer",
                      "&:hover": { color: "primary.main" },
                    }}
                  >
                    Or enter manually: {twoFASecret}
                  </Typography>
                </Tooltip>
              )}
              <TextField
                fullWidth
                label="Enter 6-digit code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputProps={{ maxLength: 6, style: { textAlign: "center", letterSpacing: 4, fontSize: 20 } }}
                autoFocus
              />
              {twoFAError && <Alert severity="error" sx={{ mt: 2 }}>{twoFAError}</Alert>}
            </Box>
          )}
          {twoFAStep === "done" && (
            <Box sx={{ textAlign: "center", py: 2 }}>
              <CheckCircleIcon sx={{ fontSize: 56, color: "#10b981", mb: 1 }} />
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                Two-factor authentication is now active.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                You'll be asked for a code when you sign in.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          {twoFAStep === "scan" && (
            <>
              <Button onClick={closeTwoFADialog}>Cancel</Button>
              <Button variant="contained" onClick={handleConfirm2FA} disabled={totpCode.length !== 6}>
                Verify & Enable
              </Button>
            </>
          )}
          {twoFAStep === "done" && (
            <Button variant="contained" onClick={closeTwoFADialog}>Done</Button>
          )}
          {twoFAStep === "loading" && <Button onClick={closeTwoFADialog}>Cancel</Button>}
        </DialogActions>
      </Dialog>

      {/* Disable 2FA confirmation */}
      <Dialog open={disableOpen} onClose={() => setDisableOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Disable 2FA?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This will remove two-factor authentication from your account. You can re-enable it later.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDisableOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDisable2FA}>Disable</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

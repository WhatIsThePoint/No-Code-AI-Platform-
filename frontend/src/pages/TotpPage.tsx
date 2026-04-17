import { Alert, Box, Button, Container, Paper, TextField, Typography, alpha } from "@mui/material";
import LockIcon from "@mui/icons-material/LockRounded";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { useAuthStore } from "../store/authSlice";

export function TotpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [apiError, setApiError] = useState<string | null>(null);

  const session_token = (location.state as { session_token?: string })?.session_token;

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<{ code: string }>();

  if (!session_token) {
    navigate("/login");
    return null;
  }

  const onSubmit = async ({ code }: { code: string }) => {
    setApiError(null);
    try {
      const { data } = await authApi.verify2FA(session_token, code);
      const { data: userData } = await authApi.getMe();
      setAuth(userData, data.access_token!);
      navigate("/dashboard");
    } catch {
      setApiError("Invalid code. Please try again.");
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f8fafc 100%)",
      }}
    >
      <Container maxWidth="sm" className="animate-scale-in">
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Paper
            sx={{
              p: { xs: 3, sm: 5 },
              width: "100%",
              maxWidth: 440,
              borderRadius: 3,
              border: "1px solid",
              borderColor: alpha("#6366f1", 0.12),
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "3px",
                background: "linear-gradient(90deg, #6366f1, #8b5cf6, #6366f1)",
                backgroundSize: "200% 100%",
                animation: "gradient-shift 3s ease infinite",
              },
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: "16px",
                background: `linear-gradient(135deg, ${alpha("#6366f1", 0.12)} 0%, ${alpha("#8b5cf6", 0.12)} 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: "auto",
                mb: 2.5,
              }}
            >
              <LockIcon sx={{ fontSize: 28, color: "primary.main" }} />
            </Box>

            <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mb: 0.5 }}>
              Two-Factor Authentication
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
              Enter the 6-digit code from your authenticator app.
            </Typography>

            {apiError && <Alert severity="error" sx={{ mb: 2.5 }}>{apiError}</Alert>}

            <Box component="form" onSubmit={handleSubmit(onSubmit)}>
              <TextField
                fullWidth
                label="Verification Code"
                inputProps={{
                  maxLength: 6,
                  inputMode: "numeric",
                  style: { textAlign: "center", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "0.3em" },
                }}
                {...register("code", { required: true, pattern: /^\d{6}$/ })}
                autoFocus
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{ mt: 3, py: 1.4 }}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Verifying..." : "Verify"}
              </Button>
            </Box>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}

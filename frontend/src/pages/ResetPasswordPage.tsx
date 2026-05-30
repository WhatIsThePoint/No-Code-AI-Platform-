import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  TextField,
  Typography,
  alpha,
} from "@mui/material";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../api/auth";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      const code = err.response?.data?.error;
      if (code === "invalid_or_expired_token") {
        setError("This reset link is invalid or has expired. Request a new one.");
      } else if (code === "weak_password") {
        setError("Password must be at least 8 characters.");
      } else {
        setError("Could not reset password. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f8fafc 100%)",
      }}
    >
      <Container maxWidth="sm">
        <Paper
          sx={{
            p: { xs: 3, sm: 5 },
            borderRadius: 3,
            border: "1px solid",
            borderColor: alpha("#d2541c", 0.12),
          }}
        >
          {!token ? (
            <>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
                Reset password
              </Typography>
              <Alert severity="error">
                This page needs a reset token. Use the link from your reset
                email, or request a new one.
              </Alert>
              <Button
                variant="outlined"
                fullWidth
                sx={{ mt: 3 }}
                onClick={() => navigate("/forgot-password")}
              >
                Request a new reset link
              </Button>
            </>
          ) : done ? (
            <>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                Password updated
              </Typography>
              <Alert severity="success" sx={{ mb: 3 }}>
                Your password has been reset and every previous session was
                signed out.
              </Alert>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={() => navigate("/login")}
              >
                Continue to Sign In
              </Button>
            </>
          ) : (
            <>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                Choose a new password
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Eight characters minimum. Picking something unique here is more
                useful than picking something complicated.
              </Typography>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              <Box component="form" onSubmit={onSubmit}>
                <TextField
                  fullWidth
                  label="New password"
                  type="password"
                  margin="normal"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                />
                <TextField
                  fullWidth
                  label="Confirm new password"
                  type="password"
                  margin="normal"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={submitting || !password || !confirm}
                  sx={{ mt: 3, py: 1.4 }}
                >
                  {submitting ? "Updating..." : "Update password"}
                </Button>
              </Box>
            </>
          )}
        </Paper>
      </Container>
    </Box>
  );
}

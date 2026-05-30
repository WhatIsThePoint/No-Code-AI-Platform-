import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Typography,
  alpha,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../api/auth";

type Status = "verifying" | "success" | "error";

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState<Status>("verifying");
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Verification link is missing the token parameter.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await authApi.verifyEmail(token);
        if (cancelled) return;
        setEmail(res.data.email);
        setStatus("success");
      } catch (e: unknown) {
        if (cancelled) return;
        const err = e as { response?: { data?: { error?: string } } };
        const code = err.response?.data?.error;
        setError(
          code === "invalid_or_expired_token"
            ? "This verification link is invalid or has expired."
            : "Could not verify the email. Please request a new link."
        );
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

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
            textAlign: "center",
          }}
        >
          {status === "verifying" && (
            <>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Verifying your email...
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Hold on a moment.
              </Typography>
            </>
          )}

          {status === "success" && (
            <>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                Email verified
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {email
                  ? `${email} is now active.`
                  : "Your account is now active."}
              </Typography>
              <Alert severity="success" sx={{ mb: 3, textAlign: "left" }}>
                You can now sign in with the password you chose at signup.
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
          )}

          {status === "error" && (
            <>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                Verification failed
              </Typography>
              <Alert severity="error" sx={{ mb: 3, textAlign: "left" }}>
                {error}
              </Alert>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => navigate("/login")}
              >
                Back to Sign In
              </Button>
            </>
          )}
        </Paper>
      </Container>
    </Box>
  );
}

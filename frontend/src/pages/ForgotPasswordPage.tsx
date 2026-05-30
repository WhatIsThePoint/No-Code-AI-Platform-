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
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      await authApi.forgotPassword(email);
    } catch {
      // The endpoint is intentionally anti-enumeration — always 200.
      // Any client-side error is irrelevant to the UI flow.
    } finally {
      setSubmitting(false);
      setSubmitted(true);
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
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Forgot your password?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enter the email tied to your account. If we find a match, we'll
            send a reset link.
          </Typography>

          {submitted ? (
            <>
              <Alert severity="success" sx={{ mb: 3 }}>
                If <b>{email}</b> matches an account, a reset link is now in
                that inbox. The link expires in 30 minutes. In dev, check
                MailHog at{" "}
                <a href="http://localhost:8025" target="_blank" rel="noreferrer">
                  http://localhost:8025
                </a>
                .
              </Alert>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => navigate("/login")}
              >
                Back to Sign In
              </Button>
            </>
          ) : (
            <Box component="form" onSubmit={onSubmit}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                margin="normal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={submitting || !email}
                sx={{ mt: 3, py: 1.4 }}
              >
                {submitting ? "Sending..." : "Send reset link"}
              </Button>
              <Button
                fullWidth
                sx={{ mt: 1.5, color: "text.secondary" }}
                onClick={() => navigate("/login")}
              >
                Back to Sign In
              </Button>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
}

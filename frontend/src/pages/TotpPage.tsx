import { Alert, Box, Button, Container, Paper, TextField, Typography } from "@mui/material";
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
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Paper sx={{ p: 4, width: "100%" }}>
          <Typography variant="h5" gutterBottom>
            Two-Factor Authentication
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the 6-digit code from your authenticator app.
          </Typography>

          {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}

          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <TextField
              fullWidth
              label="Verification Code"
              inputProps={{ maxLength: 6, inputMode: "numeric" }}
              {...register("code", { required: true, pattern: /^\d{6}$/ })}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 2 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Verifying..." : "Verify"}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}

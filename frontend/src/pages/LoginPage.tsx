import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Box, Button, Container, Paper, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../hooks/useAuth";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setApiError(null);
    try {
      const result = await login(data.email, data.password);
      if (result.requires2FA) {
        navigate("/2fa", { state: { session_token: result.session_token } });
      } else {
        navigate(result.user?.role === "super_admin" ? "/admin" : "/dashboard");
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setApiError(
        err.response?.data?.error === "invalid_credentials"
          ? "Invalid email or password"
          : "Login failed. Please try again."
      );
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Brand */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 4 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "2px",
                bgcolor: "#0b0d0e",
                color: "#fafaf7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "0.9rem",
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.04em",
              }}
            >
              AI
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
              NoCode AI
            </Typography>
          </Box>

          <Paper
            variant="outlined"
            sx={{
              p: { xs: 3, sm: 5 },
              width: "100%",
              maxWidth: 440,
            }}
          >
            <Typography
              variant="overline"
              sx={{ display: "block", mb: 0.5 }}
            >
              Sign in
            </Typography>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mb: 0.5 }}>
              Welcome back
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
              Sign in to your account to continue
            </Typography>

            {apiError && <Alert severity="error" sx={{ mb: 2.5 }}>{apiError}</Alert>}

            <Box component="form" onSubmit={handleSubmit(onSubmit)}>
              <TextField
                fullWidth
                label="Email"
                margin="normal"
                {...register("email")}
                error={!!errors.email}
                helperText={errors.email?.message}
                autoFocus
              />
              <TextField
                fullWidth
                label="Password"
                type="password"
                margin="normal"
                {...register("password")}
                error={!!errors.password}
                helperText={errors.password?.message}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{ mt: 3, py: 1.4 }}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </Button>
              <Button
                fullWidth
                sx={{ mt: 1.5 }}
                onClick={() => navigate("/register")}
              >
                Don't have an account? <Box component="span" sx={{ color: "primary.main", ml: 0.5 }}>Register</Box>
              </Button>
            </Box>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}

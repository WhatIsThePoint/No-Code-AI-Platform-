import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Box, Button, Container, Paper, TextField, Typography, alpha } from "@mui/material";
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
        navigate("/dashboard");
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
        background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f8fafc 100%)",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${alpha("#6366f1", 0.08)} 0%, transparent 70%)`,
          top: "-200px",
          right: "-100px",
          pointerEvents: "none",
        },
        "&::after": {
          content: '""',
          position: "absolute",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${alpha("#8b5cf6", 0.06)} 0%, transparent 70%)`,
          bottom: "-100px",
          left: "-100px",
          pointerEvents: "none",
        },
      }}
    >
      <Container maxWidth="sm" className="animate-scale-in">
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Brand */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 4 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "14px",
                background: "linear-gradient(135deg, #818cf8 0%, #6366f1 50%, #4f46e5 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "1.1rem",
                color: "#fff",
                boxShadow: `0 8px 25px -5px ${alpha("#6366f1", 0.4)}`,
              }}
            >
              AI
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: "-0.02em", color: "#0f172a" }}>
              NoCode AI
            </Typography>
          </Box>

          <Paper
            sx={{
              p: { xs: 3, sm: 5 },
              width: "100%",
              maxWidth: 440,
              borderRadius: 3,
              border: "1px solid",
              borderColor: alpha("#6366f1", 0.12),
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
                sx={{ mt: 1.5, color: "text.secondary" }}
                onClick={() => navigate("/register")}
              >
                Don't have an account? <Box component="span" sx={{ color: "primary.main", fontWeight: 600, ml: 0.5 }}>Register</Box>
              </Button>
            </Box>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}

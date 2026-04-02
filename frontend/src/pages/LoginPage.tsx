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
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Paper sx={{ p: 4, width: "100%" }}>
          <Typography variant="h5" gutterBottom>
            Sign In
          </Typography>

          {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}

          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <TextField
              fullWidth
              label="Email"
              margin="normal"
              {...register("email")}
              error={!!errors.email}
              helperText={errors.email?.message}
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
              sx={{ mt: 2 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
            <Button fullWidth sx={{ mt: 1 }} onClick={() => navigate("/register")}>
              Don't have an account? Register
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}

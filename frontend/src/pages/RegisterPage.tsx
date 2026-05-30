import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Box,
  Button,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  alpha,
} from "@mui/material";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { authApi } from "../api/auth";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().min(1, "Full name required"),
  role: z.enum(["data_scientist", "engineer", "analyst"]),
});

type FormData = z.infer<typeof schema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "data_scientist" },
  });

  const onSubmit = async (data: FormData) => {
    setApiError(null);
    try {
      await authApi.register(data);
      navigate("/login", {
        state: {
          message:
            "Account created. We just sent a verification link to " +
            data.email +
            " — open it (MailHog at http://localhost:8025 in dev) to activate the account.",
        },
      });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setApiError(
        err.response?.data?.error === "email_taken"
          ? "Email already in use"
          : "Registration failed. Please try again."
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
          background: `radial-gradient(circle, ${alpha("#8b5cf6", 0.08)} 0%, transparent 70%)`,
          top: "-200px",
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
                background: "linear-gradient(135deg, #818cf8 0%, #d2541c 50%, #a8401a 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "1.1rem",
                color: "#fff",
                boxShadow: `0 8px 25px -5px ${alpha("#d2541c", 0.4)}`,
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
              borderColor: alpha("#d2541c", 0.12),
              position: "relative",
              overflow: "hidden",
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "3px",
                background: "linear-gradient(90deg, #8b5cf6, #d2541c, #8b5cf6)",
                backgroundSize: "200% 100%",
                animation: "gradient-shift 3s ease infinite",
              },
            }}
          >
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, mb: 0.5 }}>
              Create Account
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
              Get started with your AI journey
            </Typography>

            {apiError && <Alert severity="error" sx={{ mb: 2.5 }}>{apiError}</Alert>}

            <Box component="form" onSubmit={handleSubmit(onSubmit)}>
              <TextField
                fullWidth
                label="Full Name"
                margin="normal"
                {...register("full_name")}
                error={!!errors.full_name}
                helperText={errors.full_name?.message}
                autoFocus
              />
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
              <FormControl fullWidth margin="normal">
                <InputLabel>Role</InputLabel>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <Select {...field} label="Role">
                      <MenuItem value="data_scientist">Data Scientist</MenuItem>
                      <MenuItem value="engineer">Engineer</MenuItem>
                      <MenuItem value="analyst">Analyst</MenuItem>
                    </Select>
                  )}
                />
              </FormControl>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{ mt: 3, py: 1.4 }}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating account..." : "Create Account"}
              </Button>
              <Button
                fullWidth
                sx={{ mt: 1.5, color: "text.secondary" }}
                onClick={() => navigate("/login")}
              >
                Already have an account? <Box component="span" sx={{ color: "primary.main", fontWeight: 600, ml: 0.5 }}>Sign in</Box>
              </Button>
            </Box>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}

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
      navigate("/login", { state: { message: "Account created! Please sign in." } });
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
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Paper sx={{ p: 4, width: "100%" }}>
          <Typography variant="h5" gutterBottom>
            Create Account
          </Typography>

          {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}

          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <TextField
              fullWidth
              label="Full Name"
              margin="normal"
              {...register("full_name")}
              error={!!errors.full_name}
              helperText={errors.full_name?.message}
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
              sx={{ mt: 2 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating account..." : "Register"}
            </Button>
            <Button fullWidth sx={{ mt: 1 }} onClick={() => navigate("/login")}>
              Already have an account? Sign in
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}

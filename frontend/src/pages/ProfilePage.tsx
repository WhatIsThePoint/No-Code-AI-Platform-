import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Box,
  Button,
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
import { z } from "zod";
import { authApi } from "../api/auth";
import { useAuthStore } from "../store/authSlice";

const schema = z.object({
  full_name: z.string().min(1),
  role: z.enum(["data_scientist", "engineer", "analyst"]),
});

type FormData = z.infer<typeof schema>;

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: user?.full_name ?? "",
      role: user?.role ?? "data_scientist",
    },
  });

  const onSubmit = async (data: FormData) => {
    setSuccess(false);
    setError(null);
    try {
      const { data: updated } = await authApi.updateMe(data);
      setAuth(updated, accessToken!);
      setSuccess(true);
    } catch {
      setError("Failed to update profile");
    }
  };

  return (
    <Box maxWidth={500}>
      <Typography variant="h4" gutterBottom>
        Profile
      </Typography>
      <Paper sx={{ p: 3 }}>
        {success && <Alert severity="success" sx={{ mb: 2 }}>Profile updated</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          <TextField
            fullWidth
            label="Email"
            value={user?.email}
            disabled
            margin="normal"
          />
          <TextField
            fullWidth
            label="Full Name"
            margin="normal"
            {...register("full_name")}
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
          <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={isSubmitting}>
            Save Changes
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

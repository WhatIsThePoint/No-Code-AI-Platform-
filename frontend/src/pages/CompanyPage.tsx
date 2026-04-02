import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import api from "../api/axios";

interface Member {
  user_id: string;
  role: string;
  status: string;
}

export function CompanyPage() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createForm = useForm<{ name: string; slug?: string }>();
  const inviteForm = useForm<{ email: string; role: string }>({
    defaultValues: { role: "viewer" },
  });

  const handleCreateCompany = async (data: { name: string; slug?: string }) => {
    try {
      const resp = await api.post("/companies", data);
      setCompanyId(resp.data.company_id);
      setCompanyName(resp.data.name);
      await loadMembers(resp.data.company_id);
    } catch {
      setError("Failed to create company");
    }
  };

  const loadMembers = async (cid: string) => {
    const resp = await api.get(`/companies/${cid}/members`);
    setMembers(resp.data);
  };

  const handleInvite = async (data: { email: string; role: string }) => {
    if (!companyId) return;
    try {
      await api.post(`/companies/${companyId}/invite`, data);
      setInviteOpen(false);
      inviteForm.reset();
    } catch {
      setError("Failed to send invite");
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Company
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!companyId ? (
        <Paper sx={{ p: 3, maxWidth: 400 }}>
          <Typography variant="h6" gutterBottom>Create a Company Project</Typography>
          <Box component="form" onSubmit={createForm.handleSubmit(handleCreateCompany)}>
            <TextField
              fullWidth
              label="Company Name"
              margin="normal"
              {...createForm.register("name", { required: true })}
            />
            <Button type="submit" variant="contained" sx={{ mt: 1 }}>
              Create
            </Button>
          </Box>
        </Paper>
      ) : (
        <Box>
          <Typography variant="h6" gutterBottom>{companyName}</Typography>
          <Button variant="outlined" sx={{ mb: 2 }} onClick={() => setInviteOpen(true)}>
            Invite Member
          </Button>

          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User ID</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell>{m.user_id}</TableCell>
                  <TableCell>{m.role}</TableCell>
                  <TableCell>{m.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)}>
        <DialogTitle>Invite Member</DialogTitle>
        <Box component="form" onSubmit={inviteForm.handleSubmit(handleInvite)}>
          <DialogContent>
            <TextField
              fullWidth
              label="Email"
              margin="normal"
              {...inviteForm.register("email", { required: true })}
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Role</InputLabel>
              <Controller
                name="role"
                control={inviteForm.control}
                render={({ field }) => (
                  <Select {...field} label="Role">
                    <MenuItem value="data_scientist">Data Scientist</MenuItem>
                    <MenuItem value="pm">Project Manager</MenuItem>
                    <MenuItem value="analyst">Analyst</MenuItem>
                    <MenuItem value="viewer">Viewer</MenuItem>
                  </Select>
                )}
              />
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Invite</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}

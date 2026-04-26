import { useEffect, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  alpha,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineRounded";
import GroupsIcon from "@mui/icons-material/GroupsRounded";
import { companiesApi, type CompanyMember } from "../api/companies";
import { projectsApi } from "../api/projects";
import type { Pipeline } from "../types/pipeline";
import type { ProjectMember, ProjectRole } from "../types/project";

const ROLE_LABEL: Record<ProjectRole, string> = {
  viewer: "Viewer",
  editor: "Editor",
  admin: "Project Manager",
};

interface Props {
  pipeline: Pipeline;
}

export function ManageAccessTab({ pipeline }: Props) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([]);
  const [pendingUser, setPendingUser] = useState<CompanyMember | null>(null);
  const [pendingRole, setPendingRole] = useState<ProjectRole>("viewer");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const projectId = pipeline.pipeline_id;
  const companyId = pipeline.company_id;

  const reload = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [pmRes, cmRes] = await Promise.all([
        projectsApi.listMembers(projectId),
        companiesApi.listMembers(companyId),
      ]);
      setMembers(pmRes.data.members);
      setCompanyMembers(cmRes.data.filter((m) => m.status === "active"));
    } catch {
      setError("Failed to load access list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, companyId]);

  if (!companyId) {
    return (
      <Alert severity="info" sx={{ m: 3 }}>
        This is a personal project. Only you can access it. Convert it to a
        company project to share with teammates.
      </Alert>
    );
  }

  const candidatePool = companyMembers.filter(
    (cm) => !members.find((m) => m.user_id === cm.user_id)
  );

  const handleAdd = async () => {
    if (!pendingUser || !companyId) return;
    setError(null);
    try {
      await projectsApi.addMember(projectId, {
        user_id: pendingUser.user_id,
        role: pendingRole,
        company_id: companyId,
      });
      setPendingUser(null);
      setPendingRole("viewer");
      await reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response
        ?.data?.error;
      setError(msg || "Failed to add member.");
    }
  };

  const handleRoleChange = async (userId: string, role: ProjectRole) => {
    if (!companyId) return;
    setError(null);
    try {
      await projectsApi.updateMember(projectId, {
        user_id: userId,
        role,
        company_id: companyId,
      });
      await reload();
    } catch {
      setError("Failed to update role.");
    }
  };

  const handleRemove = async (userId: string) => {
    if (!companyId) return;
    setError(null);
    try {
      await projectsApi.removeMember(projectId, userId, companyId);
      await reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response
        ?.data?.error;
      setError(msg || "Failed to remove member.");
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 880 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "10px",
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <GroupsIcon sx={{ fontSize: 20 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Manage access
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Decide who from your company can view, edit, or manage this project.
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3, border: 1, borderColor: alpha("#6366f1", 0.15) }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>
          Add a teammate
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="stretch">
          <Autocomplete
            sx={{ flex: 1 }}
            options={candidatePool}
            value={pendingUser}
            onChange={(_, v) => setPendingUser(v)}
            getOptionLabel={(o) => o.full_name || o.email}
            renderInput={(params) => (
              <TextField {...params} label="Teammate" size="small" />
            )}
          />
          <Select
            size="small"
            value={pendingRole}
            onChange={(e) => setPendingRole(e.target.value as ProjectRole)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="viewer">Viewer</MenuItem>
            <MenuItem value="editor">Editor</MenuItem>
            <MenuItem value="admin">Project Manager</MenuItem>
          </Select>
          <Button variant="contained" disabled={!pendingUser} onClick={handleAdd}>
            Add
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ overflow: "hidden" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Member</TableCell>
              <TableCell>Email</TableCell>
              <TableCell sx={{ width: 220 }}>Role</TableCell>
              <TableCell align="right" sx={{ width: 80 }}>
                Remove
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading && members.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    No members yet. Add a teammate above.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {members.map((m) => (
              <TableRow key={m.user_id} hover>
                <TableCell sx={{ fontWeight: 600 }}>
                  {m.full_name || "—"}
                </TableCell>
                <TableCell sx={{ color: "text.secondary" }}>{m.email}</TableCell>
                <TableCell>
                  <Select
                    size="small"
                    value={m.role}
                    onChange={(e) =>
                      handleRoleChange(m.user_id, e.target.value as ProjectRole)
                    }
                    fullWidth
                  >
                    <MenuItem value="viewer">{ROLE_LABEL.viewer}</MenuItem>
                    <MenuItem value="editor">{ROLE_LABEL.editor}</MenuItem>
                    <MenuItem value="admin">
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {ROLE_LABEL.admin}
                        <Chip label="PM" size="small" sx={{ height: 18, fontSize: "0.65rem" }} />
                      </Box>
                    </MenuItem>
                  </Select>
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleRemove(m.user_id)}>
                    <DeleteOutlineIcon fontSize="small" color="error" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

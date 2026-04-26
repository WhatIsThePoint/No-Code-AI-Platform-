import { useEffect, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import GroupsIcon from "@mui/icons-material/GroupsRounded";
import PersonIcon from "@mui/icons-material/PersonRounded";
import { companiesApi, type CompanyMember } from "../api/companies";
import { pipelinesApi } from "../api/pipelines";
import { projectsApi } from "../api/projects";
import { useMyCompany } from "../hooks/useMyCompany";
import type { OwnerType, Pipeline, PipelineType } from "../types/pipeline";
import type { ProjectRole } from "../types/project";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (pipeline: Pipeline) => void;
}

interface SelectedMember extends CompanyMember {
  projectRole: ProjectRole;
}

export function CreatePipelineDialog({ open, onClose, onCreated }: Props) {
  const { company, loading: companyLoading } = useMyCompany();

  const [name, setName] = useState("");
  const [type, setType] = useState<PipelineType>("ml");
  const [ownerType, setOwnerType] = useState<OwnerType>("personal");
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([]);
  const [selected, setSelected] = useState<SelectedMember[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setType("ml");
    setOwnerType("personal");
    setSelected([]);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (ownerType !== "company" || !company) return;
    companiesApi
      .listMembers(company.company_id)
      .then((r) => setCompanyMembers(r.data.filter((m) => m.status === "active")))
      .catch(() => setCompanyMembers([]));
  }, [ownerType, company]);

  const canSubmit = name.trim().length > 0 && (ownerType === "personal" || !!company);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await pipelinesApi.create({
        name: name.trim(),
        type,
        owner_type: ownerType,
        company_id: ownerType === "company" ? company?.company_id : undefined,
      });
      // Grant the chosen members access (admin assigning roles).
      if (ownerType === "company" && company && selected.length > 0) {
        const projectId = created.data.pipeline_id;
        await Promise.all(
          selected.map((m) =>
            projectsApi
              .addMember(projectId, {
                user_id: m.user_id,
                role: m.projectRole,
                company_id: company.company_id,
              })
              .catch(() => null)
          )
        );
      }
      onCreated(created.data);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response
        ?.data?.error;
      setError(msg || "Failed to create pipeline");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>New pipeline</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <TextField
            label="Pipeline name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
          />

          <FormControl>
            <FormLabel sx={{ fontWeight: 600, mb: 0.5 }}>Type</FormLabel>
            <RadioGroup
              row
              value={type}
              onChange={(_, v) => setType(v as PipelineType)}
            >
              <FormControlLabel value="ml" control={<Radio />} label="ML training" />
              <FormControlLabel value="rag" control={<Radio />} label="RAG / GenAI" />
            </RadioGroup>
          </FormControl>

          <FormControl>
            <FormLabel sx={{ fontWeight: 600, mb: 0.5 }}>Workspace</FormLabel>
            <RadioGroup
              value={ownerType}
              onChange={(_, v) => setOwnerType(v as OwnerType)}
            >
              <FormControlLabel
                value="personal"
                control={<Radio />}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <PersonIcon fontSize="small" />
                    <Typography>Personal — only you</Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="company"
                disabled={!company && !companyLoading}
                control={<Radio />}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <GroupsIcon fontSize="small" />
                    <Typography>
                      Company{company ? ` — ${company.name}` : ""}
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
            {!company && !companyLoading && (
              <Typography variant="caption" sx={{ color: "text.secondary", mt: 0.5 }}>
                You don't belong to a company yet — only personal projects are available.
              </Typography>
            )}
          </FormControl>

          {ownerType === "company" && company && (
            <Box>
              <FormLabel sx={{ fontWeight: 600, mb: 0.5, display: "block" }}>
                Add members (optional)
              </FormLabel>
              <Autocomplete
                multiple
                options={companyMembers.filter(
                  (m) => !selected.find((s) => s.user_id === m.user_id)
                )}
                getOptionLabel={(o) => o.full_name || o.email}
                value={selected}
                onChange={(_, value) =>
                  setSelected(
                    value.map((m) => {
                      const existing = selected.find((s) => s.user_id === m.user_id);
                      return existing
                        ? existing
                        : { ...(m as CompanyMember), projectRole: "viewer" as ProjectRole };
                    })
                  )
                }
                renderTags={(value, getTagProps) =>
                  value.map((m, idx) => (
                    <Chip
                      label={m.full_name || m.email}
                      {...getTagProps({ index: idx })}
                      key={m.user_id}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search teammates..."
                  />
                )}
              />
              {selected.length > 0 && (
                <Stack spacing={1} sx={{ mt: 1.5 }}>
                  {selected.map((m) => (
                    <Box
                      key={m.user_id}
                      sx={{ display: "flex", alignItems: "center", gap: 1 }}
                    >
                      <Typography sx={{ flex: 1 }}>{m.full_name || m.email}</Typography>
                      <Select
                        size="small"
                        value={m.projectRole}
                        onChange={(e) =>
                          setSelected((prev) =>
                            prev.map((s) =>
                              s.user_id === m.user_id
                                ? { ...s, projectRole: e.target.value as ProjectRole }
                                : s
                            )
                          )
                        }
                      >
                        <MenuItem value="viewer">Viewer</MenuItem>
                        <MenuItem value="editor">Editor</MenuItem>
                        <MenuItem value="admin">Project Manager</MenuItem>
                      </Select>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? "Creating..." : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

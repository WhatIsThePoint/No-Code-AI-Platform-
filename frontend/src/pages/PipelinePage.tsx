import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pipelinesApi } from "../api/pipelines";
import type { Pipeline } from "../types/pipeline";

const STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error"> = {
  draft: "default",
  running: "warning",
  done: "success",
  error: "error",
};

export function PipelinePage() {
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await pipelinesApi.list();
      setPipelines(data.items);
    } catch {
      setError("Failed to load pipelines");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data } = await pipelinesApi.create({ name: newName.trim() });
      navigate(`/pipelines/${data.pipeline_id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this pipeline?")) return;
    await pipelinesApi.delete(id);
    load();
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>ML Pipelines</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : pipelines.length === 0 ? (
        <Box sx={{ textAlign: "center", mt: 6, color: "text.secondary" }}>
          <Typography variant="h6">No pipelines yet</Typography>
          <Typography variant="body2">Create your first pipeline to start training models.</Typography>
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 2 }}>
          {pipelines.map((p) => (
            <Card key={p.pipeline_id} variant="outlined">
              <CardActionArea onClick={() => navigate(`/pipelines/${p.pipeline_id}`)}>
                <CardContent>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1 }}>{p.name}</Typography>
                    <Chip
                      label={p.status}
                      size="small"
                      color={STATUS_COLOR[p.status] ?? "default"}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {p.nodes.length} nodes · Updated {new Date(p.updated_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </CardActionArea>
              <Box sx={{ px: 2, pb: 1, display: "flex", justifyContent: "flex-end" }}>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={(e) => handleDelete(e, p.pipeline_id)}
                >
                  Delete
                </Button>
              </Box>
            </Card>
          ))}
        </Box>
      )}

      <Fab
        color="primary"
        sx={{ position: "fixed", bottom: 24, right: 24 }}
        onClick={() => setCreateOpen(true)}
      >
        <AddIcon />
      </Fab>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Pipeline</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Pipeline name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            fullWidth
            margin="normal"
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
          >
            {creating ? <CircularProgress size={16} /> : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

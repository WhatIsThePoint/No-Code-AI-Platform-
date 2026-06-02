import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Fab,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import AccountTreeIcon from "@mui/icons-material/AccountTreeRounded";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { pipelinesApi } from "../api/pipelines";
import type { Pipeline } from "../types/pipeline";
import { EmptyStateHero } from "../components/common/EmptyStateHero";
import { CardSkeletonGrid } from "../components/common/CardSkeletonGrid";
import { CreatePipelineDialog } from "../components/CreatePipelineDialog";

const STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error"> = {
  draft: "default",
  running: "warning",
  done: "success",
  error: "error",
};

export function PipelinePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

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

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this pipeline?")) return;
    await pipelinesApi.delete(id);
    load();
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "12px",
            background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <AccountTreeIcon sx={{ fontSize: 22 }} />
        </Box>
        <Typography variant="h4">ML Pipelines</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <CardSkeletonGrid count={6} />
      ) : pipelines.length === 0 ? (
        <EmptyStateHero
          icon={AccountTreeIcon}
          title={t("emptyStates.pipelines.title")}
          description={t("emptyStates.pipelines.description")}
          actionLabel={t("emptyStates.pipelines.action")}
          onAction={() => setCreateOpen(true)}
          accent="#8b5cf6"
        />
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 2.5 }} className="stagger-children">
          {pipelines.map((p) => (
            <Card key={p.pipeline_id}>
              <CardActionArea onClick={() => navigate(`/pipelines/${p.pipeline_id}`)}>
                <CardContent>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                    <Typography variant="h6" noWrap sx={{ flex: 1, mr: 1, fontSize: "1rem" }}>{p.name}</Typography>
                    <Chip
                      label={p.status}
                      size="small"
                      color={STATUS_COLOR[p.status] ?? "default"}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
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
                  sx={{ "&:hover": { transform: "none" } }}
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
        sx={{ position: "fixed", bottom: 32, right: 32 }}
        onClick={() => setCreateOpen(true)}
      >
        <AddIcon />
      </Fab>

      <CreatePipelineDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(p) => {
          setCreateOpen(false);
          navigate(`/pipelines/${p.pipeline_id}`);
        }}
      />
    </Box>
  );
}

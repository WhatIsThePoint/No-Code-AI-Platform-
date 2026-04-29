import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Grid,
  IconButton,
  Snackbar,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AnnouncementIcon from "@mui/icons-material/Announcement";
import StorageIcon from "@mui/icons-material/StorageRounded";
import CheckCircleIcon from "@mui/icons-material/CheckCircleRounded";
import AccountTreeIcon from "@mui/icons-material/AccountTreeRounded";
import ModelTrainingIcon from "@mui/icons-material/ModelTrainingRounded";
import GroupsIcon from "@mui/icons-material/GroupsRounded";
import PersonIcon from "@mui/icons-material/PersonRounded";
import { useAuthStore } from "../store/authSlice";
import { useDatasets } from "../hooks/useDatasets";
import { useMyCompany } from "../hooks/useMyCompany";
import { datasetsApi } from "../api/datasets";
import { pipelinesApi } from "../api/pipelines";
import { billingApi } from "../api/billing";
import { CreatePipelineDialog } from "../components/CreatePipelineDialog";
import type { OwnerType, Pipeline } from "../types/pipeline";
import type { Dataset } from "../types/dataset";
import type { Announcement } from "../types/billing";
import { UploadQuotaCard } from "../components/common/UploadQuotaCard";
import { DemoDatasetButton } from "../components/common/DemoDatasetButton";
import { SetupChecklist } from "../components/common/SetupChecklist";
import { formatRelativeTime } from "../lib/relativeTime";
import { useUsersCache } from "../store/usersCacheSlice";
import { RenameableTitle } from "../components/common/RenameableTitle";
import { CardSkeletonGrid } from "../components/common/CardSkeletonGrid";

const STAT_CARDS = [
  { key: "datasets", i18nKey: "datasets", icon: <StorageIcon />, gradient: "linear-gradient(135deg, #6366f1, #4f46e5)" },
  { key: "ready", i18nKey: "ready", icon: <CheckCircleIcon />, gradient: "linear-gradient(135deg, #10b981, #059669)" },
  { key: "pipelines", i18nKey: "pipelines", icon: <AccountTreeIcon />, gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)" },
  { key: "trained", i18nKey: "trained", icon: <ModelTrainingIcon />, gradient: "linear-gradient(135deg, #3b82f6, #2563eb)" },
] as const;

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { datasets, refetch: refetchDatasets } = useDatasets();
  const { company } = useMyCompany();

  const usersById = useUsersCache((s) => s.byId);
  const resolveUser = useUsersCache((s) => s.resolve);

  const renderEditStamp = (
    last_edited_at: string | undefined,
    last_edited_by: string | undefined,
  ) => {
    if (!last_edited_at) return null;
    const when = formatRelativeTime(last_edited_at, i18n.resolvedLanguage ?? "en");
    if (!when) return null;
    const isYou = last_edited_by && user?.id && last_edited_by === user.id;
    let label: string;
    if (isYou) {
      label = t("stamps.editedByYou", { when });
    } else if (last_edited_by) {
      const cached = usersById[last_edited_by];
      const display = cached?.full_name || cached?.email || null;
      if (display) {
        label = `${t("common.editedBy", { name: display })} · ${when}`;
      } else {
        // Lazily fetch and let the next render pick it up.
        if (cached === undefined) void resolveUser(last_edited_by);
        label = t("stamps.editedByOther", { when });
      }
    } else {
      label = t("stamps.editedByOther", { when });
    }
    return (
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", display: "block", mt: 0.25, fontSize: "0.68rem" }}
      >
        {label}
      </Typography>
    );
  };
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tab, setTab] = useState(0);
  const [workspaceFilter, setWorkspaceFilter] = useState<OwnerType>("personal");
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: "" });

  useEffect(() => {
    setPipelineLoading(true);
    const params: { owner_type?: OwnerType; company_id?: string } = {};
    if (workspaceFilter === "company" && company) {
      params.owner_type = "company";
      params.company_id = company.company_id;
    } else if (workspaceFilter === "personal") {
      params.owner_type = "personal";
    }
    pipelinesApi
      .list(params)
      .then((r) => setPipelines(r.data.items))
      .catch(() => setPipelines([]))
      .finally(() => setPipelineLoading(false));
    billingApi.getAnnouncements().then((r) => setAnnouncements(r.data)).catch(() => {});
  }, [workspaceFilter, company]);

  const visiblePipelineCount = useMemo(() => pipelines.length, [pipelines]);

  const stats = {
    datasets: datasets.length,
    pipelines: pipelines.length,
    ready: datasets.filter((d) => d.status === "ready" || d.status === "preprocessed").length,
    trained: pipelines.filter((p) => p.status === "done").length,
  };

  const checklistState = {
    hasDataset: stats.datasets > 0,
    hasPipeline: stats.pipelines > 0,
    hasTrainedModel: stats.trained > 0,
    // Treat "teammate present" as: the user is in a company workspace and at
    // least one company-scoped pipeline exists (cheap proxy — avoids a second
    // fetch just to populate the checklist).
    hasTeammate: !!company,
  };

  const handleDeleteDataset = async (id: string) => {
    try {
      await datasetsApi.delete(id);
      refetchDatasets();
      setSnack({ open: true, msg: "Dataset deleted" });
    } catch {
      setSnack({ open: true, msg: "Delete failed" });
    }
  };

  const handleDeletePipeline = async (id: string) => {
    try {
      await pipelinesApi.delete(id);
      setPipelines((prev) => prev.filter((p) => p.pipeline_id !== id));
      setSnack({ open: true, msg: "Pipeline deleted" });
    } catch {
      setSnack({ open: true, msg: "Delete failed" });
    }
  };

  const handleDuplicatePipeline = async (pipeline: Pipeline) => {
    try {
      const res = await pipelinesApi.create({
        name: `${pipeline.name} (copy)`,
        owner_type: pipeline.owner_type ?? "personal",
        company_id: pipeline.company_id ?? undefined,
        nodes: pipeline.nodes,
        edges: pipeline.edges,
      });
      setPipelines((prev) => [res.data as unknown as Pipeline, ...prev]);
      setSnack({ open: true, msg: "Pipeline duplicated" });
    } catch {
      setSnack({ open: true, msg: "Duplicate failed" });
    }
  };

  return (
    <Box>
      {/* Announcements */}
      {announcements.map((a) => (
        <Alert
          key={a.id}
          icon={<AnnouncementIcon />}
          severity="info"
          sx={{
            mb: 2,
            borderRadius: 3,
            border: "1px solid",
            borderColor: alpha("#6366f1", 0.15),
            bgcolor: alpha("#6366f1", 0.04),
          }}
        >
          <strong>{a.title}</strong> — {a.body}
        </Alert>
      ))}

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 0.5 }}>
          {t("dashboard.welcome", { name: user?.full_name ?? user?.email })}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {t("dashboard.overview")}
        </Typography>
      </Box>

      {/* Setup checklist */}
      <SetupChecklist state={checklistState} />

      {/* Stats */}
      <Grid container spacing={2.5} sx={{ mb: 4 }} className="stagger-children">
        {STAT_CARDS.map(({ key, i18nKey, icon, gradient }) => (
          <Grid item xs={6} sm={3} key={key}>
            <Card
              sx={{
                position: "relative",
                overflow: "hidden",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: 4,
                },
              }}
            >
              <CardContent sx={{ pb: "16px !important" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
                    {t(`dashboard.stats.${i18nKey}`)}
                  </Typography>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: "10px",
                      background: gradient,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      "& .MuiSvgIcon-root": { fontSize: 20 },
                    }}
                  >
                    {icon}
                  </Box>
                </Box>
                <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1 }}>
                  {stats[key]}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Upload Quota */}
      <UploadQuotaCard datasets={datasets} />

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={t("dashboard.tabs.datasets", { count: datasets.length })} />
        <Tab label={t("dashboard.tabs.pipelines", { count: visiblePipelineCount })} />
      </Tabs>

      {/* Datasets tab */}
      {tab === 0 && (
        <Box>
          <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, flexWrap: "wrap" }}>
            <Button
              variant="contained"
              size="small"
              onClick={() => navigate("/data")}
            >
              {t("dashboard.actions.newDataset")}
            </Button>
            {datasets.length === 0 && (
              <DemoDatasetButton size="small" onDone={refetchDatasets} />
            )}
          </Box>
          <Grid container spacing={2} className="stagger-children">
            {datasets.map((d: Dataset) => (
              <Grid item xs={12} sm={6} md={4} key={d.dataset_id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                      <RenameableTitle
                        value={d.name}
                        onSave={async (name) => {
                          try {
                            const { data } = await datasetsApi.rename(d.dataset_id, { name });
                            // Optimistic local update via refetch — keeps the
                            // card in sync with whatever the server normalized.
                            void data;
                            refetchDatasets();
                            setSnack({ open: true, msg: t("rename.succeeded") });
                          } catch {
                            setSnack({ open: true, msg: t("rename.failed") });
                            throw new Error("rename_failed");
                          }
                        }}
                      />
                      <Chip
                        label={d.status}
                        size="small"
                        color={d.status === "preprocessed" || d.status === "ready" ? "success" : d.status === "error" ? "error" : "default"}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {d.source_type.toUpperCase()} · {d.row_count?.toLocaleString() ?? "?"} rows
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
                      {new Date(d.created_at).toLocaleDateString()}
                    </Typography>
                    {renderEditStamp(d.last_edited_at, d.last_edited_by)}
                  </CardContent>
                  <CardActions sx={{ pt: 0, px: 2, pb: 1.5 }}>
                    <Tooltip title={t("common.open")}>
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/data/${d.dataset_id}`)}
                        aria-label={t("common.open")}
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t("common.delete")}>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteDataset(d.dataset_id)}
                        aria-label={t("common.delete")}
                      >
                        <DeleteIcon fontSize="small" color="error" />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Pipelines tab */}
      {tab === 1 && (
        <Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              mb: 2.5,
              flexWrap: "wrap",
            }}
          >
            <ToggleButtonGroup
              size="small"
              exclusive
              value={workspaceFilter}
              onChange={(_, v) => v && setWorkspaceFilter(v)}
            >
              <ToggleButton value="personal">
                <PersonIcon fontSize="small" sx={{ mr: 0.5 }} /> {t("dashboard.workspaceFilter.personal")}
              </ToggleButton>
              <ToggleButton value="company" disabled={!company}>
                <GroupsIcon fontSize="small" sx={{ mr: 0.5 }} /> {t("dashboard.workspaceFilter.company")}
                {company ? ` — ${company.name}` : ""}
              </ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ flex: 1 }} />
            <Button
              variant="contained"
              size="small"
              onClick={() => setCreateOpen(true)}
            >
              {t("dashboard.actions.newPipeline")}
            </Button>
          </Box>
          {pipelineLoading ? (
            <CardSkeletonGrid count={3} metaLines={2} />
          ) : (
            <Grid container spacing={2} className="stagger-children">
              {pipelines.map((p: Pipeline) => (
                <Grid item xs={12} sm={6} md={4} key={p.pipeline_id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                        <RenameableTitle
                          value={p.name}
                          onSave={async (name) => {
                            try {
                              const { data } = await pipelinesApi.update(p.pipeline_id, { name });
                              setPipelines((prev) =>
                                prev.map((x) => (x.pipeline_id === p.pipeline_id ? data : x)),
                              );
                              setSnack({ open: true, msg: t("rename.succeeded") });
                            } catch {
                              setSnack({ open: true, msg: t("rename.failed") });
                              throw new Error("rename_failed");
                            }
                          }}
                        />
                        <Chip
                          label={p.status}
                          size="small"
                          color={p.status === "done" ? "success" : p.status === "error" ? "error" : p.status === "running" ? "warning" : "default"}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {t("dashboard.pipelineCard.nodeCount", { count: p.nodes.length })}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
                        {new Date(p.updated_at).toLocaleDateString()}
                      </Typography>
                      {renderEditStamp(p.last_edited_at, p.last_edited_by)}
                    </CardContent>
                    <CardActions sx={{ pt: 0, px: 2, pb: 1.5 }}>
                      <Tooltip title={t("common.open")}>
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/pipelines/${p.pipeline_id}`)}
                          aria-label={t("common.open")}
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t("common.duplicate")}>
                        <IconButton
                          size="small"
                          onClick={() => handleDuplicatePipeline(p)}
                          aria-label={t("common.duplicate")}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t("common.delete")}>
                        <IconButton
                          size="small"
                          onClick={() => handleDeletePipeline(p.pipeline_id)}
                          aria-label={t("common.delete")}
                        >
                          <DeleteIcon fontSize="small" color="error" />
                        </IconButton>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        message={snack.msg}
      />

      <CreatePipelineDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(p) => {
          setPipelines((prev) => [p, ...prev]);
          if (p.owner_type === "company") setWorkspaceFilter("company");
          else setWorkspaceFilter("personal");
          setSnack({ open: true, msg: "Pipeline created" });
          navigate(`/pipelines/${p.pipeline_id}`);
        }}
      />
    </Box>
  );
}

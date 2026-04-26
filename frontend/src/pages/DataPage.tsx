import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Paper,
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
import CloudUploadIcon from "@mui/icons-material/CloudUploadRounded";
import StorageIcon from "@mui/icons-material/StorageRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import { useEffect, useRef, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { datasetsApi } from "../api/datasets";
import { useDatasets } from "../hooks/useDatasets";
import { useTaskStatus } from "../hooks/useTaskStatus";
import type { DatasetStatus } from "../types/dataset";
import { UploadQuotaCard } from "../components/common/UploadQuotaCard";
import { DemoDatasetButton } from "../components/common/DemoDatasetButton";

const statusColor = (s: DatasetStatus) => {
  if (s === "ready" || s === "preprocessed") return "success";
  if (s === "error") return "error";
  if (s === "profiling" || s === "preprocessing") return "warning";
  return "default";
};

function UploadRow({ onDone }: { onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<{ message: string; isLimit: boolean } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const { result } = useTaskStatus(taskId);
  const reportedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!taskId) return;
    if (result?.status !== "success" && result?.status !== "failure") return;
    if (reportedRef.current === taskId) return;
    reportedRef.current = taskId;
    onDone();
    setTaskId(null);
  }, [taskId, result?.status, onDone]);

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setDescription("");
    setUploadError(null);
    setDialogOpen(true);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleConfirmUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const { data } = await datasetsApi.upload(pendingFile, {
        description: description.trim() || undefined,
      });
      setTaskId(data.task_id);
      setDialogOpen(false);
      setPendingFile(null);
      setDescription("");
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { error?: string; limit?: string; max?: number } } }).response;
      if (resp?.status === 402) {
        const limit = resp.data?.limit;
        const max = resp.data?.max;
        const msg = limit === "max_file_size_mb"
          ? `File exceeds the ${max} MB limit for your plan.`
          : `You've reached the maximum of ${max} datasets on your plan.`;
        setUploadError({ message: msg, isLimit: true });
      } else {
        setUploadError({ message: "Upload failed. Please try again.", isLimit: false });
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: "none" }}
        onChange={handleFilePicked}
      />
      <Button
        variant="contained"
        startIcon={<CloudUploadIcon />}
        onClick={() => inputRef.current?.click()}
        disabled={uploading || !!taskId}
      >
        {uploading ? "Uploading..." : "Upload CSV / Excel"}
      </Button>

      <Dialog
        open={dialogOpen}
        onClose={() => !uploading && setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Add dataset context</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {pendingFile && (
              <Chip
                icon={<CloudUploadIcon />}
                label={pendingFile.name}
                variant="outlined"
                sx={{ alignSelf: "flex-start", maxWidth: "100%" }}
              />
            )}
            <TextField
              label="Dataset Description"
              placeholder="Optional: paste the Kaggle description, column meanings, or any business context here. The AI uses this to suggest better preprocessing and models."
              helperText="Optional but recommended — improves the AI's guidance throughout the pipeline."
              multiline
              minRows={4}
              maxRows={10}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmUpload}
            disabled={uploading || !pendingFile}
            startIcon={<CloudUploadIcon />}
          >
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogActions>
      </Dialog>

      {uploadError && (
        <Alert
          severity={uploadError.isLimit ? "warning" : "error"}
          sx={{ mt: 2, maxWidth: 520 }}
          icon={uploadError.isLimit ? <RocketLaunchRoundedIcon /> : undefined}
          action={
            uploadError.isLimit ? (
              <Button component={RouterLink} to="/billing" color="inherit" size="small" sx={{ fontWeight: 700 }}>
                Upgrade
              </Button>
            ) : undefined
          }
          onClose={() => setUploadError(null)}
        >
          {uploadError.message}
        </Alert>
      )}

      {taskId && result && result.status !== "success" && result.status !== "failure" && (
        <Box sx={{ mt: 1.5, maxWidth: 360 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
            {result.status === "pending" ? "Queued..." : "Profiling..."} {result.progress_pct}%
          </Typography>
          <LinearProgress variant="determinate" value={result.progress_pct} sx={{ mt: 0.5 }} />
        </Box>
      )}
    </Box>
  );
}

export function DataPage() {
  const { datasets, refetch } = useDatasets();
  const navigate = useNavigate();

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "12px",
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <StorageIcon sx={{ fontSize: 22 }} />
        </Box>
        <Typography variant="h4">Datasets</Typography>
      </Box>

      <UploadQuotaCard datasets={datasets} />

      <UploadRow onDone={refetch} />

      <Paper sx={{ overflow: "hidden" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Rows</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {datasets.map((d) => (
              <TableRow
                key={d.dataset_id}
                hover
                sx={{
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  "&:hover": {
                    bgcolor: `${alpha("#6366f1", 0.04)} !important`,
                  },
                }}
                onClick={() => navigate(`/data/${d.dataset_id}`)}
              >
                <TableCell sx={{ fontWeight: 600 }}>{d.name}</TableCell>
                <TableCell>
                  <Chip label={d.source_type.toUpperCase()} size="small" variant="outlined" sx={{ fontSize: "0.7rem" }} />
                </TableCell>
                <TableCell>{d.row_count?.toLocaleString() ?? "—"}</TableCell>
                <TableCell>
                  <Chip label={d.status} color={statusColor(d.status)} size="small" />
                </TableCell>
                <TableCell sx={{ color: "text.secondary" }}>
                  {new Date(d.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
            {datasets.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
                    No datasets yet. Upload a file or try the demo to get started.
                  </Typography>
                  <DemoDatasetButton onDone={refetch} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

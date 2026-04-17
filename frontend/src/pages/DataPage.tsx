import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  alpha,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUploadRounded";
import StorageIcon from "@mui/icons-material/StorageRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import { useRef, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { datasetsApi } from "../api/datasets";
import { useDatasets } from "../hooks/useDatasets";
import { useTaskStatus } from "../hooks/useTaskStatus";
import type { DatasetStatus } from "../types/dataset";

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
  const { result } = useTaskStatus(taskId);

  if (result?.status === "success" || result?.status === "failure") {
    onDone();
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const { data } = await datasetsApi.upload(file);
      setTaskId(data.task_id);
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
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <Button
        variant="contained"
        startIcon={<CloudUploadIcon />}
        onClick={() => inputRef.current?.click()}
        disabled={uploading || !!taskId}
      >
        {uploading ? "Uploading..." : "Upload CSV / Excel"}
      </Button>

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
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    No datasets yet. Upload a file to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

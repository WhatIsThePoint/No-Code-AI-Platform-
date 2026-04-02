import {
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const { result } = useTaskStatus(taskId);

  if (result?.status === "success" || result?.status === "failure") {
    onDone();
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await datasetsApi.upload(file);
      setTaskId(data.task_id);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <Button
        variant="contained"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || !!taskId}
      >
        {uploading ? "Uploading…" : "Upload CSV / Excel"}
      </Button>

      {taskId && result && result.status !== "success" && result.status !== "failure" && (
        <Box sx={{ mt: 1, maxWidth: 300 }}>
          <Typography variant="caption">
            {result.status === "pending" ? "Queued…" : "Profiling…"} {result.progress_pct}%
          </Typography>
          <LinearProgress variant="determinate" value={result.progress_pct} />
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
      <Typography variant="h4" gutterBottom>
        Datasets
      </Typography>

      <UploadRow onDone={refetch} />

      <Paper>
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
                sx={{ cursor: "pointer" }}
                onClick={() => navigate(`/data/${d.dataset_id}`)}
              >
                <TableCell>{d.name}</TableCell>
                <TableCell>{d.source_type.toUpperCase()}</TableCell>
                <TableCell>{d.row_count?.toLocaleString() ?? "—"}</TableCell>
                <TableCell>
                  <Chip label={d.status} color={statusColor(d.status)} size="small" />
                </TableCell>
                <TableCell>
                  {new Date(d.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
            {datasets.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No datasets yet. Upload a file to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

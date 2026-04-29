import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Box, Chip, CircularProgress, IconButton, Tooltip, Typography, alpha } from "@mui/material";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ragApi } from "../../../api/rag";
import type { DocumentNodeData } from "../../../types/pipeline";
import { NodeBadge } from "./NodeBadge";
import { getValidationBorderColor, type NodeValidation } from "./validation";
import { DocumentPreviewDialog } from "../DocumentPreviewDialog";

interface ExtraProps {
  pipelineId?: string;
  onIngestStart?: (nodeId: string, taskId: string, documentId: string, sourceName: string) => void;
  __validation?: NodeValidation;
}

const ALLOWED_EXT = /\.(pdf|txt|md)$/i;

export function DocumentNode({ id, data, selected }: NodeProps) {
  const { t } = useTranslation();
  const d = data as DocumentNodeData & ExtraProps;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const status = d.status;

  const processFile = async (file: File) => {
    setLocalError(null);
    if (!d.pipelineId) {
      const msg = "Pipeline ID not yet attached to node — try reopening the pipeline.";
      console.warn("[DocumentNode]", msg);
      setLocalError(msg);
      return;
    }
    if (!ALLOWED_EXT.test(file.name)) {
      const msg = `Unsupported file type: ${file.name}. Use .pdf, .txt, or .md.`;
      console.warn("[DocumentNode]", msg);
      setLocalError(msg);
      return;
    }
    setUploading(true);
    try {
      const { data: resp } = await ragApi.uploadDocument(d.pipelineId, file);
      d.onIngestStart?.(id, resp.task_id, resp.document_id, file.name);
    } catch (err) {
      console.error("[DocumentNode] upload failed:", err);
      const e = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
      setLocalError(
        e.response?.data?.message || e.response?.data?.error || e.message || "Upload failed"
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handlePick = () => inputRef.current?.click();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    if (!dragOver) setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const statusIcon =
    status === "ready" ? (
      <CheckCircleRoundedIcon sx={{ fontSize: 14, color: "#10b981" }} />
    ) : status === "error" ? (
      <ErrorRoundedIcon sx={{ fontSize: 14, color: "#ef4444" }} />
    ) : status === "running" || status === "queued" || uploading ? (
      <CircularProgress size={12} sx={{ color: "#f59e0b" }} />
    ) : null;

  const validationBorder = getValidationBorderColor(d.__validation, "");
  return (
    <Box
      sx={{
        position: "relative",
        px: 2.5,
        py: 2,
        borderRadius: 3,
        border: 2,
        borderColor: validationBorder || (selected ? "#0ea5e9" : alpha("#0ea5e9", 0.25)),
        bgcolor: "#fff",
        minWidth: 200,
        boxShadow: selected
          ? `0 8px 25px -5px ${alpha("#0ea5e9", 0.3)}, 0 0 0 3px ${alpha("#0ea5e9", 0.1)}`
          : `0 2px 8px -2px ${alpha("#0f172a", 0.08)}`,
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": { borderColor: alpha("#0ea5e9", 0.55) },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "8px",
            background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <DescriptionRoundedIcon sx={{ fontSize: 16, color: "#fff" }} />
        </Box>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: "#0284c7",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            fontSize: "0.65rem",
          }}
        >
          Document
        </Typography>
      </Box>

      <Typography variant="body2" noWrap sx={{ maxWidth: 180, fontWeight: 500 }}>
        {d.source_name || "No file selected"}
      </Typography>

      <Box
        className="nodrag nopan"
        onClick={handlePick}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          mt: 1,
          py: 1,
          px: 1.5,
          borderRadius: 2,
          border: "1.5px dashed",
          borderColor: dragOver ? "#0284c7" : alpha("#0ea5e9", 0.4),
          bgcolor: dragOver ? alpha("#0ea5e9", 0.18) : alpha("#0ea5e9", 0.04),
          cursor: uploading ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          color: "#0284c7",
          fontSize: "0.72rem",
          fontWeight: 600,
          transition: "background-color 0.15s ease, border-color 0.15s ease",
          "&:hover": { bgcolor: alpha("#0ea5e9", 0.1) },
        }}
      >
        {uploading ? (
          <CircularProgress size={12} sx={{ color: "#0284c7" }} />
        ) : (
          <CloudUploadRoundedIcon sx={{ fontSize: 14 }} />
        )}
        {uploading
          ? "Uploading…"
          : dragOver
          ? "Release to upload"
          : "Drop or pick PDF / TXT / MD"}
      </Box>

      {(status || d.chunk_count) && (
        <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
          {statusIcon}
          <Chip
            size="small"
            label={
              status === "ready" && d.chunk_count
                ? `${d.chunk_count} chunks`
                : status ?? "—"
            }
            variant="outlined"
            sx={{ fontSize: "0.65rem", height: 20 }}
          />
          {status === "ready" && d.document_id && d.pipelineId && (
            <Tooltip title={t("documentPreview.open")} arrow>
              <IconButton
                size="small"
                aria-label={t("documentPreview.open")}
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewOpen(true);
                }}
                className="nodrag"
                sx={{
                  ml: "auto",
                  p: 0.25,
                  color: "#0284c7",
                  "&:hover": { bgcolor: alpha("#0ea5e9", 0.1) },
                }}
              >
                <VisibilityRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}

      {d.document_id && d.pipelineId && (
        <DocumentPreviewDialog
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          pipelineId={d.pipelineId}
          documentId={d.document_id}
          sourceName={d.source_name}
        />
      )}

      {localError && (
        <Typography
          variant="caption"
          sx={{
            mt: 0.75,
            display: "block",
            color: "#b54141",
            fontSize: "0.65rem",
            lineHeight: 1.3,
            wordBreak: "break-word",
          }}
        >
          {localError}
        </Typography>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md"
        style={{ display: "none" }}
        onChange={handleFile}
      />

      <Handle type="source" position={Position.Right} />
      <NodeBadge validation={d.__validation} />
    </Box>
  );
}

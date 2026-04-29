import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Pagination,
  Stack,
  Typography,
  alpha,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useTranslation } from "react-i18next";
import { ragApi } from "../../api/rag";

interface Props {
  open: boolean;
  onClose: () => void;
  pipelineId: string;
  documentId: string;
  sourceName?: string | null;
}

const PAGE_SIZE = 10;

interface Chunk {
  chunk_index: number;
  text: string;
  chars: number;
}

export function DocumentPreviewDialog({
  open,
  onClose,
  pipelineId,
  documentId,
  sourceName,
}: Props) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    ragApi
      .documentChunks(pipelineId, documentId, { page, page_size: PAGE_SIZE })
      .then(({ data }) => {
        if (cancelled) return;
        setChunks(data.items);
        setTotal(data.total);
      })
      .catch(() => {
        if (cancelled) return;
        setError(t("documentPreview.failed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, pipelineId, documentId, page, t]);

  // Reset to page 1 whenever the dialog opens for a new document.
  useEffect(() => {
    if (open) setPage(1);
  }, [open, documentId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          fontWeight: 700,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
            {t("documentPreview.title", { name: sourceName ?? "Document" })}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {total} chunks · {t("documentPreview.pageOf", { page, total: totalPages })}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label={t("common.close")}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : chunks.length === 0 ? (
          <Alert severity="info">{t("documentPreview.empty")}</Alert>
        ) : (
          <Stack spacing={1.5}>
            {chunks.map((c) => (
              <Box
                key={c.chunk_index}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: 1,
                  borderColor: alpha("#0ea5e9", 0.2),
                  bgcolor: alpha("#0ea5e9", 0.04),
                }}
              >
                <Stack direction="row" spacing={1} sx={{ mb: 0.75 }}>
                  <Chip
                    label={t("documentPreview.chunkLabel", { index: c.chunk_index })}
                    size="small"
                    sx={{ bgcolor: "#0ea5e9", color: "#fff", fontWeight: 700 }}
                  />
                  <Chip
                    label={t("documentPreview.charsLabel", { count: c.chars })}
                    size="small"
                    variant="outlined"
                  />
                </Stack>
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: "pre-wrap",
                    fontFamily: "Menlo, Monaco, Consolas, monospace",
                    fontSize: "0.78rem",
                    lineHeight: 1.6,
                    color: "text.secondary",
                  }}
                >
                  {c.text}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      {totalPages > 1 && (
        <DialogActions sx={{ justifyContent: "center", py: 1.5 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => setPage(p)}
            size="small"
          />
        </DialogActions>
      )}
    </Dialog>
  );
}

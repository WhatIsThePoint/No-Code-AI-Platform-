import { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/DeleteOutlineRounded";
import RefreshIcon from "@mui/icons-material/RefreshRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import { adminApi, type OllamaModel } from "../../api/admin";
import { MONO, P, formatBytes } from "./parity";

const buttonGhost = {
  px: "10px",
  py: "4px",
  minHeight: 28,
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.04em",
  textTransform: "none" as const,
  borderRadius: "2px",
  bgcolor: "transparent",
  color: P.ink,
  border: `1px solid ${P.rule}`,
  fontFamily: MONO,
  "&:hover": { borderColor: P.ink, bgcolor: "transparent", boxShadow: "none" },
};

const buttonDanger = {
  ...buttonGhost,
  color: P.bad,
  "&:hover": { borderColor: P.bad, bgcolor: P.badSoft, boxShadow: "none" },
};

interface DeleteState {
  open: boolean;
  name: string;
  busy: boolean;
  error: string | null;
}

const NO_DELETE: DeleteState = { open: false, name: "", busy: false, error: null };

export function ModelRegistryPanel() {
  const [models, setModels] = useState<OllamaModel[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [del, setDel] = useState<DeleteState>(NO_DELETE);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await adminApi.listOllamaModels();
      setModels(data.models);
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? "fetch_failed");
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const confirmDelete = async () => {
    setDel((s) => ({ ...s, busy: true, error: null }));
    try {
      await adminApi.deleteOllamaModel(del.name);
      setDel(NO_DELETE);
      await load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setDel((s) => ({
        ...s,
        busy: false,
        error: err.response?.data?.error ?? "delete_failed",
      }));
    }
  };

  return (
    <Box sx={{ border: `1px solid ${P.rule}`, bgcolor: P.paper }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: "16px",
          py: "10px",
          borderBottom: `1px solid ${P.rule}`,
          bgcolor: P.paper2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <StorageRoundedIcon sx={{ fontSize: 14, color: P.muted }} />
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: P.muted,
            }}
          >
            Ollama model registry · {models?.length ?? 0} downloaded
          </Typography>
        </Box>
        <Button
          size="small"
          startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
          onClick={load}
          disabled={loading}
          sx={buttonGhost}
        >
          Refresh
        </Button>
      </Box>

      {loading && models === null ? (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <CircularProgress size={18} sx={{ color: P.ink }} />
        </Box>
      ) : error && (!models || models.length === 0) ? (
        <Box
          sx={{
            p: 4,
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 12,
            color: P.bad,
          }}
        >
          {error === "ollama_unreachable"
            ? "Ollama service is unreachable."
            : `Could not load models: ${error}`}
        </Box>
      ) : !models || models.length === 0 ? (
        <Box
          sx={{
            p: 4,
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 12,
            color: P.muted,
          }}
        >
          No models downloaded yet. Pull one via{" "}
          <code>ollama pull llama3.2:3b</code> on the host.
        </Box>
      ) : (
        <Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns:
                "minmax(200px, 2fr) 110px 130px 130px 90px",
              bgcolor: P.paper2,
              borderBottom: `1px solid ${P.rule}`,
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: P.muted,
              "& > div": {
                p: "10px 14px",
                borderRight: `1px solid ${P.rule}`,
              },
              "& > div:last-of-type": { borderRight: 0 },
            }}
          >
            <Box>Model</Box>
            <Box>Size</Box>
            <Box>Params</Box>
            <Box>Quant</Box>
            <Box>Action</Box>
          </Box>
          {models.map((m) => (
            <Box
              key={m.name}
              sx={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(200px, 2fr) 110px 130px 130px 90px",
                borderBottom: `1px solid ${P.ruleSoft}`,
                "&:last-of-type": { borderBottom: 0 },
                "&:hover": { bgcolor: P.paper2 },
                "& > div": {
                  p: "10px 14px",
                  borderRight: `1px solid ${P.ruleSoft}`,
                  fontFamily: MONO,
                  fontSize: 11,
                  color: P.ink2,
                  display: "flex",
                  alignItems: "center",
                  overflow: "hidden",
                },
                "& > div:last-of-type": { borderRight: 0 },
              }}
            >
              <Box
                sx={{
                  color: `${P.ink} !important`,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={m.name}
              >
                {m.name}
              </Box>
              <Box>{formatBytes(m.size_bytes)}</Box>
              <Box>{m.parameter_size ?? "—"}</Box>
              <Box>{m.quantization ?? "—"}</Box>
              <Box>
                <Tooltip title="Delete model from disk" arrow>
                  <IconButton
                    size="small"
                    aria-label="Delete model from disk"
                    onClick={() =>
                      setDel({
                        open: true,
                        name: m.name,
                        busy: false,
                        error: null,
                      })
                    }
                    sx={{ borderRadius: "2px", color: P.bad }}
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <Dialog
        open={del.open}
        onClose={() => !del.busy && setDel(NO_DELETE)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: "2px",
            bgcolor: P.paper,
            border: `1px solid ${P.rule}`,
            boxShadow: "none",
          },
        }}
      >
        <DialogTitle
          sx={{
            fontSize: 14,
            fontWeight: 600,
            color: P.ink,
            borderBottom: `1px solid ${P.rule}`,
            px: 3,
            py: 2,
          }}
        >
          Delete Ollama model
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: "20px !important", pb: 2 }}>
          <Typography sx={{ fontFamily: MONO, fontSize: 12, color: P.ink2, mb: 1.5 }}>
            This will remove <strong>{del.name}</strong> from disk on the host.
            Pipelines configured to use it will fall back to the platform
            default until it is pulled again.
          </Typography>
          <Typography sx={{ fontFamily: MONO, fontSize: 11, color: P.muted }}>
            Re-pull with <code>ollama pull {del.name}</code> on the host.
          </Typography>
          {del.error && (
            <Typography
              sx={{
                mt: 2,
                p: "8px 10px",
                fontFamily: MONO,
                fontSize: 11,
                color: P.bad,
                border: `1px solid ${P.bad}`,
                bgcolor: P.badSoft,
                borderRadius: "2px",
              }}
            >
              {del.error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            borderTop: `1px solid ${P.rule}`,
            gap: 1,
          }}
        >
          <Button
            onClick={() => setDel(NO_DELETE)}
            disabled={del.busy}
            sx={buttonGhost}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            disabled={del.busy}
            sx={buttonDanger}
            startIcon={
              del.busy ? (
                <CircularProgress size={12} sx={{ color: P.bad }} />
              ) : (
                <DeleteIcon sx={{ fontSize: 14 }} />
              )
            }
          >
            {del.busy ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

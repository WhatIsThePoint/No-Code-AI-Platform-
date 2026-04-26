import { useEffect, useRef, useState } from "react";
import {
  Box,
  Chip,
  Drawer,
  Fab,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseIcon from "@mui/icons-material/CloseRounded";
import SendIcon from "@mui/icons-material/SendRounded";
import { useCompanionStore } from "../../store/companionSlice";
import { useAuthStore } from "../../store/authSlice";
import { companionApi } from "../../api/companion";

interface Turn {
  role: "user" | "assistant" | "error";
  text: string;
  ts: number;
  elapsedMs?: number;
}

const SUGGESTIONS = [
  "What does this screen do?",
  "How do I balance my classes?",
  "Which model should I pick for this dataset?",
];

/**
 * Sprint 7 Module 4 — Persistent local-AI assistant.
 *
 * 100% local: every prompt is routed through the gateway to the on-host
 * Ollama daemon. No data leaves the docker network.
 *
 * Rendered once in Layout so it floats over every screen. Reads the
 * active context from `useCompanionStore` so its answers stay grounded
 * in whatever the user is actually doing.
 */
export function PlatformCompanion() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const accessToken = useAuthStore((s) => s.accessToken);
  const context = useCompanionStore((s) => s.context);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, loading]);

  if (!accessToken) {
    // Don't show the FAB pre-login; otherwise unauthenticated clicks
    // would just bounce off the gateway with 401s.
    return null;
  }

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setQuestion("");
    setTurns((prev) => [...prev, { role: "user", text: trimmed, ts: Date.now() }]);
    setLoading(true);
    try {
      const resp = await companionApi.ask(trimmed, context);
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          text: resp.data.answer || "(empty answer)",
          ts: Date.now(),
          elapsedMs: resp.data.elapsed_ms,
        },
      ]);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error === "ollama_unavailable"
          ? "Local LLM is offline. Start Ollama and try again."
          : err?.response?.data?.error === "ollama_timeout"
          ? "Ollama took too long. Try a shorter question."
          : "Something went wrong reaching the local model.";
      setTurns((prev) => [...prev, { role: "error", text: msg, ts: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const activeChip = context.active_view || context.pipeline?.name || context.dataset?.name;

  return (
    <>
      <Tooltip title="Ask the local AI companion" placement="left">
        <Fab
          color="primary"
          onClick={() => setOpen(true)}
          sx={{
            position: "fixed",
            right: 24,
            bottom: 24,
            zIndex: (t) => t.zIndex.drawer + 2,
            background: "linear-gradient(135deg, #6366f1, #4338ca)",
            boxShadow: "0 12px 28px rgba(67,56,202,0.35)",
            "&:hover": {
              background: "linear-gradient(135deg, #4f46e5, #3730a3)",
            },
          }}
        >
          <AutoAwesomeIcon />
        </Fab>
      </Tooltip>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 420 },
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        <Box
          sx={{
            px: 2.5,
            py: 1.75,
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            borderBottom: 1,
            borderColor: "divider",
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(99,102,241,0.02))",
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: "10px",
              background: "linear-gradient(135deg, #6366f1, #4338ca)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AutoAwesomeIcon sx={{ color: "#fff", fontSize: 18 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Companion
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", display: "block" }}
            >
              Runs locally on your hardware
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {activeChip && (
          <Box sx={{ px: 2.5, py: 1, borderBottom: 1, borderColor: "divider" }}>
            <Chip
              label={`Context: ${activeChip}`}
              size="small"
              sx={{
                fontSize: "0.65rem",
                height: 22,
                bgcolor: alpha("#6366f1", 0.1),
                color: "#4338ca",
                fontWeight: 600,
              }}
            />
          </Box>
        )}

        <Box
          ref={scrollRef}
          sx={{
            flex: 1,
            overflowY: "auto",
            px: 2.5,
            py: 2,
            display: "flex",
            flexDirection: "column",
            gap: 1.25,
            bgcolor: "#fafbff",
          }}
        >
          {turns.length === 0 && !loading && (
            <Box>
              <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
                Ask anything about the platform. The model is small (3B
                parameters) — keep questions focused for the best answers.
              </Typography>
              <Stack direction="column" spacing={0.75}>
                {SUGGESTIONS.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    onClick={() => send(s)}
                    sx={{
                      justifyContent: "flex-start",
                      fontSize: "0.78rem",
                      height: 28,
                      bgcolor: "#fff",
                      border: 1,
                      borderColor: "divider",
                      "&:hover": { bgcolor: alpha("#6366f1", 0.06) },
                    }}
                  />
                ))}
              </Stack>
            </Box>
          )}

          {turns.map((t, idx) => (
            <Box
              key={idx}
              sx={{
                alignSelf: t.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "92%",
              }}
            >
              <Box
                sx={{
                  px: 1.5,
                  py: 1,
                  borderRadius: 2.5,
                  bgcolor:
                    t.role === "user"
                      ? "linear-gradient(135deg, #6366f1, #4338ca)"
                      : t.role === "error"
                      ? alpha("#ef4444", 0.08)
                      : "#fff",
                  background:
                    t.role === "user"
                      ? "linear-gradient(135deg, #6366f1, #4338ca)"
                      : undefined,
                  color: t.role === "user" ? "#fff" : "text.primary",
                  border: t.role === "assistant" ? 1 : 0,
                  borderColor: "divider",
                  whiteSpace: "pre-wrap",
                  fontSize: "0.85rem",
                  lineHeight: 1.45,
                }}
              >
                {t.text}
              </Box>
              {t.elapsedMs && (
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    display: "block",
                    mt: 0.25,
                    fontSize: "0.65rem",
                  }}
                >
                  {(t.elapsedMs / 1000).toFixed(1)}s
                </Typography>
              )}
            </Box>
          ))}

          {loading && (
            <Box
              sx={{
                alignSelf: "flex-start",
                px: 1.5,
                py: 1,
                borderRadius: 2.5,
                bgcolor: "#fff",
                border: 1,
                borderColor: "divider",
                fontSize: "0.85rem",
                color: "text.secondary",
              }}
            >
              Thinking…
            </Box>
          )}
        </Box>

        <Box
          sx={{
            p: 1.5,
            borderTop: 1,
            borderColor: "divider",
            bgcolor: "#fff",
          }}
        >
          <TextField
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(question);
              }
            }}
            placeholder="Ask the companion…"
            fullWidth
            size="small"
            disabled={loading}
            multiline
            maxRows={4}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => send(question)}
                    disabled={loading || !question.trim()}
                    sx={{
                      bgcolor: alpha("#6366f1", 0.1),
                      "&:hover": { bgcolor: alpha("#6366f1", 0.18) },
                    }}
                  >
                    <SendIcon fontSize="small" sx={{ color: "#4338ca" }} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Drawer>
    </>
  );
}

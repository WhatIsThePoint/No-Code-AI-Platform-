import { useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Popover,
  Stack,
  TextField,
  Typography,
  alpha,
} from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import { ragApi, type ChatSource } from "../../api/rag";

interface Props {
  pipelineId: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  error?: boolean;
  streaming?: boolean;
}

export function ChatInterface({ pipelineId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Hydrate prior turns once.
  useEffect(() => {
    ragApi
      .chatHistory(pipelineId)
      .then(({ data }) => {
        const hydrated: Message[] = [];
        for (const t of data.items) {
          if (t.message) hydrated.push({ role: "user", content: t.message });
          if (t.answer) hydrated.push({ role: "assistant", content: t.answer });
        }
        if (hydrated.length) setMessages(hydrated);
      })
      .catch(() => {});
  }, [pipelineId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending]);

  // Cancel any in-flight stream when the component unmounts or the pipeline switches.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, [pipelineId]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || pending) return;

    // Push the user turn AND a placeholder assistant bubble in one update
    // so the streaming bubble has a stable index we can mutate.
    setMessages((m) => [
      ...m,
      { role: "user", content: trimmed },
      { role: "assistant", content: "", streaming: true },
    ]);
    setInput("");
    setPending(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const updateLast = (patch: (msg: Message) => Message) => {
      setMessages((m) => {
        if (m.length === 0) return m;
        const next = m.slice();
        const idx = next.length - 1;
        next[idx] = patch(next[idx]);
        return next;
      });
    };

    try {
      await ragApi.chatStream(
        pipelineId,
        trimmed,
        {
          onSources: (sources) =>
            updateLast((msg) => ({ ...msg, sources })),
          onToken: (chunk) =>
            updateLast((msg) => ({ ...msg, content: msg.content + chunk })),
          onDone: (finalAnswer) =>
            updateLast((msg) => ({
              ...msg,
              content: finalAnswer || msg.content,
              streaming: false,
            })),
          onError: (error, detail) => {
            const human =
              error === "ollama_unavailable"
                ? "Local LLM service is not reachable. Make sure Ollama is running."
                : error === "ollama_timeout"
                ? "The local model timed out. Try a smaller engine or a shorter question."
                : error === "rag_misconfigured"
                ? `RAG configuration issue: ${detail ?? "unknown"}`
                : detail ?? `Streaming failed (${error}).`;
            updateLast((msg) => ({
              ...msg,
              content: human,
              error: true,
              streaming: false,
            }));
          },
        },
        controller.signal
      );
    } catch (err: unknown) {
      // Network / abort. Don't overwrite a useful message we already wrote.
      if ((err as { name?: string })?.name !== "AbortError") {
        updateLast((msg) => ({
          ...msg,
          content:
            msg.content ||
            "Failed to reach the local LLM. Make sure the gateway and Ollama are up.",
          error: !msg.content,
          streaming: false,
        }));
      }
    } finally {
      setPending(false);
      abortRef.current = null;
    }
  };

  return (
    <Box
      data-tour="rag-chat"
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 480,
        bgcolor: alpha("#f8fafc", 0.5),
        borderRadius: 4,
        overflow: "hidden",
        border: 1,
        borderColor: "divider",
      }}
    >
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          bgcolor: "#fff",
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "10px",
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SmartToyRoundedIcon sx={{ color: "#fff", fontSize: 18 }} />
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            RAG Chat
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Local LLM + your documents · streamed token-by-token
          </Typography>
        </Box>
      </Box>

      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: "auto",
          px: 3,
          py: 2.5,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {messages.length === 0 && !pending && (
          <Alert severity="info" variant="outlined" sx={{ alignSelf: "center" }}>
            Ask a question about the documents you've ingested. The model will only
            answer from your indexed context.
          </Alert>
        )}

        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
      </Box>

      <Paper
        elevation={0}
        sx={{
          px: 2,
          py: 1.5,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "#fff",
          display: "flex",
          gap: 1,
          alignItems: "flex-end",
        }}
      >
        <TextField
          fullWidth
          size="small"
          multiline
          maxRows={4}
          placeholder="Ask a question about your documents…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={pending}
        />
        <IconButton
          onClick={handleSend}
          disabled={pending || !input.trim()}
          sx={{
            bgcolor: "#f59e0b",
            color: "#fff",
            "&:hover": { bgcolor: "#d97706" },
            "&.Mui-disabled": { bgcolor: alpha("#f59e0b", 0.3), color: "#fff" },
          }}
        >
          <SendRoundedIcon />
        </IconButton>
      </Paper>
    </Box>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const sources = message.sources ?? [];
  const isWaitingForFirstToken =
    message.streaming && message.content.length === 0;

  return (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
      <Avatar
        sx={{
          width: 28,
          height: 28,
          bgcolor: isUser ? alpha("#6366f1", 0.15) : alpha("#f59e0b", 0.15),
        }}
      >
        {isUser ? (
          <PersonRoundedIcon sx={{ fontSize: 16, color: "#4f46e5" }} />
        ) : (
          <SmartToyRoundedIcon sx={{ fontSize: 16, color: "#d97706" }} />
        )}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: message.error
              ? alpha("#ef4444", 0.05)
              : isUser
              ? alpha("#6366f1", 0.06)
              : "#fff",
            border: message.error ? `1px solid ${alpha("#ef4444", 0.3)}` : 1,
            borderColor: message.error ? alpha("#ef4444", 0.3) : "divider",
          }}
        >
          {isWaitingForFirstToken ? (
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ color: "text.secondary" }}>
              <CircularProgress size={12} thickness={5} />
              <Typography variant="caption">Thinking locally…</Typography>
            </Stack>
          ) : isUser || message.error || sources.length === 0 ? (
            <Typography
              variant="body2"
              sx={{
                whiteSpace: "pre-wrap",
                color: message.error ? "#dc2626" : "inherit",
              }}
            >
              {message.content}
              {message.streaming && <BlinkingCaret />}
            </Typography>
          ) : (
            <CitationText
              text={message.content}
              sources={sources}
              streaming={!!message.streaming}
            />
          )}
        </Paper>

        {message.sources && message.sources.length > 0 && (
          <Accordion
            disableGutters
            elevation={0}
            sx={{
              mt: 1,
              border: 1,
              borderColor: alpha("#0f172a", 0.08),
              borderRadius: 2,
              "&:before": { display: "none" },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreRoundedIcon />}
              sx={{ minHeight: 36, "& .MuiAccordionSummary-content": { my: 0.5 } }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <MenuBookRoundedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {message.sources.length} source{message.sources.length === 1 ? "" : "s"} used
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Stack spacing={1.5}>
                {message.sources.map((s) => (
                  <Box
                    key={s.rank}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      bgcolor: alpha("#0ea5e9", 0.04),
                      border: 1,
                      borderColor: alpha("#0ea5e9", 0.15),
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ mb: 0.75, flexWrap: "wrap" }}
                    >
                      <Chip
                        size="small"
                        label={`[${s.rank}]`}
                        sx={{
                          height: 20,
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          bgcolor: "#0ea5e9",
                          color: "#fff",
                        }}
                      />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {s.source_name ?? "document"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        chunk #{s.chunk_index} · score {s.score.toFixed(3)}
                      </Typography>
                    </Stack>
                    <Typography
                      variant="caption"
                      sx={{ display: "block", whiteSpace: "pre-wrap", color: "text.secondary" }}
                    >
                      {s.text}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        )}
      </Box>
    </Box>
  );
}

// ── Inline citation rendering ───────────────────────────────────────────────
//
// The system prompt instructs the LLM to cite sources as [1], [2], etc.
// We split the streaming text on those tokens and replace each one with a
// click-to-open Chip that pops up the underlying source chunk. Anything that
// doesn't match a known rank (model hallucinates [99]) is rendered as plain
// text so we never silently swallow content.

const CITATION_RE = /\[(\d{1,3})\]/g;

interface CitationTextProps {
  text: string;
  sources: ChatSource[];
  streaming: boolean;
}

function CitationText({ text, sources, streaming }: CitationTextProps) {
  const byRank = new Map(sources.map((s) => [s.rank, s]));
  const parts: Array<{ kind: "text"; value: string } | { kind: "cite"; rank: number; source: ChatSource }> = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  CITATION_RE.lastIndex = 0;
  while ((match = CITATION_RE.exec(text)) !== null) {
    const rank = Number(match[1]);
    const source = byRank.get(rank);
    if (!source) continue; // unknown citation → leave as plain text in the next slice
    if (match.index > cursor) {
      parts.push({ kind: "text", value: text.slice(cursor, match.index) });
    }
    parts.push({ kind: "cite", rank, source });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    parts.push({ kind: "text", value: text.slice(cursor) });
  }

  return (
    <Typography
      variant="body2"
      component="div"
      sx={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}
    >
      {parts.map((p, i) =>
        p.kind === "text" ? (
          <span key={i}>{p.value}</span>
        ) : (
          <CitationChip key={i} rank={p.rank} source={p.source} />
        )
      )}
      {streaming && <BlinkingCaret />}
    </Typography>
  );
}

function CitationChip({ rank, source }: { rank: number; source: ChatSource }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);

  return (
    <>
      <Box
        component="span"
        onClick={(e) => setAnchor(e.currentTarget as HTMLElement)}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 22,
          height: 18,
          mx: "2px",
          px: "5px",
          borderRadius: "4px",
          bgcolor: open ? "#0ea5e9" : alpha("#0ea5e9", 0.12),
          color: open ? "#fff" : "#0369a1",
          fontSize: "0.68rem",
          fontWeight: 700,
          letterSpacing: "0.02em",
          cursor: "pointer",
          verticalAlign: "baseline",
          transition: "background-color 0.15s ease, color 0.15s ease",
          "&:hover": { bgcolor: "#0ea5e9", color: "#fff" },
        }}
      >
        {rank}
      </Box>
      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{
          sx: {
            maxWidth: 420,
            p: 1.5,
            borderRadius: 2,
            border: 1,
            borderColor: alpha("#0ea5e9", 0.25),
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
          },
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Chip
            size="small"
            label={`[${rank}]`}
            sx={{
              height: 20,
              fontSize: "0.65rem",
              fontWeight: 700,
              bgcolor: "#0ea5e9",
              color: "#fff",
            }}
          />
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {source.source_name ?? "document"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            chunk #{source.chunk_index} · score {source.score.toFixed(3)}
          </Typography>
        </Stack>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            whiteSpace: "pre-wrap",
            color: "text.secondary",
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {source.text}
        </Typography>
      </Popover>
    </>
  );
}

function BlinkingCaret() {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        width: "7px",
        height: "1em",
        ml: "2px",
        verticalAlign: "text-bottom",
        bgcolor: "#d97706",
        animation: "ragCaretBlink 1s steps(2, start) infinite",
        "@keyframes ragCaretBlink": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0 },
        },
      }}
    />
  );
}

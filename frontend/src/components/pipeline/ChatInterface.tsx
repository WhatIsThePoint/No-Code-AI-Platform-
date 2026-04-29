import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Popover,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import AddCommentRoundedIcon from "@mui/icons-material/AddCommentRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ThumbUpAltRoundedIcon from "@mui/icons-material/ThumbUpAltRounded";
import ThumbUpOffAltRoundedIcon from "@mui/icons-material/ThumbUpOffAltRounded";
import ThumbDownAltRoundedIcon from "@mui/icons-material/ThumbDownAltRounded";
import ThumbDownOffAltRoundedIcon from "@mui/icons-material/ThumbDownOffAltRounded";
import { ragApi, type ChatSource, type ChatThread, type ChatTurn } from "../../api/rag";
import { EmptyStateHero } from "../common/EmptyStateHero";

interface Props {
  pipelineId: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  error?: boolean;
  streaming?: boolean;
  /** Server-assigned id for persisted assistant turns. Streaming bubbles
   *  start without one and get re-loaded with the turn_id once persisted. */
  turnId?: string;
  /** -1 / 0 / 1 — null/undefined = no feedback yet. */
  feedback?: number | null;
}

function turnsToMessages(turns: ChatTurn[]): Message[] {
  const out: Message[] = [];
  for (const turn of turns) {
    if (turn.message) out.push({ role: "user", content: turn.message });
    if (turn.answer) {
      out.push({
        role: "assistant",
        content: turn.answer,
        turnId: turn.turn_id ?? undefined,
        feedback: turn.feedback ?? null,
      });
    }
  }
  return out;
}


export function ChatInterface({ pipelineId }: Props) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  // A "draft" thread is one the user just created via the New Chat button —
  // it lives only in client state until the first message is sent and the
  // backend confirms it. We render it in the sidebar so the click feels
  // immediate even though no row exists yet.
  const [draftThreadId, setDraftThreadId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refreshThreads = useCallback(async (): Promise<ChatThread[]> => {
    try {
      const { data } = await ragApi.listThreads(pipelineId);
      setThreads(data.items);
      return data.items;
    } catch {
      setThreads([]);
      return [];
    }
  }, [pipelineId]);

  const loadThread = useCallback(
    async (threadId: string | null) => {
      if (!threadId) {
        setMessages([]);
        return;
      }
      try {
        const { data } = await ragApi.getThread(pipelineId, threadId);
        setMessages(turnsToMessages(data.items));
      } catch {
        setMessages([]);
      }
    },
    [pipelineId],
  );

  // Initial hydration: load thread list, pick the most recent as active.
  // If none exist yet (fresh pipeline), leave activeThreadId null and show
  // the empty state — the first message minted by the backend will populate.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await refreshThreads();
      if (cancelled) return;
      const first = list[0];
      if (first) {
        setActiveThreadId(first.thread_id);
        await loadThread(first.thread_id);
      } else {
        setActiveThreadId(null);
        setMessages([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pipelineId, refreshThreads, loadThread]);

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

  const handleSelectThread = async (threadId: string) => {
    if (threadId === activeThreadId || pending) return;
    abortRef.current?.abort();
    setActiveThreadId(threadId);
    // If the user clicks on the draft thread, leave the empty canvas as-is.
    if (threadId === draftThreadId) {
      setMessages([]);
      return;
    }
    await loadThread(threadId);
  };

  const handleNewThread = async () => {
    if (pending) return;
    abortRef.current?.abort();
    try {
      const { data } = await ragApi.createThread(pipelineId);
      setDraftThreadId(data.thread_id);
      setActiveThreadId(data.thread_id);
      setThreads((prev) => [data, ...prev.filter((t) => t.thread_id !== data.thread_id)]);
      setMessages([]);
    } catch {
      // Fall back to a client-only ephemeral thread — the backend will mint
      // its own id on the first send anyway.
      setActiveThreadId(null);
      setMessages([]);
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    if (pending) return;
    if (!confirm("Delete this conversation thread? This cannot be undone.")) return;
    try {
      await ragApi.deleteThread(pipelineId, threadId);
    } catch {
      /* ignore — refresh anyway, server may have already 404'd a draft */
    }
    if (draftThreadId === threadId) setDraftThreadId(null);
    const list = await refreshThreads();
    if (activeThreadId === threadId) {
      const next = list[0]?.thread_id ?? null;
      setActiveThreadId(next);
      await loadThread(next);
    }
  };

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

    let confirmedThreadId: string | null = activeThreadId;

    try {
      await ragApi.chatStream(
        pipelineId,
        trimmed,
        {
          onThread: (threadId) => {
            confirmedThreadId = threadId;
            // Pin the active id to whatever the backend assigned. If we sent
            // up a draft id the backend echoes it back; if we sent nothing,
            // we now know the new thread id.
            setActiveThreadId(threadId);
          },
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
        controller.signal,
        activeThreadId ?? undefined,
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
      // Once a turn lands the draft is no longer purely client-side.
      if (confirmedThreadId && draftThreadId === confirmedThreadId) {
        setDraftThreadId(null);
      }
      // Refresh the sidebar so titles + last-activity stamps reflect the
      // turn we just persisted. Best-effort — failures are tolerable.
      void refreshThreads();
      // Re-hydrate the active thread so the just-persisted assistant bubble
      // picks up its server turn_id and feedback can attach to it.
      if (confirmedThreadId) void loadThread(confirmedThreadId);
    }
  };

  return (
    <Box
      data-tour="rag-chat"
      sx={{
        display: "flex",
        flexDirection: "row",
        height: "100%",
        minHeight: 480,
        bgcolor: alpha("#f8fafc", 0.5),
        borderRadius: 4,
        overflow: "hidden",
        border: 1,
        borderColor: "divider",
      }}
    >
      <ThreadSidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
        threads={threads}
        activeThreadId={activeThreadId}
        draftThreadId={draftThreadId}
        onNew={handleNewThread}
        onSelect={handleSelectThread}
        onDelete={handleDeleteThread}
        disabled={pending}
      />
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
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
            {t("chat.title")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("chat.subtitle")}
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
          <Box sx={{ alignSelf: "center", maxWidth: 540, width: "100%" }}>
            <EmptyStateHero
              icon={SmartToyRoundedIcon}
              title={t("emptyStates.chat.title")}
              description={t("emptyStates.chat.description")}
              accent="#f59e0b"
              dense
            />
          </Box>
        )}

        {messages.map((m, i) => (
          <MessageBubble
            key={i}
            message={m}
            pipelineId={pipelineId}
            onFeedback={(value) =>
              setMessages((prev) =>
                prev.map((msg, idx) => (idx === i ? { ...msg, feedback: value } : msg)),
              )
            }
          />
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
          placeholder={t("chat.placeholder")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={pending}
          inputProps={{ "aria-label": t("chat.placeholder") }}
        />
        <IconButton
          onClick={handleSend}
          disabled={pending || !input.trim()}
          aria-label={t("chat.sendAria")}
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
    </Box>
  );
}

interface ThreadSidebarProps {
  open: boolean;
  onToggle: () => void;
  threads: ChatThread[];
  activeThreadId: string | null;
  draftThreadId: string | null;
  onNew: () => void;
  onSelect: (threadId: string) => void;
  onDelete: (threadId: string) => void;
  disabled: boolean;
}

function formatThreadTimestamp(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function ThreadSidebar({
  open,
  onToggle,
  threads,
  activeThreadId,
  draftThreadId,
  onNew,
  onSelect,
  onDelete,
  disabled,
}: ThreadSidebarProps) {
  const { t } = useTranslation();
  const collapsedWidth = 36;
  const expandedWidth = 240;
  return (
    <Box
      sx={{
        width: open ? expandedWidth : collapsedWidth,
        flexShrink: 0,
        borderRight: 1,
        borderColor: "divider",
        bgcolor: "#fff",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.18s ease",
        overflow: "hidden",
      }}
    >
      {open ? (
        <>
          <Box
            sx={{
              px: 1.5,
              py: 1,
              borderBottom: 1,
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            <HistoryRoundedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}
            >
              {t("chat.threads.title")}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Tooltip title={t("chat.threads.collapseAria")} arrow>
              <IconButton
                size="small"
                onClick={onToggle}
                aria-label={t("chat.threads.collapseAria")}
                sx={{ p: 0.25 }}
              >
                <ChevronLeftRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>

          <Box sx={{ px: 1, py: 1 }}>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              disabled={disabled}
              onClick={onNew}
              startIcon={<AddCommentRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{
                justifyContent: "flex-start",
                fontWeight: 600,
                borderColor: alpha("#f59e0b", 0.4),
                color: "#b45309",
                "&:hover": { borderColor: "#d97706", bgcolor: alpha("#f59e0b", 0.08) },
              }}
            >
              {t("chat.threads.newButton")}
            </Button>
          </Box>

          <Box sx={{ flex: 1, overflowY: "auto", px: 1, pb: 1 }}>
            {threads.length === 0 ? (
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", display: "block", px: 1, py: 1 }}
              >
                {t("chat.threads.empty")}
              </Typography>
            ) : (
              <Stack spacing={0.5}>
                {threads.map((thread) => {
                  const isActive = thread.thread_id === activeThreadId;
                  const isDraft = thread.thread_id === draftThreadId;
                  return (
                    <Box
                      key={thread.thread_id}
                      onClick={() => onSelect(thread.thread_id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelect(thread.thread_id);
                        }
                      }}
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 0.5,
                        p: 1,
                        borderRadius: 1.5,
                        cursor: "pointer",
                        bgcolor: isActive ? alpha("#f59e0b", 0.12) : "transparent",
                        border: 1,
                        borderColor: isActive ? alpha("#f59e0b", 0.4) : "transparent",
                        "&:hover": {
                          bgcolor: isActive
                            ? alpha("#f59e0b", 0.16)
                            : alpha("#0f172a", 0.04),
                        },
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ fontWeight: 600, fontSize: "0.78rem" }}
                          title={thread.title}
                        >
                          {isDraft && thread.turn_count === 0
                            ? t("chat.threads.draftLabel")
                            : thread.title}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary", fontSize: "0.65rem" }}
                        >
                          {formatThreadTimestamp(thread.last_message_at)}
                          {thread.turn_count
                            ? ` · ${t("chat.threads.turnCount", {
                                count: thread.turn_count,
                              })}`
                            : ""}
                        </Typography>
                      </Box>
                      <Tooltip title={t("chat.threads.deleteAria")} arrow>
                        <IconButton
                          size="small"
                          aria-label={t("chat.threads.deleteAria")}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(thread.thread_id);
                          }}
                          sx={{ p: 0.25, color: "text.secondary" }}
                        >
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        </>
      ) : (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
          <Tooltip title={t("chat.threads.expandAria")} arrow placement="right">
            <IconButton
              size="small"
              onClick={onToggle}
              aria-label={t("chat.threads.expandAria")}
            >
              <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}

interface MessageBubbleProps {
  message: Message;
  pipelineId: string;
  onFeedback: (value: number | null) => void;
}

function MessageBubble({ message, pipelineId, onFeedback }: MessageBubbleProps) {
  const { t } = useTranslation();
  const isUser = message.role === "user";
  const sources = message.sources ?? [];
  const isWaitingForFirstToken =
    message.streaming && message.content.length === 0;
  const showFeedback =
    !isUser && !message.error && !message.streaming && !!message.turnId;
  const currentFeedback = message.feedback ?? 0;

  const sendFeedback = async (value: -1 | 1) => {
    if (!message.turnId) return;
    // Click again to clear; otherwise toggle to the new value.
    const next: -1 | 0 | 1 = currentFeedback === value ? 0 : value;
    // Optimistic update so the click feels instant.
    onFeedback(next === 0 ? null : next);
    try {
      await ragApi.rateTurn(pipelineId, message.turnId, next);
    } catch {
      // Roll back on failure.
      onFeedback(message.feedback ?? null);
    }
  };

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
              <Typography variant="caption">{t("chat.thinking")}</Typography>
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

        {showFeedback && (
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, ml: 0.5 }}>
            <Tooltip title={t("feedback.helpful")} arrow>
              <IconButton
                size="small"
                onClick={() => sendFeedback(1)}
                aria-label={t("feedback.helpful")}
                aria-pressed={currentFeedback === 1}
                sx={{
                  p: 0.5,
                  color: currentFeedback === 1 ? "#10b981" : "text.disabled",
                  "&:hover": { color: "#10b981", bgcolor: alpha("#10b981", 0.08) },
                }}
              >
                {currentFeedback === 1 ? (
                  <ThumbUpAltRoundedIcon sx={{ fontSize: 14 }} />
                ) : (
                  <ThumbUpOffAltRoundedIcon sx={{ fontSize: 14 }} />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title={t("feedback.notHelpful")} arrow>
              <IconButton
                size="small"
                onClick={() => sendFeedback(-1)}
                aria-label={t("feedback.notHelpful")}
                aria-pressed={currentFeedback === -1}
                sx={{
                  p: 0.5,
                  color: currentFeedback === -1 ? "#ef4444" : "text.disabled",
                  "&:hover": { color: "#ef4444", bgcolor: alpha("#ef4444", 0.08) },
                }}
              >
                {currentFeedback === -1 ? (
                  <ThumbDownAltRoundedIcon sx={{ fontSize: 14 }} />
                ) : (
                  <ThumbDownOffAltRoundedIcon sx={{ fontSize: 14 }} />
                )}
              </IconButton>
            </Tooltip>
          </Stack>
        )}

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
                  {t("chat.sources", { count: message.sources.length })}
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
                        {s.source_name ?? t("chat.documentFallback")}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t("chat.chunkScore", { index: s.chunk_index, score: s.score.toFixed(3) })}
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
  const { t } = useTranslation();
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
            {source.source_name ?? t("chat.documentFallback")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("chat.chunkScore", { index: source.chunk_index, score: source.score.toFixed(3) })}
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

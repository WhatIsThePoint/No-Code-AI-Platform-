import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Drawer,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/CloseRounded";
import SendIcon from "@mui/icons-material/SendRounded";
import ChatBubbleIcon from "@mui/icons-material/ChatBubbleOutlineRounded";

import { getSocket } from "../../api/socket";
import { collabApi, type ChatMessage } from "../../api/collab";
import { useAuthStore } from "../../store/authSlice";

interface Props {
  pipelineId: string;
  open: boolean;
  onClose: () => void;
}

function avatarColor(userId: string): string {
  const palette = ["#6366f1", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#0ea5e9"];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

function initialsOf(name: string | null, fallback: string): string {
  const src = (name || fallback || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] || "?").slice(0, 2).toUpperCase();
}

export function ChatDrawer({ pipelineId, open, onClose }: Props) {
  const me = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [socketError, setSocketError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Load history + wire socket events whenever the drawer is open for a pipeline.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    // 1) Fetch last 50 messages via HTTP
    collabApi
      .listMessages(pipelineId, 50)
      .then(({ data }) => {
        if (!cancelled) setMessages(data.items);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });

    // 2) Wire live socket
    const socket = getSocket();

    const onMessage = (msg: ChatMessage) => {
      if (msg.pipeline_id !== pipelineId) return;
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
    };
    const onError = (payload: { error: string }) => {
      setSocketError(payload?.error ?? "socket_error");
    };
    const joinRoom = () => {
      setSocketError(null);
      socket.emit("join_pipeline", { pipeline_id: pipelineId });
    };
    const onDisconnect = (reason: string) => {
      // Ignore the local cleanup path — only surface real drops.
      if (reason === "io client disconnect") return;
      setSocketError("connection_lost");
    };

    socket.on("message", onMessage);
    socket.on("error", onError);
    // Server emits `connected` after auth; socket.io also emits the
    // lower-level `connect` on every (re)connect. Either one triggers a
    // fresh join so we don't miss the room on reconnects.
    socket.on("connected", joinRoom);
    socket.on("connect", joinRoom);
    socket.on("disconnect", onDisconnect);
    if (socket.connected) joinRoom();

    return () => {
      cancelled = true;
      if (socket.connected) socket.emit("leave_pipeline", { pipeline_id: pipelineId });
      socket.off("message", onMessage);
      socket.off("error", onError);
      socket.off("connected", joinRoom);
      socket.off("connect", joinRoom);
      socket.off("disconnect", onDisconnect);
    };
  }, [pipelineId, open]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, open]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const socket = getSocket();
    socket.emit("send_message", { pipeline_id: pipelineId, message: text });
    setDraft("");
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 380,
          bgcolor: "background.paper",
          borderLeft: 1,
          borderColor: "divider",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          background: `linear-gradient(135deg, ${alpha("#6366f1", 0.06)}, ${alpha("#8b5cf6", 0.06)})`,
        }}
      >
        <ChatBubbleIcon sx={{ fontSize: 18, color: "#6366f1", mr: 1 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
          Team Chat
        </Typography>
        <Tooltip title="Close">
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {socketError && (
        <Alert severity={socketError === "connection_lost" ? "info" : "warning"} sx={{ m: 1, fontSize: 12 }}>
          {socketError === "company_tier_required"
            ? "Chat is available on the Collaborator plan."
            : socketError === "no_company_membership"
            ? "Join a Collaborator workspace to chat."
            : socketError === "pipeline_access_denied"
            ? "You don't have access to this pipeline."
            : socketError === "connection_lost"
            ? "Reconnecting to chat…"
            : `Chat error: ${socketError}`}
        </Alert>
      )}

      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: "auto",
          px: 2,
          py: 1.5,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        {messages.length === 0 && (
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", textAlign: "center", mt: 4 }}
          >
            No messages yet. Say hello to your team.
          </Typography>
        )}
        {messages.map((m) => {
          const mine = me?.id === m.user_id;
          const color = avatarColor(m.user_id);
          return (
            <Stack
              key={m.id}
              direction="row"
              spacing={1}
              sx={{
                alignSelf: mine ? "flex-end" : "flex-start",
                maxWidth: "85%",
                flexDirection: mine ? "row-reverse" : "row",
              }}
            >
              <Avatar
                sx={{
                  width: 28,
                  height: 28,
                  fontSize: 11,
                  bgcolor: color,
                  mt: 0.5,
                }}
              >
                {initialsOf(m.full_name, m.user_id)}
              </Avatar>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    fontWeight: 600,
                    display: "block",
                    textAlign: mine ? "right" : "left",
                  }}
                >
                  {mine ? "You" : m.full_name ?? "Teammate"} ·{" "}
                  {new Date(m.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Typography>
                <Box
                  sx={{
                    mt: 0.25,
                    px: 1.25,
                    py: 0.75,
                    borderRadius: 2,
                    bgcolor: mine ? alpha("#6366f1", 0.12) : alpha("#0f172a", 0.04),
                    color: "text.primary",
                    fontSize: 13,
                    lineHeight: 1.4,
                    wordBreak: "break-word",
                  }}
                >
                  {m.message}
                </Box>
              </Box>
            </Stack>
          );
        })}
      </Box>

      <Box
        sx={{
          p: 1.25,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: alpha("#f8fafc", 0.6),
        }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Message the team…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  disabled={!draft.trim()}
                  onClick={send}
                  sx={{ color: "#6366f1" }}
                >
                  <SendIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Box>
    </Drawer>
  );
}

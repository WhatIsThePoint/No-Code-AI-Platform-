import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import VideoCallIcon from "@mui/icons-material/VideoCallRounded";
import LinkIcon from "@mui/icons-material/OpenInNewRounded";
import DuoIcon from "@mui/icons-material/DuoRounded";

import {
  collabApi,
  type ExternalMeetingProvider,
  type Meeting,
} from "../../api/collab";
import { getSocket } from "../../api/socket";
import { useNotifications } from "../../store/notificationsSlice";

interface Props {
  pipelineId: string;
  disabled?: boolean;
}

interface MeetingNotice {
  open: boolean;
  link: string;
  createdBy?: string;
}

const PROVIDER_OPTIONS: { value: ExternalMeetingProvider; label: string }[] = [
  { value: "zoom", label: "Zoom" },
  { value: "teams", label: "Microsoft Teams" },
  { value: "jitsi", label: "Jitsi Meet" },
  { value: "whereby", label: "Whereby" },
  { value: "other", label: "Other" },
];

export function MeetingButton({ pipelineId, disabled = false }: Props) {
  const [linkStatus, setLinkStatus] = useState<{
    configured: boolean;
    linked: boolean;
  } | null>(null);
  const [notice, setNotice] = useState<MeetingNotice>({ open: false, link: "" });
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasteProvider, setPasteProvider] =
    useState<ExternalMeetingProvider>("zoom");
  const [pasteSubmitting, setPasteSubmitting] = useState(false);
  const [googleStarting, setGoogleStarting] = useState(false);

  useEffect(() => {
    collabApi
      .googleLinkStatus()
      .then(({ data }) => setLinkStatus(data))
      .catch(() => setLinkStatus({ configured: false, linked: false }));
  }, []);

  // Listen for meeting_created broadcast from any pipeline teammate.
  // The default SocketIO namespace only connects for company-tier users,
  // so the listener is a no-op otherwise — but we still skip attaching it
  // to avoid opening a socket the server is guaranteed to reject.
  useEffect(() => {
    const socket = getSocket();
    const onCreated = (m: Meeting) => {
      if (m.pipeline_id !== pipelineId || !m.hangout_link) return;
      setNotice({
        open: true,
        link: m.hangout_link,
        createdBy: m.created_by_name,
      });
      useNotifications.getState().push({
        kind: "meeting_started",
        title: m.created_by_name
          ? `${m.created_by_name} started a meeting`
          : "A teammate started a meeting",
        body: m.hangout_link,
        href: `/pipelines/${pipelineId}`,
        ref_id: pipelineId,
      });
    };
    socket.on("meeting_created", onCreated);
    return () => {
      socket.off("meeting_created", onCreated);
    };
  }, [pipelineId]);

  const handleStartGoogleMeet = async () => {
    setError(null);

    if (!linkStatus?.configured) {
      setError(
        "Google Meet is not configured on this deployment. Paste a Zoom, Teams, Jitsi, or Whereby link instead."
      );
      return;
    }

    if (!linkStatus.linked) {
      try {
        const { data } = await collabApi.googleLinkUrl();
        window.open(data.authorization_url, "_blank", "noopener,noreferrer");
        setError(
          "Authorize Google Calendar in the new tab, then click Start Google Meet again."
        );
      } catch {
        setError("Failed to start Google link flow.");
      }
      return;
    }

    setGoogleStarting(true);
    try {
      const { data } = await collabApi.createMeeting(pipelineId);
      if (data.hangout_link) {
        window.open(data.hangout_link, "_blank", "noopener,noreferrer");
      }
      setDialogOpen(false);
    } catch (e) {
      const err = e as {
        response?: { status?: number; data?: { error?: string } };
      };
      const code = err.response?.data?.error;
      if (code === "google_not_linked") {
        setError("Reconnect your Google account to create meetings.");
      } else if (code === "google_not_configured") {
        setError("Google Meet is not configured on this deployment.");
      } else {
        setError("Failed to create meeting.");
      }
    } finally {
      setGoogleStarting(false);
    }
  };

  const handlePasteSubmit = async () => {
    const trimmed = pasteUrl.trim();
    if (!trimmed) {
      setError("Paste a meeting URL first.");
      return;
    }
    setPasteSubmitting(true);
    setError(null);
    try {
      const { data } = await collabApi.createExternalMeeting(pipelineId, {
        url: trimmed,
        provider: pasteProvider,
      });
      if (data.hangout_link) {
        window.open(data.hangout_link, "_blank", "noopener,noreferrer");
      }
      setPasteUrl("");
      setDialogOpen(false);
    } catch (e) {
      const err = e as {
        response?: { status?: number; data?: { error?: string; message?: string } };
      };
      const code = err.response?.data?.error;
      if (code === "invalid_url") {
        setError(
          err.response?.data?.message ||
            "URL must be https and from Zoom, Teams, Jitsi, or Whereby."
        );
      } else if (code === "upgrade_required" || code === "forbidden") {
        setError("Meetings require the Collaborator plan.");
      } else {
        setError("Failed to share meeting link.");
      }
    } finally {
      setPasteSubmitting(false);
    }
  };

  const googleHint = !linkStatus?.configured
    ? "Google Meet is not configured on this deployment."
    : !linkStatus.linked
    ? "Connect your Google account to create a Meet link."
    : "Spin up a Google Meet and notify your teammates.";

  return (
    <>
      <Tooltip title="Share a meeting link with your teammates">
        <span>
          <Button
            variant="outlined"
            size="small"
            disabled={disabled}
            onClick={() => {
              setError(null);
              setDialogOpen(true);
            }}
            startIcon={<VideoCallIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderColor: alpha("#10b981", 0.3),
              color: "#059669",
              "&:hover": {
                borderColor: "#10b981",
                bgcolor: alpha("#10b981", 0.05),
              },
            }}
          >
            Share Meeting
          </Button>
        </span>
      </Tooltip>

      <Dialog
        open={dialogOpen}
        onClose={() =>
          pasteSubmitting || googleStarting ? null : setDialogOpen(false)
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Share a meeting link</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Spin up a Google Meet, or paste a link from Zoom, Microsoft Teams,
            Jitsi, or Whereby — everyone in the pipeline will be notified.
          </Typography>

          <Box
            sx={{
              p: 2,
              mb: 2,
              borderRadius: 1,
              border: 1,
              borderColor: alpha("#10b981", 0.25),
              bgcolor: alpha("#10b981", 0.04),
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 700, mb: 0.5, display: "flex", alignItems: "center", gap: 0.75 }}
            >
              <DuoIcon sx={{ fontSize: 18, color: "#059669" }} />
              Start a Google Meet
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.25 }}>
              {googleHint}
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={handleStartGoogleMeet}
              disabled={googleStarting || pasteSubmitting}
              startIcon={
                googleStarting ? (
                  <CircularProgress size={14} sx={{ color: "#fff" }} />
                ) : (
                  <VideoCallIcon sx={{ fontSize: 16 }} />
                )
              }
              sx={{
                bgcolor: "#10b981",
                "&:hover": { bgcolor: "#059669" },
              }}
            >
              {googleStarting
                ? "Starting…"
                : !linkStatus?.configured
                ? "Unavailable"
                : !linkStatus.linked
                ? "Connect Google"
                : "Start Google Meet"}
            </Button>
          </Box>

          <Divider sx={{ my: 2 }}>
            <Typography variant="caption" color="text.secondary">
              OR PASTE A LINK
            </Typography>
          </Divider>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              select
              label="Provider"
              value={pasteProvider}
              onChange={(e) =>
                setPasteProvider(e.target.value as ExternalMeetingProvider)
              }
              size="small"
              fullWidth
            >
              {PROVIDER_OPTIONS.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Meeting URL"
              placeholder="https://zoom.us/j/…"
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              size="small"
              fullWidth
              helperText="Must be an https link from an allowed provider."
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setDialogOpen(false)}
            disabled={pasteSubmitting || googleStarting}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handlePasteSubmit}
            disabled={pasteSubmitting || googleStarting || !pasteUrl.trim()}
            startIcon={
              pasteSubmitting ? (
                <CircularProgress size={14} sx={{ color: "#fff" }} />
              ) : (
                <LinkIcon sx={{ fontSize: 16 }} />
              )
            }
            sx={{
              bgcolor: "#10b981",
              "&:hover": { bgcolor: "#059669" },
            }}
          >
            {pasteSubmitting ? "Sharing…" : "Share pasted link"}
          </Button>
        </DialogActions>
      </Dialog>

      {error && (
        <Snackbar
          open={!!error}
          autoHideDuration={5000}
          onClose={() => setError(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert severity="warning" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Snackbar>
      )}

      <Snackbar
        open={notice.open}
        autoHideDuration={12000}
        onClose={() => setNotice({ open: false, link: "" })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="info"
          onClose={() => setNotice({ open: false, link: "" })}
          action={
            <Button
              size="small"
              color="inherit"
              href={notice.link}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<LinkIcon sx={{ fontSize: 14 }} />}
            >
              Join Video Call
            </Button>
          }
        >
          {notice.createdBy
            ? `${notice.createdBy} started a meeting`
            : "A meeting just started"}
        </Alert>
      </Snackbar>
    </>
  );
}

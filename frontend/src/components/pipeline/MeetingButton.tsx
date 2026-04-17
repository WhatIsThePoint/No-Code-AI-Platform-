import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Snackbar,
  Tooltip,
  alpha,
} from "@mui/material";
import VideoCallIcon from "@mui/icons-material/VideoCallRounded";
import LinkIcon from "@mui/icons-material/OpenInNewRounded";

import { collabApi, type Meeting } from "../../api/collab";
import { getSocket } from "../../api/socket";

interface Props {
  pipelineId: string;
  disabled?: boolean;
}

interface MeetingNotice {
  open: boolean;
  link: string;
  createdBy?: string;
}

export function MeetingButton({ pipelineId, disabled = false }: Props) {
  const [linkStatus, setLinkStatus] = useState<{
    configured: boolean;
    linked: boolean;
  } | null>(null);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<MeetingNotice>({ open: false, link: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    collabApi
      .googleLinkStatus()
      .then(({ data }) => setLinkStatus(data))
      .catch(() => setLinkStatus({ configured: false, linked: false }));
  }, []);

  // Listen for meeting_created broadcast from any pipeline teammate.
  useEffect(() => {
    const socket = getSocket();
    const onCreated = (m: Meeting) => {
      if (m.pipeline_id !== pipelineId || !m.hangout_link) return;
      setNotice({
        open: true,
        link: m.hangout_link,
        createdBy: m.created_by_name,
      });
    };
    socket.on("meeting_created", onCreated);
    return () => {
      socket.off("meeting_created", onCreated);
    };
  }, [pipelineId]);

  const handleClick = async () => {
    setError(null);

    if (!linkStatus?.configured) {
      setError("Google Meet is not configured on this deployment.");
      return;
    }

    if (!linkStatus.linked) {
      // Kick off OAuth consent flow in a new tab.
      try {
        const { data } = await collabApi.googleLinkUrl();
        window.open(data.authorization_url, "_blank", "noopener,noreferrer");
        setError(
          "Authorize Google Calendar in the new tab, then click Start Meet again."
        );
      } catch {
        setError("Failed to start Google link flow.");
      }
      return;
    }

    setStarting(true);
    try {
      const { data } = await collabApi.createMeeting(pipelineId);
      // Open immediately for the creator; teammates get the Snackbar.
      if (data.hangout_link) {
        window.open(data.hangout_link, "_blank", "noopener,noreferrer");
      }
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
      setStarting(false);
    }
  };

  const tooltip = !linkStatus?.configured
    ? "Google Meet requires Google OAuth env vars on the server"
    : !linkStatus.linked
    ? "Connect your Google account to create a Meet link"
    : "Spin up a Google Meet for this pipeline";

  return (
    <>
      <Tooltip title={tooltip}>
        <span>
          <Button
            size="small"
            variant="outlined"
            disabled={disabled || starting}
            onClick={handleClick}
            startIcon={
              starting ? (
                <CircularProgress size={14} sx={{ color: "#10b981" }} />
              ) : (
                <VideoCallIcon sx={{ fontSize: 16 }} />
              )
            }
            sx={{
              borderColor: alpha("#10b981", 0.3),
              color: "#059669",
              "&:hover": {
                borderColor: "#10b981",
                bgcolor: alpha("#10b981", 0.05),
              },
            }}
          >
            {starting ? "Starting…" : "Start Meet"}
          </Button>
        </span>
      </Tooltip>

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

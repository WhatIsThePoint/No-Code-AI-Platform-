import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from "@mui/material";

interface Props {
  open: boolean;
  title: string;
  /** Body shown above the optional confirmation field. */
  description: string;
  /** When set, the user must type this string verbatim before Confirm enables. */
  confirmText?: string;
  /** Label for the destructive action button. */
  confirmLabel?: string;
  /** Severity colour applied to the action button. */
  severity?: "warning" | "error";
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

/**
 * Modal confirmation prompt used in place of the native `confirm()`. When
 * `confirmText` is provided the user must retype it exactly, which prevents
 * the live-demo "I clicked the wrong row" class of mistakes.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  confirmLabel = "Confirm",
  severity = "error",
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState("");

  // Reset the field every time the dialog re-opens so a stale value from a
  // previous prompt doesn't auto-arm the destructive button.
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const armed = !confirmText || typed.trim() === confirmText;

  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent dividers>
        <DialogContentText sx={{ mb: confirmText ? 2 : 0 }}>
          {description}
        </DialogContentText>
        {confirmText && (
          <>
            <Alert severity={severity} variant="outlined" sx={{ mb: 2 }}>
              Type <strong>{confirmText}</strong> below to confirm.
            </Alert>
            <TextField
              autoFocus
              fullWidth
              size="small"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmText}
              disabled={busy}
            />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color={severity}
          onClick={() => onConfirm()}
          disabled={!armed || busy}
          startIcon={busy ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : undefined}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

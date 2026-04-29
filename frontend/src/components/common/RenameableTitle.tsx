import { useEffect, useRef, useState } from "react";
import { Box, IconButton, TextField, Tooltip, Typography } from "@mui/material";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { useTranslation } from "react-i18next";

interface Props {
  value: string;
  onSave: (next: string) => Promise<void> | void;
  variant?: "subtitle1" | "h6";
  disabled?: boolean;
  /** When true, the pencil icon shows on hover only (cleaner for cards). */
  hoverOnly?: boolean;
}

/** Inline-editable title. Double-click or pencil to enter edit mode; Enter saves, Esc cancels. */
export function RenameableTitle({
  value,
  onSave,
  variant = "subtitle1",
  disabled = false,
  hoverOnly = true,
}: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing]);

  const commit = async () => {
    const next = draft.trim();
    if (!next || next === value || busy) {
      setEditing(false);
      setDraft(value);
      return;
    }
    setBusy(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch {
      // Caller surfaces the error in a snackbar; we just bail out of edit
      // mode so the user can retry without re-typing.
      setEditing(false);
      setDraft(value);
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <TextField
        size="small"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        inputRef={inputRef}
        disabled={busy}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
            setDraft(value);
          }
        }}
        sx={{ flex: 1, mr: 1, "& .MuiInputBase-input": { fontWeight: 600 } }}
      />
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        mr: 1,
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        minWidth: 0,
        "&:hover .rename-pencil": { opacity: 1 },
      }}
    >
      <Typography
        variant={variant}
        noWrap
        title={value}
        onDoubleClick={() => !disabled && setEditing(true)}
        sx={{ flex: 1, minWidth: 0, cursor: disabled ? "default" : "text" }}
      >
        {value}
      </Typography>
      {!disabled && (
        <Tooltip title={t("rename.open")} arrow>
          <IconButton
            size="small"
            onClick={() => setEditing(true)}
            aria-label={t("rename.open")}
            className="rename-pencil"
            sx={{
              p: 0.25,
              opacity: hoverOnly ? 0 : 1,
              transition: "opacity 0.15s ease",
              color: "text.secondary",
            }}
          >
            <EditRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

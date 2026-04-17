import { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import StickyNote2Icon from "@mui/icons-material/StickyNote2Rounded";
import { pipelinesApi } from "../../api/pipelines";
import type { StepNote } from "../../types/pipeline";
import { useAuthStore } from "../../store/authSlice";

interface Props {
  pipelineId: string;
  nodeId: string;
}

export function NotesPanel({ pipelineId, nodeId }: Props) {
  const [notes, setNotes] = useState<StepNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const userId = useAuthStore((s) => s.user?.id);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await pipelinesApi.listNotes(pipelineId, nodeId);
      setNotes(data.items);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [pipelineId, nodeId]);

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    await pipelinesApi.createNote(pipelineId, nodeId, newContent.trim());
    setNewContent("");
    load();
  };

  const handleDelete = async (noteId: string) => {
    await pipelinesApi.deleteNote(pipelineId, nodeId, noteId);
    load();
  };

  const handleEdit = async (noteId: string) => {
    if (!editContent.trim()) return;
    await pipelinesApi.updateNote(pipelineId, nodeId, noteId, editContent.trim());
    setEditingId(null);
    load();
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1.5 }}>
        <StickyNote2Icon sx={{ fontSize: 16, color: "#f59e0b" }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Step Notes</Typography>
      </Box>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}><CircularProgress size={20} /></Box>
      ) : (
        <>
          {notes.map((note) => (
            <Box key={note.note_id} sx={{ mb: 1.5 }}>
              {editingId === note.note_id ? (
                <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                  <TextField
                    size="small"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    fullWidth
                    multiline
                    maxRows={3}
                  />
                  <IconButton size="small" onClick={() => handleEdit(note.note_id)} sx={{ color: "#6366f1" }}>
                    <CheckIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => setEditingId(null)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: alpha("#f59e0b", 0.04),
                    border: 1,
                    borderColor: alpha("#f59e0b", 0.1),
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{note.content}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", mt: 0.5, display: "block" }}>
                      {new Date(note.created_at).toLocaleString()}
                    </Typography>
                  </Box>
                  {note.user_id === userId && (
                    <Box sx={{ ml: 1, display: "flex", gap: 0.25 }}>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => { setEditingId(note.note_id); setEditContent(note.content); }}>
                          <EditIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDelete(note.note_id)} sx={{ color: "#ef4444" }}>
                          <DeleteIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          ))}
          {notes.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontStyle: "italic" }}>No notes yet.</Typography>
          )}
          <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
            <TextField
              size="small"
              placeholder="Add a note..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              multiline
              maxRows={3}
              fullWidth
              onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) handleAdd(); }}
            />
            <Button size="small" variant="contained" onClick={handleAdd} disabled={!newContent.trim()}>
              Add
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}

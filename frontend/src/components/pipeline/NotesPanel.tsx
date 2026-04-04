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
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
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
      <Typography variant="subtitle2" gutterBottom>Step Notes</Typography>
      {loading ? (
        <CircularProgress size={20} />
      ) : (
        <>
          {notes.map((note) => (
            <Box key={note.note_id} sx={{ mb: 1 }}>
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
                  <IconButton size="small" onClick={() => handleEdit(note.note_id)} color="primary">
                    <CheckIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => setEditingId(null)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{note.content}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(note.created_at).toLocaleString()}
                    </Typography>
                  </Box>
                  {note.user_id === userId && (
                    <Box>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => { setEditingId(note.note_id); setEditContent(note.content); }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(note.note_id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
              )}
              <Divider sx={{ mt: 1 }} />
            </Box>
          ))}
          {notes.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>No notes yet.</Typography>
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

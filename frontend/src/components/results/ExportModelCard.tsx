import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import CloudDownloadRoundedIcon from "@mui/icons-material/CloudDownloadRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import { modelsApi } from "../../api/models";
import type { PipelineType } from "../../types/pipeline";

interface Props {
  pipelineId: string;
  pipelineType: PipelineType;
  pipelineName?: string;
}

const TABULAR_PYTHON_SNIPPET = `# After unzipping, three lines to predict:
import joblib, json, pandas as pd
model = joblib.load("model.joblib")
meta  = json.loads(open("metadata.json").read())
preds = model.predict(pd.read_csv("new_data.csv")[meta["feature_columns"]])`;

const GENAI_OLLAMA_SNIPPET = `# After unzipping (requires Ollama installed locally):
ollama pull llama3.2:3b
ollama create my-pipeline -f ./Modelfile
ollama run my-pipeline   # interactive chat with your RAG system prompt baked in`;

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ExportModelCard({ pipelineId, pipelineType, pipelineName }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snippetTab, setSnippetTab] = useState(0);

  const isRag = pipelineType === "rag";
  const safeName = (pipelineName || "model").replace(/[^a-zA-Z0-9._-]+/g, "_");
  const snippet = isRag ? GENAI_OLLAMA_SNIPPET : TABULAR_PYTHON_SNIPPET;
  const snippetLang = isRag ? "Ollama CLI" : "Python";

  const handleDownload = async () => {
    setError(null);
    setDownloading(true);
    try {
      const res = isRag
        ? await modelsApi.exportGenai(pipelineId)
        : await modelsApi.exportTabular(pipelineId);
      const blob =
        res.data instanceof Blob
          ? res.data
          : new Blob([res.data as unknown as BlobPart], { type: "application/zip" });
      const filename = isRag
        ? `${safeName}_rag_export.zip`
        : `${safeName}_model.zip`;
      triggerDownload(blob, filename);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string; message?: string } } };
      const msg =
        e.response?.data?.message ||
        e.response?.data?.error ||
        (e.response?.status === 404 ? "no_trained_model" : "download_failed");
      setError(msg);
    } finally {
      setDownloading(false);
    }
  };

  const copySnippet = () => {
    void navigator.clipboard.writeText(snippet);
  };

  return (
    <Card
      sx={{
        borderRadius: 3,
        border: 1,
        borderColor: alpha(isRag ? "#8b5cf6" : "#10b981", 0.25),
        background: `linear-gradient(135deg, ${alpha(
          isRag ? "#8b5cf6" : "#10b981",
          0.04
        )}, transparent)`,
      }}
    >
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              background: isRag
                ? "linear-gradient(135deg, #8b5cf6, #7c3aed)"
                : "linear-gradient(135deg, #10b981, #059669)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CloudDownloadRoundedIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Export &amp; run locally
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {isRag
                ? "Ollama Modelfile + RAG manifest. Reproduce this assistant on your own machine."
                : "Trained model + preprocessing + metadata, ready to load with joblib."}
            </Typography>
          </Box>
          <Chip
            label={isRag ? "GenAI" : "Tabular"}
            size="small"
            sx={{
              bgcolor: alpha(isRag ? "#8b5cf6" : "#10b981", 0.12),
              color: isRag ? "#7c3aed" : "#059669",
              fontWeight: 700,
            }}
          />
        </Box>

        <Divider sx={{ my: 1.5 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error === "no_trained_model"
              ? "No trained model yet — train this pipeline before exporting."
              : error}
          </Alert>
        )}

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <Button
            variant="contained"
            startIcon={
              downloading ? <CircularProgress size={16} color="inherit" /> : <DownloadRoundedIcon />
            }
            disabled={downloading}
            onClick={handleDownload}
            sx={{
              background: isRag
                ? "linear-gradient(135deg, #8b5cf6, #7c3aed)"
                : "linear-gradient(135deg, #10b981, #059669)",
              fontWeight: 700,
              "&:hover": {
                background: isRag
                  ? "linear-gradient(135deg, #7c3aed, #6d28d9)"
                  : "linear-gradient(135deg, #059669, #047857)",
              },
            }}
          >
            {downloading
              ? "Preparing zip…"
              : isRag
              ? "Download RAG bundle (.zip)"
              : "Download model bundle (.zip)"}
          </Button>
        </Box>

        <Tabs
          value={snippetTab}
          onChange={(_, v) => setSnippetTab(v as number)}
          sx={{ minHeight: 32, "& .MuiTab-root": { minHeight: 32, py: 0, fontSize: "0.75rem" } }}
        >
          <Tab label={`How to use (${snippetLang})`} />
        </Tabs>

        <Box
          sx={{
            position: "relative",
            mt: 1,
            p: 1.5,
            borderRadius: 2,
            bgcolor: "#0f172a",
            color: "#e2e8f0",
            fontFamily: "Menlo, Monaco, Consolas, monospace",
            fontSize: "0.78rem",
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowX: "auto",
          }}
        >
          <Tooltip title="Copy snippet">
            <Box
              component="button"
              onClick={copySnippet}
              sx={{
                position: "absolute",
                top: 6,
                right: 6,
                bg: "transparent",
                color: alpha("#e2e8f0", 0.7),
                border: "none",
                cursor: "pointer",
                p: 0.5,
                "&:hover": { color: "#fff" },
              }}
            >
              <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
            </Box>
          </Tooltip>
          {snippet}
        </Box>
      </CardContent>
    </Card>
  );
}

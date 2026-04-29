import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  alpha,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import CloudRoundedIcon from "@mui/icons-material/CloudRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { datasetsApi } from "../../api/datasets";

type ConnectorKind = "postgres" | "mysql" | "s3";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (datasetId: string, taskId: string) => void;
}

const STEPS = ["Type", "Credentials", "Test & confirm"];

interface SqlForm {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  query: string;
}

interface S3Form {
  bucket: string;
  region: string;
  access_key_id: string;
  secret_access_key: string;
  prefix: string;
}

interface ProbeResult {
  ok: boolean;
  latency_ms: number;
  samples: string[];
  error?: string;
  detail?: string;
}

export function ConnectorWizard({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<ConnectorKind | null>(null);
  const [sql, setSql] = useState<SqlForm>({
    host: "",
    port: "5432",
    database: "",
    username: "",
    password: "",
    query: "SELECT * FROM your_table LIMIT 1000",
  });
  const [s3, setS3] = useState<S3Form>({
    bucket: "",
    region: "us-east-1",
    access_key_id: "",
    secret_access_key: "",
    prefix: "",
  });
  const [testing, setTesting] = useState(false);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep(0);
    setKind(null);
    setProbe(null);
    setError(null);
    setSql({
      host: "",
      port: "5432",
      database: "",
      username: "",
      password: "",
      query: "SELECT * FROM your_table LIMIT 1000",
    });
    setS3({
      bucket: "",
      region: "us-east-1",
      access_key_id: "",
      secret_access_key: "",
      prefix: "",
    });
  };

  const handleClose = () => {
    if (testing || creating) return;
    onClose();
    setTimeout(reset, 200);
  };

  const handlePickKind = (k: ConnectorKind) => {
    setKind(k);
    setProbe(null);
    setError(null);
    if (k === "postgres") setSql((s) => ({ ...s, port: "5432" }));
    if (k === "mysql") setSql((s) => ({ ...s, port: "3306" }));
    setStep(1);
  };

  const credentialsValid = () => {
    if (!kind) return false;
    if (kind === "s3") {
      return s3.bucket.trim() && s3.region.trim() && s3.access_key_id.trim() && s3.secret_access_key.trim();
    }
    return (
      sql.host.trim() &&
      sql.port.trim() &&
      sql.database.trim() &&
      sql.username.trim() &&
      sql.password.length > 0 &&
      sql.query.trim()
    );
  };

  const runProbe = async () => {
    if (!kind) return;
    setTesting(true);
    setError(null);
    setProbe(null);
    try {
      if (kind === "s3") {
        const { data } = await datasetsApi.s3Test({
          bucket: s3.bucket.trim(),
          region: s3.region.trim(),
          access_key_id: s3.access_key_id.trim(),
          secret_access_key: s3.secret_access_key,
          prefix: s3.prefix.trim() || undefined,
        });
        setProbe(data);
      } else {
        const { data } = await datasetsApi.sqlTest({
          db_type: kind,
          host: sql.host.trim(),
          port: Number(sql.port),
          database: sql.database.trim(),
          username: sql.username.trim(),
          password: sql.password,
        });
        setProbe(data);
      }
    } catch {
      setProbe({ ok: false, latency_ms: 0, samples: [], error: "request_failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleCreate = async () => {
    if (!kind) return;
    setCreating(true);
    setError(null);
    try {
      if (kind === "s3") {
        // S3 ingestion isn't part of the existing Celery task yet; surface a
        // clear message until that lands rather than silently failing.
        setError("S3 import isn't wired into the Celery worker yet — verify-only for now.");
        return;
      }
      const { data } = await datasetsApi.sqlConnect({
        db_type: kind,
        host: sql.host.trim(),
        port: Number(sql.port),
        database: sql.database.trim(),
        username: sql.username.trim(),
        password: sql.password,
        query: sql.query.trim(),
      });
      onCreated(data.dataset_id, data.task_id);
      handleClose();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string; error?: string } } };
      setError(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          "Could not start the import.",
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 700 }}>
        <Box sx={{ flex: 1 }}>Connect a database</Box>
        <IconButton size="small" onClick={handleClose} aria-label="Close wizard">
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={step} sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        {step === 0 && (
          <Stack direction="row" spacing={2}>
            {(
              [
                {
                  k: "postgres" as const,
                  label: "PostgreSQL",
                  hint: "SELECT a query result into a dataset.",
                  Icon: StorageRoundedIcon,
                  color: "#0284c7",
                },
                {
                  k: "mysql" as const,
                  label: "MySQL",
                  hint: "Same flow as Postgres — credentials + a SELECT.",
                  Icon: HubRoundedIcon,
                  color: "#f97316",
                },
                {
                  k: "s3" as const,
                  label: "Amazon S3",
                  hint: "Probe a bucket + list objects (verify-only for now).",
                  Icon: CloudRoundedIcon,
                  color: "#7c3aed",
                },
              ] satisfies { k: ConnectorKind; label: string; hint: string; Icon: typeof StorageRoundedIcon; color: string }[]
            ).map(({ k, label, hint, Icon, color }) => (
              <Card key={k} sx={{ flex: 1, border: 1, borderColor: alpha(color, 0.4) }}>
                <CardActionArea onClick={() => handlePickKind(k)} sx={{ p: 2.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        bgcolor: alpha(color, 0.12),
                        color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon />
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {label}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {hint}
                  </Typography>
                </CardActionArea>
              </Card>
            ))}
          </Stack>
        )}

        {step === 1 && kind && kind !== "s3" && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.5}>
              <TextField
                label="Host"
                fullWidth
                value={sql.host}
                onChange={(e) => setSql((s) => ({ ...s, host: e.target.value }))}
              />
              <TextField
                label="Port"
                sx={{ width: 120 }}
                value={sql.port}
                onChange={(e) => setSql((s) => ({ ...s, port: e.target.value }))}
              />
            </Stack>
            <TextField
              label="Database"
              fullWidth
              value={sql.database}
              onChange={(e) => setSql((s) => ({ ...s, database: e.target.value }))}
            />
            <Stack direction="row" spacing={1.5}>
              <TextField
                label="Username"
                fullWidth
                value={sql.username}
                onChange={(e) => setSql((s) => ({ ...s, username: e.target.value }))}
              />
              <TextField
                label="Password"
                type="password"
                fullWidth
                value={sql.password}
                onChange={(e) => setSql((s) => ({ ...s, password: e.target.value }))}
              />
            </Stack>
            <TextField
              label="Query"
              multiline
              minRows={3}
              fullWidth
              value={sql.query}
              onChange={(e) => setSql((s) => ({ ...s, query: e.target.value }))}
              helperText="Result rows become the dataset. Add LIMIT to keep it manageable."
            />
          </Stack>
        )}

        {step === 1 && kind === "s3" && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.5}>
              <TextField
                label="Bucket"
                fullWidth
                value={s3.bucket}
                onChange={(e) => setS3((s) => ({ ...s, bucket: e.target.value }))}
              />
              <TextField
                label="Region"
                sx={{ width: 200 }}
                value={s3.region}
                onChange={(e) => setS3((s) => ({ ...s, region: e.target.value }))}
              />
            </Stack>
            <Stack direction="row" spacing={1.5}>
              <TextField
                label="Access key id"
                fullWidth
                value={s3.access_key_id}
                onChange={(e) => setS3((s) => ({ ...s, access_key_id: e.target.value }))}
              />
              <TextField
                label="Secret access key"
                type="password"
                fullWidth
                value={s3.secret_access_key}
                onChange={(e) => setS3((s) => ({ ...s, secret_access_key: e.target.value }))}
              />
            </Stack>
            <TextField
              label="Prefix (optional)"
              fullWidth
              value={s3.prefix}
              onChange={(e) => setS3((s) => ({ ...s, prefix: e.target.value }))}
              helperText="Restrict the listing to keys starting with this prefix."
            />
          </Stack>
        )}

        {step === 2 && (
          <Box>
            <Button
              variant="contained"
              onClick={runProbe}
              disabled={testing || !credentialsValid()}
              startIcon={testing ? <CircularProgress size={14} color="inherit" /> : null}
            >
              {testing ? "Probing…" : "Test connection"}
            </Button>
            {probe && (
              <Box sx={{ mt: 2 }}>
                {probe.ok ? (
                  <Alert
                    icon={<CheckCircleRoundedIcon />}
                    severity="success"
                    sx={{ mb: 1.5 }}
                  >
                    Connected in {probe.latency_ms} ms.
                  </Alert>
                ) : (
                  <Alert severity="error" sx={{ mb: 1.5 }}>
                    {probe.detail || probe.error || "Connection failed."}
                  </Alert>
                )}
                {probe.ok && probe.samples.length > 0 && (
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
                      Detected {kind === "s3" ? "objects" : "tables"} (first {probe.samples.length}):
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                      {probe.samples.map((s) => (
                        <Chip key={s} label={s} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Box sx={{ flex: 1 }}>
          {step > 0 && (
            <Button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={testing || creating}>
              Back
            </Button>
          )}
        </Box>
        {step === 1 && (
          <Button
            variant="contained"
            disabled={!credentialsValid()}
            onClick={() => {
              setProbe(null);
              setStep(2);
            }}
          >
            Next
          </Button>
        )}
        {step === 2 && (
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!probe?.ok || creating}
            startIcon={creating ? <CircularProgress size={14} color="inherit" /> : null}
          >
            {creating ? "Importing…" : "Create dataset"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

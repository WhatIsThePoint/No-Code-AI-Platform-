"""Sprint 7 Module 1 — model portability.

Two flavours:

* **Tabular**: zip the trained scikit/XGBoost/etc. estimator (`model.joblib`),
  any preprocessing sidecars saved next to it (scaler/imputer), and a
  `metadata.json` describing the expected feature columns / target / task type
  so the user can recreate the inference pipeline locally with three lines of
  Python.

* **GenAI (RAG)**: the platform doesn't fine-tune anything today — pipelines
  are pure retrieval-augmented generation against a base Ollama model.
  So instead of shipping adapter weights that don't exist, we ship an Ollama
  `Modelfile` that bakes the pipeline's RAG `SYSTEM` prompt onto the base
  model, plus a manifest of the documents the user originally indexed and a
  `README.md` walking through `ollama create`.

Both packagers stream straight to a `BytesIO` so the Flask response can be
returned without writing temp files.
"""

from __future__ import annotations

import io
import json
import os
import zipfile
from datetime import datetime, timezone


def _add_bytes(zf: zipfile.ZipFile, arcname: str, data: bytes) -> None:
    info = zipfile.ZipInfo(arcname, date_time=datetime.now(timezone.utc).timetuple()[:6])
    info.compress_type = zipfile.ZIP_DEFLATED
    zf.writestr(info, data)


def _add_text(zf: zipfile.ZipFile, arcname: str, text: str) -> None:
    _add_bytes(zf, arcname, text.encode("utf-8"))


def _add_file(zf: zipfile.ZipFile, arcname: str, path: str) -> bool:
    """Add a file from disk if it exists. Returns True when added."""
    if not path or not os.path.exists(path):
        return False
    with open(path, "rb") as fh:
        _add_bytes(zf, arcname, fh.read())
    return True


# ─────────────────────────────────────────────────────────────────────────────
# Tabular
# ─────────────────────────────────────────────────────────────────────────────


_TABULAR_README = """\
# Tabular model export — {algorithm}

This zip was produced by the No-Code AI Platform on {generated_at}.

Contents
--------
- `model.joblib`        — the fitted estimator (scikit-learn / XGBoost / etc.)
- `metadata.json`       — feature columns, target, task_type, training metrics
- `scaler.joblib`*      — StandardScaler/MinMax/etc., if one was fit
- `imputer.joblib`*     — column imputer, if one was fit
- `load_example.py`     — minimal usage snippet

(*) optional, only present if the pipeline used them.

Quick start
-----------
```bash
pip install joblib scikit-learn pandas
python load_example.py path/to/your.csv
```
"""

_TABULAR_LOAD_EXAMPLE = """\
\"\"\"Load and run the exported model on a new CSV.

Usage:
    python load_example.py /path/to/new_data.csv
\"\"\"
import json
import sys
from pathlib import Path

import joblib
import pandas as pd

HERE = Path(__file__).resolve().parent
meta = json.loads((HERE / "metadata.json").read_text())

model = joblib.load(HERE / "model.joblib")

scaler = None
if (HERE / "scaler.joblib").exists():
    scaler = joblib.load(HERE / "scaler.joblib")

imputer = None
if (HERE / "imputer.joblib").exists():
    imputer = joblib.load(HERE / "imputer.joblib")


def predict(csv_path: str):
    df = pd.read_csv(csv_path)
    X = df[meta["feature_columns"]]
    if imputer is not None:
        X = pd.DataFrame(imputer.transform(X), columns=meta["feature_columns"])
    if scaler is not None:
        X = pd.DataFrame(scaler.transform(X), columns=meta["feature_columns"])
    return model.predict(X)


if __name__ == "__main__":
    print(predict(sys.argv[1]))
"""


def build_tabular_zip(version_doc: dict) -> io.BytesIO:
    """Package a saved model version into a portable zip.

    `version_doc` is a row from the `model_versions` collection (already
    serialised — `created_at` may be an ISO string).
    """
    artifact_path = version_doc.get("artifact_path")
    if not artifact_path or not os.path.exists(artifact_path):
        raise FileNotFoundError(f"Model artifact missing at {artifact_path!r}")

    algorithm = version_doc.get("algorithm") or "model"
    feature_columns = version_doc.get("feature_columns") or []
    metadata = {
        "algorithm": algorithm,
        "task_type": version_doc.get("task_type"),
        "target_column": (version_doc.get("hyperparams") or {}).get("target_column"),
        "feature_columns": feature_columns,
        "metrics": version_doc.get("metrics") or {},
        "hyperparams": version_doc.get("hyperparams") or {},
        "version_id": version_doc.get("version_id"),
        "pipeline_id": version_doc.get("pipeline_id"),
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        _add_file(zf, "model.joblib", artifact_path)
        _add_text(zf, "metadata.json", json.dumps(metadata, indent=2, default=str))

        # Sidecar artifacts live next to model.joblib by convention.
        artifact_dir = os.path.dirname(artifact_path)
        for sidecar in ("scaler.joblib", "imputer.joblib"):
            _add_file(zf, sidecar, os.path.join(artifact_dir, sidecar))

        _add_text(
            zf,
            "README.md",
            _TABULAR_README.format(
                algorithm=algorithm,
                generated_at=metadata["exported_at"],
            ),
        )
        _add_text(zf, "load_example.py", _TABULAR_LOAD_EXAMPLE)

    buf.seek(0)
    return buf


# ─────────────────────────────────────────────────────────────────────────────
# GenAI / RAG
# ─────────────────────────────────────────────────────────────────────────────


_GENAI_MODELFILE_TEMPLATE = """\
# Generated by the No-Code AI Platform on {generated_at}
# Pipeline: {pipeline_name} ({pipeline_id})
#
# This Modelfile bakes the pipeline's RAG system prompt onto the base Ollama
# model. The retrieval step is *not* baked in — to reproduce full RAG locally,
# re-index the documents listed in `documents.json` into your own vector store
# and prepend retrieved context to each user prompt.

FROM {base_model}

PARAMETER temperature 0.2
PARAMETER num_ctx 2048

SYSTEM \"\"\"
{system_prompt}
\"\"\"
"""

_GENAI_README = """\
# RAG pipeline export — {pipeline_name}

This zip was produced by the No-Code AI Platform on {generated_at}.

Contents
--------
- `Modelfile`        — Ollama model definition with your RAG system prompt
- `documents.json`   — list of documents originally indexed into this pipeline
- `system_prompt.txt`— the system prompt as plain text (for reference)
- `README.md`        — this file

Reproduce locally
-----------------

1. Make sure Ollama is installed and the base model is pulled:

   ```bash
   ollama pull {base_model}
   ```

2. Build a local copy of this pipeline's persona:

   ```bash
   ollama create {pipeline_slug} -f ./Modelfile
   ollama run {pipeline_slug}
   ```

3. (Optional) For full RAG behaviour you also need to re-index the documents
   listed in `documents.json` into a local vector store and prepend the
   retrieved chunks to each prompt. The platform uses
   `sentence-transformers/all-MiniLM-L6-v2` (384-dim) + cosine similarity over
   pgvector — any equivalent stack works.
"""


def _slugify(name: str) -> str:
    out = "".join(c.lower() if c.isalnum() else "-" for c in name)
    while "--" in out:
        out = out.replace("--", "-")
    return out.strip("-") or "rag-pipeline"


def build_genai_zip(
    pipeline_doc: dict,
    documents: list[dict],
    system_prompt: str,
    base_model: str,
) -> io.BytesIO:
    """Package a RAG pipeline into a portable Ollama bundle."""
    pipeline_id = pipeline_doc.get("pipeline_id", "")
    pipeline_name = pipeline_doc.get("name") or "rag-pipeline"
    generated_at = datetime.now(timezone.utc).isoformat()

    modelfile = _GENAI_MODELFILE_TEMPLATE.format(
        generated_at=generated_at,
        pipeline_name=pipeline_name,
        pipeline_id=pipeline_id,
        base_model=base_model,
        system_prompt=system_prompt.strip(),
    )

    docs_payload = {
        "pipeline_id": pipeline_id,
        "pipeline_name": pipeline_name,
        "exported_at": generated_at,
        "documents": [
            {
                "document_id": d.get("document_id"),
                "filename": d.get("filename") or d.get("source_name"),
                "chunk_count": d.get("chunk_count"),
                "status": d.get("status"),
                "uploaded_at": (
                    d.get("uploaded_at").isoformat()
                    if hasattr(d.get("uploaded_at"), "isoformat")
                    else d.get("uploaded_at")
                ),
            }
            for d in documents
        ],
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        _add_text(zf, "Modelfile", modelfile)
        _add_text(zf, "system_prompt.txt", system_prompt.strip() + "\n")
        _add_text(zf, "documents.json", json.dumps(docs_payload, indent=2, default=str))
        _add_text(
            zf,
            "README.md",
            _GENAI_README.format(
                pipeline_name=pipeline_name,
                pipeline_slug=_slugify(pipeline_name),
                generated_at=generated_at,
                base_model=base_model,
            ),
        )

    buf.seek(0)
    return buf

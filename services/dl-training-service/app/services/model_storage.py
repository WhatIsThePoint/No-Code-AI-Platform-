"""Filesystem layout for trained DL artefacts.

Each version_id gets its own directory under MODEL_FOLDER:

    /models/<version_id>/
        model.pt             # torch.save(state_dict)
        class_index.json     # {"0": "cat", "1": "dog", ...}
        training_meta.json   # arch, hparams, dataset_id, metrics_summary

This deliberately mirrors the H2O artefact layout used by ml-training-service
(`<version_id>/model.zip`) so the existing model-registry download endpoint
in api-gateway can serve both kinds with no special-casing — it just streams
whatever files are on disk under the version directory.
"""

from __future__ import annotations

import json
import os
from typing import TYPE_CHECKING, Any, Mapping

if TYPE_CHECKING:  # pragma: no cover — type-only import, avoid runtime cost
    import torch  # noqa: F401


def version_dir(model_folder: str, version_id: str) -> str:
    """Absolute path to `MODEL_FOLDER/<version_id>/`. Does not create it."""
    return os.path.join(model_folder, version_id)


def ensure_dir(model_folder: str, version_id: str) -> str:
    path = version_dir(model_folder, version_id)
    os.makedirs(path, exist_ok=True)
    return path


def save(
    model_folder: str,
    version_id: str,
    state_dict: Mapping[str, Any],
    class_index: Mapping[int, str] | Mapping[str, str],
    meta: Mapping[str, Any],
) -> str:
    """Persist a trained model + its sidecar metadata. Returns the dir."""
    # Lazy import — keeps `import app.services.model_storage` cheap for code
    # paths that only need version_dir() (e.g. the route layer pre-flight).
    import torch

    path = ensure_dir(model_folder, version_id)

    # Torch's recommended save path is `state_dict()` not the whole model;
    # this also avoids accidentally pickling user code paths that might not
    # be importable on the predict side later.
    torch.save(dict(state_dict), os.path.join(path, "model.pt"))

    with open(os.path.join(path, "class_index.json"), "w", encoding="utf-8") as fh:
        # Coerce keys to strings unconditionally so JSON round-trips cleanly
        # — torch label tensors are int64 and json.dump would otherwise raise.
        json.dump({str(k): v for k, v in class_index.items()}, fh, indent=2)

    with open(os.path.join(path, "training_meta.json"), "w", encoding="utf-8") as fh:
        json.dump(dict(meta), fh, indent=2, default=str)

    return path


def load_meta(model_folder: str, version_id: str) -> dict[str, Any]:
    with open(
        os.path.join(version_dir(model_folder, version_id), "training_meta.json"),
        encoding="utf-8",
    ) as fh:
        return json.load(fh)


def load_class_index(model_folder: str, version_id: str) -> dict[int, str]:
    with open(
        os.path.join(version_dir(model_folder, version_id), "class_index.json"),
        encoding="utf-8",
    ) as fh:
        raw = json.load(fh)
    # JSON keys are strings; reconstitute integer indices for the predict path.
    return {int(k): v for k, v in raw.items()}


def model_state_path(model_folder: str, version_id: str) -> str:
    """Path to `model.pt`. Caller is responsible for `torch.load(...)`."""
    return os.path.join(version_dir(model_folder, version_id), "model.pt")

"""
Hardware capability probe.

Exposes a best-effort snapshot of the host's compute resources so the frontend
can scale UI constraints (Top-K caps, model availability) to the user's actual
VRAM budget rather than guessing. Tries `nvidia-smi` first; falls back to
`/proc/meminfo` on hosts without an NVIDIA GPU. Cached in-process for 30 s.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import time
from typing import Any

from flask import Blueprint, jsonify

system_bp = Blueprint("system", __name__)

_CACHE: dict[str, Any] = {"value": None, "ts": 0.0}
# Short TTL: the live admin panel polls this every ~3 s. 2 s lets a fresh
# burst share one subprocess call without making the panel feel stale.
_CACHE_TTL = 2.0


def _gpu_from_env() -> dict[str, Any] | None:
    """
    Manual override for environments where the gateway container can't see
    the host GPU (e.g. no nvidia runtime mounted). Set GPU_TOTAL_VRAM_MB to
    advertise the host card to the frontend.
    """
    raw_total = os.environ.get("GPU_TOTAL_VRAM_MB")
    if not raw_total:
        return None
    try:
        total = int(raw_total)
    except ValueError:
        return None
    if total <= 0:
        return None
    free = total
    raw_free = os.environ.get("GPU_FREE_VRAM_MB")
    if raw_free:
        try:
            free = max(0, min(int(raw_free), total))
        except ValueError:
            pass
    return {
        "name": os.environ.get("GPU_NAME", "GPU (declared via env)"),
        "total_mb": total,
        "free_mb": free,
    }


def _probe_gpu() -> dict[str, Any] | None:
    """Return {name, total_mb, free_mb} for the first NVIDIA GPU, or None."""
    override = _gpu_from_env()
    if override is not None:
        return override
    if shutil.which("nvidia-smi") is None:
        return None
    try:
        out = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,memory.total,memory.free",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            timeout=2.5,
            check=True,
        )
    except (subprocess.SubprocessError, FileNotFoundError, OSError):
        return None

    line = (out.stdout or "").strip().splitlines()
    if not line:
        return None
    parts = [p.strip() for p in line[0].split(",")]
    if len(parts) < 3:
        return None
    try:
        return {
            "name": parts[0],
            "total_mb": int(parts[1]),
            "free_mb": int(parts[2]),
        }
    except ValueError:
        return None


def _probe_ram() -> dict[str, int]:
    """Read total + available RAM from /proc/meminfo (Linux). Defaults to 0 on failure."""
    total_kb = available_kb = 0
    try:
        with open("/proc/meminfo", "r", encoding="utf-8") as fh:
            for raw in fh:
                if raw.startswith("MemTotal:"):
                    total_kb = int(raw.split()[1])
                elif raw.startswith("MemAvailable:"):
                    available_kb = int(raw.split()[1])
                if total_kb and available_kb:
                    break
    except (OSError, ValueError):
        pass
    return {"total_mb": total_kb // 1024, "free_mb": available_kb // 1024}


def _classify(gpu: dict[str, Any] | None, ram: dict[str, int]) -> dict[str, Any]:
    """
    Pick a profile band + recommended Top-K ceiling from the raw probe.

    Bands intentionally err conservative — the ceiling targets what the GPU
    can sustain at K with an 8K context, *not* peak weights-only fit:

      high  ≥ 12 GB  — 4070+/A-series, comfortable headroom
      mid   8–12 GB  — 3060 12 GB, 3070, 4060 Ti
      low   < 8 GB   — 1660 SUPER, 3050, 4060 8 GB; the realistic K cap is 10
    """
    if gpu and gpu["total_mb"] >= 12_000:
        return {"profile": "high", "recommended_top_k": 20, "max_top_k": 20}
    if gpu and gpu["total_mb"] >= 8_000:
        return {"profile": "mid", "recommended_top_k": 12, "max_top_k": 15}
    if gpu:
        # Sub-8 GB GPU. PFE target hardware (1660 SUPER, 6 GB) lives here.
        return {"profile": "low", "recommended_top_k": 8, "max_top_k": 10}
    # No GPU at all — CPU-only inference. Keep retrieval small.
    if ram["total_mb"] >= 16_000:
        return {"profile": "cpu_mid", "recommended_top_k": 5, "max_top_k": 8}
    return {"profile": "cpu_low", "recommended_top_k": 3, "max_top_k": 5}


def _build_profile() -> dict[str, Any]:
    gpu = _probe_gpu()
    ram = _probe_ram()
    bands = _classify(gpu, ram)
    return {
        "gpu_detected": gpu is not None,
        "gpu": gpu,
        "ram": ram,
        **bands,
    }


@system_bp.get("/system/hardware")
def hardware():
    now = time.monotonic()
    if _CACHE["value"] is None or (now - _CACHE["ts"]) > _CACHE_TTL:
        _CACHE["value"] = _build_profile()
        _CACHE["ts"] = now
    return jsonify(_CACHE["value"]), 200

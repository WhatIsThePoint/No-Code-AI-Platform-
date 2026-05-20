"""Sanity tests for the static VRAM estimator.

These aren't exact — vram_guard is intentionally conservative — but they
guard the demo invariants:

* every catalog (arch, input_size, batch_size) combination at the maximum
  values allowed by the route MUST fit inside a 1660 Super (6144 MB) once
  the 1 GB headroom is subtracted, otherwise `Train` is unreachable
  end-to-end on the demo machine
* a deliberately oversized request (mobilenet_v3_small @ 224 × 1024) MUST
  be rejected — if a future refactor accidentally tightens the
  per-pixel constants and lets oversize requests slip through, this test
  flags it before the GPU does at runtime
"""

from __future__ import annotations

import pytest

from app.archs import available
from app.services import vram_guard


_DEMO_GPU_VRAM_MB = 6144  # GTX 1660 Super
_DEMO_BUDGET_MB = vram_guard.budget_after_headroom(_DEMO_GPU_VRAM_MB)


@pytest.mark.parametrize("arch", available())
@pytest.mark.parametrize("input_size", [28, 64, 128, 224])
@pytest.mark.parametrize("batch_size", [16, 32, 64])
def test_catalog_combinations_fit_demo_gpu(arch, input_size, batch_size):
    est = vram_guard.estimate(arch, input_size, batch_size)
    assert est.total_mb <= _DEMO_BUDGET_MB, (
        f"{arch}@{input_size}px batch={batch_size} estimates "
        f"{est.total_mb:.0f} MB which exceeds the 1660-Super budget "
        f"{_DEMO_BUDGET_MB:.0f} MB — narrow the catalog or tune the "
        f"per-pixel activation constant."
    )


def test_oversized_request_is_refused():
    """At 1024×1024 input, mobilenet_v3_small must blow the budget. This is
    a defence-in-depth check — the route's ALLOWED_INPUT_SIZES already
    rejects 1024, but we want vram_guard to catch it independently in case
    a future PR loosens the route validation."""
    est = vram_guard.estimate("mobilenet_v3_small", 1024, 64)
    assert est.total_mb > _DEMO_BUDGET_MB


def test_estimate_grows_monotonically_with_batch():
    base = vram_guard.estimate("tiny_resnet", 64, 16).total_mb
    bigger = vram_guard.estimate("tiny_resnet", 64, 64).total_mb
    assert bigger > base


def test_estimate_grows_quadratically_with_input_size():
    """Activations dominate at large input sizes; doubling input size should
    roughly quadruple the activation term, not double it."""
    a = vram_guard.estimate("tiny_resnet", 64, 32).activations_mb
    b = vram_guard.estimate("tiny_resnet", 128, 32).activations_mb
    # Allow ±20 % of the ideal 4× scaling factor.
    ratio = b / a
    assert 3.2 <= ratio <= 4.8, f"activation scaling ratio {ratio:.2f}, expected ~4"

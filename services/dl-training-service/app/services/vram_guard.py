"""Static VRAM-budget estimator for the on-stage safety net.

This isn't a precise simulator — it's a deliberately conservative envelope
so the user can't hit "Train" and OOM the GPU mid-demo. The model has four
buckets, all in MB:

  weights        fp32 parameter footprint of the architecture
  optimizer      Adam keeps two moment tensors per param (~2× weights);
                 SGD keeps one momentum buffer (~1×). We assume Adam — the
                 default optimizer in the catalog — for the conservative
                 estimate, then add 1× for gradients = 3× weights total
  activations    forward/backward feature maps, kept around for autograd.
                 Empirically scales linearly with batch_size and quadratically
                 with input_size; the per-arch constants below were tuned
                 against actual `nvidia-smi` peaks at batch=32, input=224
                 (mobilenet_v3_small) and back-propagated to a per-image
                 quadratic coefficient
  runtime        CUDA context, cuDNN workspaces, allocator fragmentation —
                 a flat 350 MB on Turing (1660 Super)

Estimate is `weights + 3*weights + activations(batch, input) + runtime`,
and the route refuses the request if that exceeds
`min(user.max_vram_mb, DEFAULT_MAX_VRAM_MB) - 1024 MB headroom`.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..archs import params_mb


# (per-pixel activation MB at fp32) — calibrated against measured peak VRAM.
# Higher = more conservative. These are deliberately on the high side; better
# to refuse a job that would have just fit than to OOM mid-epoch.
_ACTIVATION_PER_PIXEL_MB: dict[str, float] = {
    "lenet": 1.5e-5,
    "tiny_resnet": 8.0e-5,
    "mobilenet_v3_small": 5.0e-5,
}

# Fixed CUDA / cuDNN runtime overhead. Empirically ~300–400 MB on a 1660
# Super; rounded up.
_CUDA_RUNTIME_MB: float = 350.0


@dataclass
class Estimate:
    weights_mb: float
    optimizer_mb: float          # weights + grads + Adam moments (3× weights)
    activations_mb: float
    runtime_mb: float
    total_mb: float

    def to_dict(self) -> dict:
        return {
            "weights_mb": round(self.weights_mb, 1),
            "optimizer_mb": round(self.optimizer_mb, 1),
            "activations_mb": round(self.activations_mb, 1),
            "runtime_mb": round(self.runtime_mb, 1),
            "total_mb": round(self.total_mb, 1),
        }


def estimate(arch: str, input_size: int, batch_size: int) -> Estimate:
    """Conservative peak-VRAM estimate. Inputs are validated by the route."""
    if arch not in _ACTIVATION_PER_PIXEL_MB:
        raise ValueError(f"No activation profile for arch '{arch}'")

    weights = params_mb(arch)
    optimizer = 3.0 * weights
    activations = (
        _ACTIVATION_PER_PIXEL_MB[arch]
        * (input_size * input_size)
        * batch_size
    )
    total = weights + optimizer + activations + _CUDA_RUNTIME_MB
    return Estimate(
        weights_mb=weights,
        optimizer_mb=optimizer,
        activations_mb=activations,
        runtime_mb=_CUDA_RUNTIME_MB,
        total_mb=total,
    )


def fits(arch: str, input_size: int, batch_size: int, budget_mb: float) -> bool:
    """`budget_mb` should already have the safety headroom subtracted."""
    return estimate(arch, input_size, batch_size).total_mb <= budget_mb


# Reserved for the host, not the tenant — leaves room for the NVIDIA driver,
# the desktop compositor, and allocator fragmentation. Nothing the user does
# can shrink this.
HEADROOM_MB: float = 1024.0


def budget_after_headroom(max_vram_mb: float) -> float:
    return max(0.0, max_vram_mb - HEADROOM_MB)

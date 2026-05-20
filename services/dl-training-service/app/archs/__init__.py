"""Architecture registry.

The factory is a frozen catalog (no user-supplied layer DAGs) — see the
SCOPE block in the project plan: a freeform builder is too easy to OOM on
stage. To extend, add a new module under `archs/` exposing `build(...)`,
register it in `_REGISTRY` and add the key to the route's `ALLOWED_ARCHS`.
"""

from __future__ import annotations

from typing import Callable

import torch.nn as nn

from . import lenet, mobilenet, tiny_resnet

# (build_fn, params_mb, default_input_size) per arch — params_mb is the
# fp32 weight footprint used by vram_guard.estimate(). Keep these in sync
# with the actual arch implementations; the unit tests verify the count.
_REGISTRY: dict[str, tuple[Callable[..., nn.Module], float, int]] = {
    "lenet": (lenet.build, 0.3, 28),
    "tiny_resnet": (tiny_resnet.build, 11.0, 64),
    "mobilenet_v3_small": (mobilenet.build, 10.0, 224),
}


def available() -> list[str]:
    return sorted(_REGISTRY.keys())


def build(
    arch: str,
    num_classes: int,
    input_size: int,
    pretrained: bool = False,
    in_channels: int = 3,
) -> nn.Module:
    """Instantiate an architecture by name.

    Raises ValueError when `arch` isn't registered — the route layer should
    have already validated against ALLOWED_ARCHS, so this only fires on
    programmer error.
    """
    if arch not in _REGISTRY:
        raise ValueError(
            f"Unknown arch '{arch}'. Available: {sorted(_REGISTRY.keys())}"
        )
    build_fn, _, _ = _REGISTRY[arch]
    return build_fn(
        num_classes=num_classes,
        input_size=input_size,
        pretrained=pretrained,
        in_channels=in_channels,
    )


def params_mb(arch: str) -> float:
    """Static fp32 weight size for `arch`, in MB. Used by vram_guard."""
    if arch not in _REGISTRY:
        raise ValueError(f"Unknown arch '{arch}'")
    return _REGISTRY[arch][1]


def default_input_size(arch: str) -> int:
    if arch not in _REGISTRY:
        raise ValueError(f"Unknown arch '{arch}'")
    return _REGISTRY[arch][2]

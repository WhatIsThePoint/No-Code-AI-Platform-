"""Per-tier resource ceilings.

Single source of truth for the limits surfaced to the frontend (slider
caps), the gateway (proxy header forwarding), and the dl-training-service
(VRAM + epoch / batch-size refusal). When a `Subscription` row has a
non-NULL override for a given key, that override wins; otherwise the
tier's default below is used.

Sprint 8 added the DL pair (max_dl_epochs / max_dl_batch_size) and split
the previously-implicit max_vram_mb default into the same tier table.
"""

from __future__ import annotations

from typing import TypedDict


class TierLimits(TypedDict):
    max_chunks: int
    max_vram_mb: int
    max_dl_epochs: int
    max_dl_batch_size: int


# Tuned for the demo box (1660 Super, 6 GB VRAM):
#   * `max_vram_mb` is the *budget* the dl-training vram_guard sees as
#     `X-Max-Vram-MB` — the guard subtracts a 1 GB headroom on top, so
#     5120 leaves the demo with ~4 GB of usable budget for activations
#     and the model itself.
#   * `max_dl_epochs` / `max_dl_batch_size` are clamped against the
#     service-wide HARD_MAX_* in dl-training-service.config; nothing in
#     this table can exceed those service-wide ceilings.
TIER_DEFAULTS: dict[str, TierLimits] = {
    "free": {
        "max_chunks": 200,
        "max_vram_mb": 4096,
        "max_dl_epochs": 5,
        "max_dl_batch_size": 32,
    },
    "solo": {
        "max_chunks": 2000,
        "max_vram_mb": 5120,
        "max_dl_epochs": 20,
        "max_dl_batch_size": 64,
    },
    "company": {
        "max_chunks": 20000,
        "max_vram_mb": 5120,
        "max_dl_epochs": 50,
        "max_dl_batch_size": 64,
    },
    # Super-admins inherit the company ceiling so internal demo accounts
    # don't surprise the operator with "you don't have a subscription".
    "super_admin": {
        "max_chunks": 20000,
        "max_vram_mb": 5120,
        "max_dl_epochs": 50,
        "max_dl_batch_size": 64,
    },
}


def effective_limits(
    tier: str | None,
    overrides: dict[str, int | None] | None = None,
) -> TierLimits:
    """Return the user's effective per-key ceilings.

    `tier` is the tier string from `User.tier` (one of the keys above);
    `overrides` is the raw value of the four override columns from the
    user's `Subscription` row, with `None` meaning "use the default".

    Falls back to the `free` row when `tier` is unknown rather than
    raising — the route layer treats unknown tiers as the safest possible
    bucket.
    """
    base = TIER_DEFAULTS.get(tier or "free", TIER_DEFAULTS["free"])
    if not overrides:
        return dict(base)  # type: ignore[return-value]
    out: TierLimits = dict(base)  # type: ignore[assignment]
    for key in ("max_chunks", "max_vram_mb", "max_dl_epochs", "max_dl_batch_size"):
        v = overrides.get(key)
        if v is not None:
            out[key] = int(v)  # type: ignore[literal-required]
    return out

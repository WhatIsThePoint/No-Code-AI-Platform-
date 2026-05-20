"""Per-tier resource ceilings — DL service mirror.

This is the same table as `auth-service/app/services/plan_limits.py`,
duplicated here so the dl-training service stays self-contained for VRAM
+ epoch + batch-size refusal without an inline call back to auth.

If you change the numbers in one file, change the other. The two
services intentionally do not share a Python package — duplication is
the trade-off we accept for runtime decoupling. A drift check could be
added in CI if it ever bites us.
"""

from __future__ import annotations

from typing import TypedDict


class TierLimits(TypedDict):
    max_vram_mb: int
    max_dl_epochs: int
    max_dl_batch_size: int


TIER_DEFAULTS: dict[str, TierLimits] = {
    "free": {"max_vram_mb": 4096, "max_dl_epochs": 5, "max_dl_batch_size": 32},
    "solo": {"max_vram_mb": 5120, "max_dl_epochs": 20, "max_dl_batch_size": 64},
    "company": {"max_vram_mb": 5120, "max_dl_epochs": 50, "max_dl_batch_size": 64},
    "super_admin": {"max_vram_mb": 5120, "max_dl_epochs": 50, "max_dl_batch_size": 64},
}


def for_tier(tier: str | None) -> TierLimits:
    """Lookup with a safe fallback to the `free` row when the tier is
    unknown (or absent — happens when the gateway forwards an empty
    `X-User-Tier` header on a token that pre-dates the tier claim)."""
    return TIER_DEFAULTS.get(tier or "free", TIER_DEFAULTS["free"])

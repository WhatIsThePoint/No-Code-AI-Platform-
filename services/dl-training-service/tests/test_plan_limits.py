"""Tier-defaults table sanity tests.

The dl-training-service mirrors auth-service's plan_limits table; if the
two ever drift, the demo will silently misclamp. We can't import
auth-service from here at runtime, but we can pin the *expected shape* of
the table and at least catch accidental key additions / numeric typos.
"""

from __future__ import annotations

import pytest

from app.services.plan_limits import TIER_DEFAULTS, for_tier


REQUIRED_TIERS = {"free", "solo", "company", "super_admin"}
REQUIRED_KEYS = {"max_vram_mb", "max_dl_epochs", "max_dl_batch_size"}


def test_table_has_every_tier():
    assert REQUIRED_TIERS <= TIER_DEFAULTS.keys()


@pytest.mark.parametrize("tier", sorted(REQUIRED_TIERS))
def test_each_tier_row_has_every_key(tier):
    row = TIER_DEFAULTS[tier]
    assert REQUIRED_KEYS == set(row.keys())


def test_unknown_tier_falls_back_to_free():
    # An unknown tier should yield the conservative `free` row, not raise.
    assert for_tier("nonexistent") == TIER_DEFAULTS["free"]
    assert for_tier(None) == TIER_DEFAULTS["free"]


def test_paid_tiers_have_higher_or_equal_caps():
    free = TIER_DEFAULTS["free"]
    for tier_name in ("solo", "company", "super_admin"):
        row = TIER_DEFAULTS[tier_name]
        for key in REQUIRED_KEYS:
            assert row[key] >= free[key], (
                f"{tier_name}.{key} ({row[key]}) must be ≥ free.{key} ({free[key]})"
            )


def test_company_caps_dont_exceed_super_admin():
    """Super-admin is meant to be the platform's internal account — never
    less generous than company. Catches the easy typo of mixing up tiers."""
    company = TIER_DEFAULTS["company"]
    sa = TIER_DEFAULTS["super_admin"]
    for key in REQUIRED_KEYS:
        assert sa[key] >= company[key]

from marshmallow import Schema, fields, validate

VALID_PLANS = [
    "solo_monthly",
    "solo_yearly",
    "company_monthly",
    "company_yearly",
]


class CheckoutSchema(Schema):
    plan = fields.Str(required=True, validate=validate.OneOf(VALID_PLANS))
    success_url = fields.Str(load_default=None)
    cancel_url = fields.Str(load_default=None)


class SubscriptionOverrideSchema(Schema):
    plan = fields.Str(
        required=True,
        validate=validate.OneOf(["free"] + VALID_PLANS),
    )
    status = fields.Str(
        load_default="active",
        validate=validate.OneOf(["active", "trialing", "past_due", "canceled"]),
    )
    # Per-user quota overrides. `None` (or absent) means "clear the override
    # and fall back to the plan default". Bounds chosen for the GTX 1660 Super
    # dev hardware — 50k chunks × 384-dim vectors ≈ 75 MB of pgvector data;
    # 16 GB VRAM ceiling covers any consumer GPU we'd realistically support.
    max_chunks = fields.Int(
        load_default=None,
        allow_none=True,
        validate=validate.Range(min=0, max=50_000),
    )
    max_vram_mb = fields.Int(
        load_default=None,
        allow_none=True,
        validate=validate.Range(min=0, max=16_384),
    )

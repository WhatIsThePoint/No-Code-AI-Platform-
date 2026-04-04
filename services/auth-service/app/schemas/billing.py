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

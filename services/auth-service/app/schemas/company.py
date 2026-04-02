from marshmallow import Schema, fields, validate


class CreateCompanySchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    slug = fields.Str(validate=validate.Length(min=1, max=100))


class InviteMemberSchema(Schema):
    email = fields.Email(required=True)
    role = fields.Str(
        required=True,
        validate=validate.OneOf(["data_scientist", "pm", "analyst", "viewer"]),
    )


class MembershipSchema(Schema):
    id = fields.UUID(dump_only=True)
    user_id = fields.UUID(dump_only=True)
    role = fields.Str(dump_only=True)
    status = fields.Str(dump_only=True)
    created_at = fields.DateTime(dump_only=True)

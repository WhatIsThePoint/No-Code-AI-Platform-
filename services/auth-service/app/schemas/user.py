from marshmallow import Schema, fields, validate


class UserSchema(Schema):
    id = fields.UUID(dump_only=True)
    email = fields.Email(dump_only=True)
    full_name = fields.Str()
    role = fields.Str(dump_only=True)
    tier = fields.Str(dump_only=True)
    totp_enabled = fields.Bool(dump_only=True)
    created_at = fields.DateTime(dump_only=True)


class UpdateProfileSchema(Schema):
    full_name = fields.Str(validate=validate.Length(min=1, max=255))
    role = fields.Str(
        validate=validate.OneOf(["data_scientist", "engineer", "analyst"])
    )

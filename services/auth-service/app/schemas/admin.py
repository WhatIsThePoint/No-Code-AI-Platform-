from marshmallow import Schema, fields, validate


class UserSearchSchema(Schema):
    q = fields.Str(load_default="")
    page = fields.Int(load_default=1, validate=validate.Range(min=1))
    limit = fields.Int(load_default=20, validate=validate.Range(min=1, max=100))
    role = fields.Str(load_default=None)
    tier = fields.Str(load_default=None)
    is_active = fields.Bool(load_default=None)


class UserPatchSchema(Schema):
    is_active = fields.Bool(load_default=None)
    role = fields.Str(
        load_default=None,
        validate=validate.OneOf(
            ["data_scientist", "engineer", "analyst", "super_admin"]
        ),
    )
    tier = fields.Str(
        load_default=None,
        validate=validate.OneOf(["free", "solo", "company", "super_admin"]),
    )


class AnnouncementSchema(Schema):
    title = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    body = fields.Str(required=True, validate=validate.Length(min=1))
    is_active = fields.Bool(load_default=True)


class LogSearchSchema(Schema):
    action = fields.Str(load_default=None)
    actor_id = fields.Str(load_default=None)
    target_type = fields.Str(load_default=None)
    page = fields.Int(load_default=1, validate=validate.Range(min=1))
    limit = fields.Int(load_default=50, validate=validate.Range(min=1, max=200))

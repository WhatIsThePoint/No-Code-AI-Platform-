from marshmallow import Schema, fields, validate


class RegisterSchema(Schema):
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=8))
    full_name = fields.Str(load_default=None)
    role = fields.Str(
        load_default="data_scientist",
        validate=validate.OneOf(["data_scientist", "engineer", "analyst"]),
    )


class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.Str(required=True)


class TotpVerifySchema(Schema):
    session_token = fields.Str(required=True)
    code = fields.Str(required=True, validate=validate.Length(equal=6))


class TotpSetupConfirmSchema(Schema):
    code = fields.Str(required=True, validate=validate.Length(equal=6))

"""Sprint 6 — project ACL & member CRUD."""

import uuid

from flask_jwt_extended import decode_token


def _register_and_login(client, email="owner@example.com", password="password123"):
    client.post("/auth/register", json={"email": email, "password": password})
    resp = client.post("/auth/login", json={"email": email, "password": password})
    return resp.get_json()["access_token"]


def _user_id(app, token):
    with app.app_context():
        return decode_token(token)["sub"]


def _create_company(client, token, name="Acme"):
    resp = client.post(
        "/companies",
        json={"name": name},
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp.get_json()["company_id"]


# ─────────────────────────────────────────────────────────────────────────────
# /acl/projects/check  (server-to-server)
# ─────────────────────────────────────────────────────────────────────────────


def test_acl_check_personal_owner_allowed(client, app):
    token = _register_and_login(client, "p1@example.com")
    me_id = _user_id(app, token)

    resp = client.post(
        "/acl/projects/check",
        json={
            "user_id": me_id,
            "project_id": "p-personal-1",
            "owner_type": "personal",
            "project_owner_id": me_id,
        },
    )
    body = resp.get_json()
    assert body["allowed"] is True
    assert body["reason"] == "personal_owner"


def test_acl_check_personal_other_user_denied(client, app):
    other_token = _register_and_login(client, "p2@example.com")
    other_id = _user_id(app, other_token)

    resp = client.post(
        "/acl/projects/check",
        json={
            "user_id": other_id,
            "project_id": "p-personal-2",
            "owner_type": "personal",
            "project_owner_id": str(uuid.uuid4()),
        },
    )
    assert resp.get_json()["allowed"] is False


def test_acl_check_company_owner_implicit_admin(client, app):
    token = _register_and_login(client, "owner@example.com")
    me_id = _user_id(app, token)
    company_id = _create_company(client, token, "Acme")

    resp = client.post(
        "/acl/projects/check",
        json={
            "user_id": me_id,
            "project_id": "p-company-1",
            "owner_type": "company",
            # Even though the owner_id is some other user, the company owner
            # has implicit admin on every project of the company.
            "project_owner_id": str(uuid.uuid4()),
            "company_id": company_id,
            "permission": "manage_members",
        },
    )
    body = resp.get_json()
    assert body["allowed"] is True
    assert body["reason"] == "company_owner"
    assert body["role"] == "admin"


def test_acl_check_no_membership_denied(client, app):
    token = _register_and_login(client, "stranger@example.com")
    me_id = _user_id(app, token)

    resp = client.post(
        "/acl/projects/check",
        json={
            "user_id": me_id,
            "project_id": "p-x",
            "owner_type": "company",
            "project_owner_id": str(uuid.uuid4()),
            "company_id": str(uuid.uuid4()),
        },
    )
    assert resp.get_json()["allowed"] is False


# ─────────────────────────────────────────────────────────────────────────────
# /projects/<id>/members  CRUD
# ─────────────────────────────────────────────────────────────────────────────


def test_list_members_initially_empty(client):
    token = _register_and_login(client, "lister@example.com")
    resp = client.get(
        "/projects/p-empty/members",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.get_json() == {"members": []}


def test_add_member_requires_admin(client, app):
    owner_token = _register_and_login(client, "addowner@example.com")
    company_id = _create_company(client, owner_token, "Co")

    invite = client.post(
        f"/companies/{company_id}/invite",
        json={"email": "team@example.com", "role": "data_scientist"},
        headers={"Authorization": f"Bearer {owner_token}"},
    ).get_json()
    teammate_token = _register_and_login(client, "team@example.com")
    client.get(
        f"/companies/invitations/accept/{invite['token']}",
        headers={"Authorization": f"Bearer {teammate_token}"},
    )
    teammate_id = _user_id(app, teammate_token)

    resp = client.post(
        "/projects/p-add-1/members",
        json={
            "user_id": teammate_id,
            "role": "viewer",
            "company_id": company_id,
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 201

    listing = client.get(
        "/projects/p-add-1/members",
        headers={"Authorization": f"Bearer {owner_token}"},
    ).get_json()
    assert len(listing["members"]) == 1
    assert listing["members"][0]["role"] == "viewer"


def test_non_admin_cannot_manage(client, app):
    owner_token = _register_and_login(client, "boss@example.com")
    company_id = _create_company(client, owner_token, "BossCo")

    rando_token = _register_and_login(client, "rando@example.com")
    rando_id = _user_id(app, rando_token)
    resp = client.post(
        "/projects/p-block/members",
        json={
            "user_id": rando_id,
            "role": "viewer",
            "company_id": company_id,
        },
        headers={"Authorization": f"Bearer {rando_token}"},
    )
    assert resp.status_code in (400, 403)

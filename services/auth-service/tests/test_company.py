def _register_and_login(client, email="owner@example.com", password="password123"):
    client.post("/auth/register", json={"email": email, "password": password})
    resp = client.post("/auth/login", json={"email": email, "password": password})
    return resp.get_json()["access_token"]


def test_create_company(client):
    token = _register_and_login(client)
    resp = client.post(
        "/companies",
        json={"name": "Acme Corp"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["name"] == "Acme Corp"
    assert "company_id" in data


def test_company_requires_auth(client):
    resp = client.post("/companies", json={"name": "Test"})
    assert resp.status_code == 401


def test_create_and_get_company(client):
    token = _register_and_login(client, "owner2@example.com")
    create_resp = client.post(
        "/companies",
        json={"name": "My Company"},
        headers={"Authorization": f"Bearer {token}"},
    )
    company_id = create_resp.get_json()["company_id"]

    get_resp = client.get(
        f"/companies/{company_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_resp.status_code == 200
    assert get_resp.get_json()["your_role"] == "owner"


def test_list_members(client):
    token = _register_and_login(client, "owner3@example.com")
    create_resp = client.post(
        "/companies",
        json={"name": "My Co"},
        headers={"Authorization": f"Bearer {token}"},
    )
    company_id = create_resp.get_json()["company_id"]

    resp = client.get(
        f"/companies/{company_id}/members",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    members = resp.get_json()
    assert len(members) == 1
    assert members[0]["role"] == "owner"


def test_non_member_forbidden(client):
    token_owner = _register_and_login(client, "owner4@example.com")
    create_resp = client.post(
        "/companies",
        json={"name": "Private Co"},
        headers={"Authorization": f"Bearer {token_owner}"},
    )
    company_id = create_resp.get_json()["company_id"]

    # Different user
    token_other = _register_and_login(client, "stranger@example.com")
    resp = client.get(
        f"/companies/{company_id}",
        headers={"Authorization": f"Bearer {token_other}"},
    )
    assert resp.status_code == 403

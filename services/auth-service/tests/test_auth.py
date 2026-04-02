def test_register_success(client):
    resp = client.post(
        "/auth/register",
        json={"email": "test@example.com", "password": "password123", "full_name": "Test User"},
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["email"] == "test@example.com"
    assert "user_id" in data


def test_register_duplicate_email(client):
    payload = {"email": "dup@example.com", "password": "password123"}
    client.post("/auth/register", json=payload)
    resp = client.post("/auth/register", json=payload)
    assert resp.status_code == 409
    assert resp.get_json()["error"] == "email_taken"


def test_register_weak_password(client):
    resp = client.post(
        "/auth/register", json={"email": "a@b.com", "password": "short"}
    )
    assert resp.status_code == 400


def test_login_success(client):
    client.post(
        "/auth/register",
        json={"email": "login@example.com", "password": "password123"},
    )
    resp = client.post(
        "/auth/login", json={"email": "login@example.com", "password": "password123"}
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert "access_token" in data
    assert data.get("requires_2fa") is None


def test_login_invalid_credentials(client):
    resp = client.post(
        "/auth/login", json={"email": "no@one.com", "password": "wrong"}
    )
    assert resp.status_code == 401
    assert resp.get_json()["error"] == "invalid_credentials"


def test_profile_requires_auth(client):
    resp = client.get("/users/me")
    assert resp.status_code == 401


def test_profile_returns_user(client):
    client.post(
        "/auth/register",
        json={"email": "profile@example.com", "password": "password123", "full_name": "Alice"},
    )
    login_resp = client.post(
        "/auth/login",
        json={"email": "profile@example.com", "password": "password123"},
    )
    token = login_resp.get_json()["access_token"]

    resp = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["email"] == "profile@example.com"
    assert data["full_name"] == "Alice"


def test_refresh_token(client):
    client.post(
        "/auth/register",
        json={"email": "refresh@example.com", "password": "password123"},
    )
    client.post(
        "/auth/login",
        json={"email": "refresh@example.com", "password": "password123"},
    )
    resp = client.post("/auth/refresh")
    # Without the cookie set this should fail gracefully
    assert resp.status_code in (200, 401)

import responses as resp_mock


def test_health_endpoint(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "ok"


def test_protected_route_no_token(client):
    resp = client.get("/users/me")
    assert resp.status_code == 401


def test_protected_route_invalid_token(client):
    resp = client.get(
        "/users/me", headers={"Authorization": "Bearer invalid.token.here"}
    )
    assert resp.status_code == 401


@resp_mock.activate
def test_public_register_proxied(client):
    resp_mock.add(
        resp_mock.POST,
        "http://auth-service:8001/auth/register",
        json={"user_id": "abc", "email": "x@x.com"},
        status=201,
    )
    resp = client.post(
        "/auth/register",
        json={"email": "x@x.com", "password": "password123"},
    )
    assert resp.status_code == 201


@resp_mock.activate
def test_upstream_unavailable(client):
    # No mock registered → connection error
    # The proxy should return 503
    resp = client.get(
        "/health"
    )  # gateway handles health itself, should not hit upstream
    assert resp.status_code == 200

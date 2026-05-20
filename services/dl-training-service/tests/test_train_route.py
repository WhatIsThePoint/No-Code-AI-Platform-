"""HTTP-level tests for the `/dl/train` blueprint.

Covers the four behaviours users actually depend on:

  * an unknown user gets `401 missing_user_id` (the gateway forwards
    `X-User-Id`; if it's missing the request must not pass)
  * payload validation is exhaustive — every required field, every closed
    enum (arch / optimizer / input_size), batch / epoch / lr ranges
  * the VRAM guard refuses obviously oversized requests *before* enqueuing
    (so a fat-finger demo press never reaches the GPU)
  * the happy path inserts model_versions + task_results docs and enqueues
    the Celery task, returning `{task_id, version_id}`

The Celery task is monkey-patched to a fake `apply_async` so tests don't
need a real broker, and Mongo is replaced with an in-memory fake that
honours just the calls the route actually makes.
"""

from __future__ import annotations

import importlib
from types import SimpleNamespace
from typing import Any

import pytest


class _FakeCollection:
    def __init__(self):
        self._docs: list[dict] = []

    def insert_one(self, doc: dict):
        self._docs.append(dict(doc))
        return SimpleNamespace(inserted_id=len(self._docs))

    def find_one(self, query: dict):
        for doc in self._docs:
            if all(doc.get(k) == v for k, v in query.items()):
                return dict(doc)
        return None


class _FakeMongo:
    def __init__(self):
        self.collections: dict[str, _FakeCollection] = {}

    def get_collection(self, name: str) -> _FakeCollection:
        return self.collections.setdefault(name, _FakeCollection())


@pytest.fixture
def fake_mongo(monkeypatch):
    """Replace the PyMongo extension's `get_collection` with the in-memory
    fake. Returns the fake so tests can pre-seed datasets / inspect inserts.
    """
    from app import extensions

    fake = _FakeMongo()
    monkeypatch.setattr(extensions.mongo, "get_collection", fake.get_collection)
    return fake


@pytest.fixture
def fake_celery(monkeypatch):
    """Stub `train_image.run.apply_async` so tests don't talk to Redis."""
    from app.tasks import train_image

    captured: dict[str, Any] = {}

    def _apply_async(*, kwargs, queue):
        captured["kwargs"] = dict(kwargs)
        captured["queue"] = queue
        return SimpleNamespace(id="task-test-1")

    monkeypatch.setattr(train_image.run, "apply_async", _apply_async)
    return captured


@pytest.fixture
def client(fake_mongo, fake_celery):
    """Boot the Flask app, yield a test client. Importing `app.main` is
    deferred so monkeypatches to extensions land before app creation."""
    main = importlib.import_module("app.main")
    app = main.create_app()
    app.testing = True
    return app.test_client()


def _seed_image_dataset(fake_mongo: _FakeMongo, dataset_id: str = "ds-img-1"):
    fake_mongo.get_collection("datasets").insert_one(
        {
            "dataset_id": dataset_id,
            "source_type": "image",
            "status": "ready",
        }
    )


_VALID_BODY = {
    "pipeline_id": "pl-1",
    "dataset_id": "ds-img-1",
    "arch": "lenet",
    "input_size": 28,
    "epochs": 3,
    "batch_size": 16,
    "lr": 0.001,
    "optimizer": "adam",
    "pretrained": False,
    "augment": False,
}


def _post(client, body, *, user_id: str | None = "u-1"):
    headers = {"X-User-Id": user_id} if user_id else {}
    return client.post("/dl/train", json=body, headers=headers)


def test_missing_user_id_is_401(client):
    res = _post(client, _VALID_BODY, user_id=None)
    assert res.status_code == 401


@pytest.mark.parametrize(
    "field",
    ["pipeline_id", "dataset_id", "arch", "input_size", "epochs", "batch_size", "lr", "optimizer"],
)
def test_required_fields_are_enforced(client, field):
    body = dict(_VALID_BODY)
    body.pop(field)
    res = _post(client, body)
    assert res.status_code == 400
    assert res.get_json()["error"] == "validation_error"
    assert field in res.get_json()["detail"]


@pytest.mark.parametrize(
    "patch",
    [
        {"arch": "resnet50_xxl"},
        {"optimizer": "adagrad"},
        {"input_size": 200},
        {"epochs": 0},
        {"epochs": 999},
        {"batch_size": 0},
        {"batch_size": 9999},
        {"lr": 0},
        {"lr": 5.0},
        {"lr": "fast"},
    ],
)
def test_validation_rejects_out_of_range_values(client, patch):
    body = {**_VALID_BODY, **patch}
    res = _post(client, body)
    assert res.status_code == 400


def test_dataset_not_found(client, fake_mongo):
    # No dataset seeded — should 404 before vram_guard runs.
    res = _post(client, _VALID_BODY)
    assert res.status_code == 404
    assert res.get_json()["error"] == "dataset_not_found"


def test_dataset_wrong_source_type(client, fake_mongo):
    fake_mongo.get_collection("datasets").insert_one(
        {"dataset_id": "ds-img-1", "source_type": "csv", "status": "ready"}
    )
    res = _post(client, _VALID_BODY)
    assert res.status_code == 400
    assert res.get_json()["error"] == "wrong_source_type"


def test_dataset_not_ready(client, fake_mongo):
    fake_mongo.get_collection("datasets").insert_one(
        {"dataset_id": "ds-img-1", "source_type": "image", "status": "extracting"}
    )
    res = _post(client, _VALID_BODY)
    assert res.status_code == 409
    assert res.get_json()["error"] == "dataset_not_ready"


def test_vram_budget_exceeded(client, fake_mongo):
    """A request that would peak above the per-tier VRAM budget must be
    rejected with a structured estimate. We force a tiny budget via the
    `X-Max-Vram-MB` header rather than crafting a request that genuinely
    OOMs the catalog — keeps the test independent of activation tuning."""
    _seed_image_dataset(fake_mongo)
    headers = {"X-User-Id": "u-1", "X-Max-Vram-MB": "1024"}
    res = client.post(
        "/dl/train",
        json={**_VALID_BODY, "arch": "mobilenet_v3_small", "input_size": 224, "batch_size": 64},
        headers=headers,
    )
    assert res.status_code == 400
    body = res.get_json()
    assert body["error"] == "vram_budget_exceeded"
    assert body["estimate"]["total_mb"] > body["budget_mb"]


def test_happy_path_enqueues_and_returns_ids(client, fake_mongo, fake_celery):
    _seed_image_dataset(fake_mongo)
    res = _post(client, _VALID_BODY)
    assert res.status_code == 202, res.get_json()
    body = res.get_json()
    assert body["task_id"] == "task-test-1"
    assert body["version_id"]
    # task_results + model_versions docs were inserted.
    assert fake_mongo.get_collection("model_versions")._docs
    assert fake_mongo.get_collection("task_results")._docs
    # Celery was called on the dl_training queue.
    assert fake_celery["queue"] == "dl_training"
    assert fake_celery["kwargs"]["pipeline_id"] == "pl-1"
    assert fake_celery["kwargs"]["dataset_id"] == "ds-img-1"
    assert fake_celery["kwargs"]["hparams"]["arch"] == "lenet"


def test_status_route_404_when_unknown(client, fake_mongo):
    res = client.get("/dl/train/nope", headers={"X-User-Id": "u-1"})
    assert res.status_code == 404


def test_free_tier_rejects_high_epochs(client, fake_mongo):
    """A free-tier user (max_dl_epochs=5) must be refused on 10 epochs even
    though that fits the service-wide HARD_MAX. The route reads the tier
    from `X-User-Tier` and clamps before VRAM evaluation."""
    _seed_image_dataset(fake_mongo)
    headers = {"X-User-Id": "u-1", "X-User-Tier": "free"}
    res = client.post(
        "/dl/train",
        json={**_VALID_BODY, "epochs": 10},
        headers=headers,
    )
    assert res.status_code == 400
    body = res.get_json()
    assert body["error"] == "epochs_over_tier_limit"
    assert body["max_dl_epochs"] == 5


def test_free_tier_rejects_large_batch(client, fake_mongo):
    _seed_image_dataset(fake_mongo)
    headers = {"X-User-Id": "u-1", "X-User-Tier": "free"}
    res = client.post(
        "/dl/train",
        json={**_VALID_BODY, "batch_size": 64},
        headers=headers,
    )
    assert res.status_code == 400
    body = res.get_json()
    assert body["error"] == "batch_size_over_tier_limit"
    assert body["max_dl_batch_size"] == 32


def test_solo_tier_allows_bigger_runs(client, fake_mongo, fake_celery):
    """Solo tier gets max_dl_epochs=20 / batch=64 — the service-wide caps —
    so a payload at the hard ceiling should succeed."""
    _seed_image_dataset(fake_mongo)
    headers = {"X-User-Id": "u-1", "X-User-Tier": "solo"}
    res = client.post(
        "/dl/train",
        json={**_VALID_BODY, "epochs": 20, "batch_size": 64},
        headers=headers,
    )
    assert res.status_code == 202, res.get_json()


def test_explicit_header_overrides_tier_default(client, fake_mongo, fake_celery):
    """An admin proxy can lift the per-tier cap by stamping `X-Max-DL-Epochs`
    directly on the proxied request; that header wins over the tier table."""
    _seed_image_dataset(fake_mongo)
    headers = {"X-User-Id": "u-1", "X-User-Tier": "free", "X-Max-DL-Epochs": "15"}
    res = client.post(
        "/dl/train",
        json={**_VALID_BODY, "epochs": 10},
        headers=headers,
    )
    assert res.status_code == 202, res.get_json()


def test_status_route_returns_doc(client, fake_mongo):
    fake_mongo.get_collection("task_results").insert_one(
        {
            "task_id": "task-1",
            "status": "running",
            "progress_pct": 42,
            "stage": "epoch_2_of_5",
            "live_metrics": [{"epoch": 1, "val_acc": 0.4}],
        }
    )
    res = client.get("/dl/train/task-1", headers={"X-User-Id": "u-1"})
    assert res.status_code == 200
    body = res.get_json()
    assert body["task_id"] == "task-1"
    assert body["progress_pct"] == 42
    assert body["live_metrics"][0]["epoch"] == 1

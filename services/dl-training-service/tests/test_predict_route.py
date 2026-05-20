"""Tests for POST /dl/predict/<version_id>.

We don't exercise a real torch.load round-trip in CI by default — the
frozen weights would balloon the test fixture size and slow down every
run. Instead we cover the route's contract surface:

  * 401 without X-User-Id
  * 400 without a multipart `file`
  * 404 / 409 / 410 when the version row or sidecar files are wrong
  * 500 with a stable error code when meta.json is corrupt
  * happy path: build → save → predict against a tiny LeNet on a
    procedurally generated PNG, asserting the response shape and that
    `class` is one of the trained class labels

The end-to-end success case is gated on torch being importable (always
true in the dl-training image; CI installs the CPU wheels).
"""

from __future__ import annotations

import importlib
import io
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from PIL import Image


class _FakeCollection:
    def __init__(self):
        self._docs: list[dict] = []

    def insert_one(self, doc):
        self._docs.append(dict(doc))
        return SimpleNamespace(inserted_id=len(self._docs))

    def find_one(self, query):
        for doc in self._docs:
            if all(doc.get(k) == v for k, v in query.items()):
                return dict(doc)
        return None


class _FakeMongo:
    def __init__(self):
        self.collections: dict[str, _FakeCollection] = {}

    def get_collection(self, name):
        return self.collections.setdefault(name, _FakeCollection())


@pytest.fixture
def fake_mongo(monkeypatch):
    from app import extensions

    fake = _FakeMongo()
    monkeypatch.setattr(extensions.mongo, "get_collection", fake.get_collection)
    return fake


@pytest.fixture
def client(fake_mongo, tmp_path, monkeypatch):
    monkeypatch.setenv("MODEL_FOLDER", str(tmp_path / "models"))
    main = importlib.import_module("app.main")
    app = main.create_app()
    app.testing = True
    return app.test_client()


def _png_bytes(size=(64, 64), color=(0, 200, 0)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color=color).save(buf, format="PNG")
    return buf.getvalue()


def _post(
    client,
    version_id: str,
    *,
    file_bytes: bytes | None = b"x",
    filename: str = "x.png",
    user: str | None = "u-1",
):
    headers = {"X-User-Id": user} if user else {}
    data: dict[str, Any] = {}
    if file_bytes is not None:
        data["file"] = (io.BytesIO(file_bytes), filename, "image/png")
    return client.post(
        f"/dl/predict/{version_id}",
        data=data,
        content_type="multipart/form-data",
        headers=headers,
    )


# ── Contract tests ─────────────────────────────────────────────────────────


def test_missing_user_id_is_401(client):
    res = _post(client, "v-1", user=None)
    assert res.status_code == 401


def test_missing_file_is_400(client, fake_mongo):
    fake_mongo.get_collection("model_versions").insert_one(
        {"version_id": "v-1", "framework": "pytorch", "status": "ready"}
    )
    res = _post(client, "v-1", file_bytes=None)
    assert res.status_code == 400
    assert res.get_json()["error"] == "validation_error"


def test_version_not_found(client):
    res = _post(client, "v-missing")
    assert res.status_code == 404


def test_version_not_ready(client, fake_mongo):
    fake_mongo.get_collection("model_versions").insert_one(
        {"version_id": "v-1", "framework": "pytorch", "status": "training"}
    )
    res = _post(client, "v-1")
    assert res.status_code == 409
    assert res.get_json()["error"] == "version_not_ready"


def test_wrong_framework(client, fake_mongo):
    fake_mongo.get_collection("model_versions").insert_one(
        {"version_id": "v-1", "framework": "h2o", "status": "ready"}
    )
    res = _post(client, "v-1")
    assert res.status_code == 400
    assert res.get_json()["error"] == "wrong_framework"


def test_artefacts_missing_when_files_absent(client, fake_mongo):
    fake_mongo.get_collection("model_versions").insert_one(
        {"version_id": "v-1", "framework": "pytorch", "status": "ready"}
    )
    res = _post(client, "v-1")
    assert res.status_code == 410
    assert res.get_json()["error"] == "artefacts_missing"


def test_corrupt_meta(client, fake_mongo, tmp_path):
    fake_mongo.get_collection("model_versions").insert_one(
        {"version_id": "v-1", "framework": "pytorch", "status": "ready"}
    )
    model_folder = client.application.config["MODEL_FOLDER"]
    Path(model_folder, "v-1").mkdir(parents=True, exist_ok=True)
    # No `arch` — route should fail with a stable code rather than crashing.
    Path(model_folder, "v-1", "training_meta.json").write_text("{}", encoding="utf-8")
    Path(model_folder, "v-1", "class_index.json").write_text("{}", encoding="utf-8")
    res = _post(client, "v-1")
    assert res.status_code == 500
    assert res.get_json()["error"] == "corrupt_meta"


# ── Happy path (requires torch in the test environment) ────────────────────


def test_happy_path_returns_top_k(client, fake_mongo):
    pytest.importorskip("torch")
    pytest.importorskip("torchvision")

    from app.archs import build as build_arch
    from app.services import model_storage

    model_folder = client.application.config["MODEL_FOLDER"]
    fake_mongo.get_collection("model_versions").insert_one(
        {"version_id": "v-happy", "framework": "pytorch", "status": "ready"}
    )

    model = build_arch(arch="lenet", num_classes=3, input_size=32, pretrained=False)
    model_storage.save(
        model_folder=model_folder,
        version_id="v-happy",
        state_dict=model.state_dict(),
        class_index={0: "alpha", 1: "beta", 2: "gamma"},
        meta={
            "arch": "lenet",
            "input_size": 32,
            "pretrained": False,
            "epochs": 1,
        },
    )

    res = _post(client, "v-happy", file_bytes=_png_bytes((40, 40)))
    assert res.status_code == 200, res.get_json()
    body = res.get_json()
    assert body["arch"] == "lenet"
    assert body["input_size"] == 32
    assert body["version_id"] == "v-happy"
    # Top-K trims to num_classes when smaller than _TOP_K.
    assert len(body["probs"]) == 3
    assert {p["class"] for p in body["probs"]} == {"alpha", "beta", "gamma"}
    # Probabilities sum to ~1 (softmax).
    s = sum(p["probability"] for p in body["probs"])
    assert 0.999 <= s <= 1.001
    # `class` is the argmax of `probs`.
    assert body["class"] == max(body["probs"], key=lambda p: p["probability"])["class"]

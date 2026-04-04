import io
from unittest.mock import MagicMock, patch

from tests.conftest import USER_HEADERS


def make_csv_file(content: str = "a,b,c\n1,2,3\n4,5,6\n"):
    return (io.BytesIO(content.encode()), "test.csv", "text/csv")


def test_upload_missing_auth(client):
    data = {"file": make_csv_file()}
    resp = client.post("/upload", data=data, content_type="multipart/form-data")
    assert resp.status_code == 401


def test_upload_no_file(client):
    resp = client.post("/upload", headers=USER_HEADERS)
    assert resp.status_code == 400


def test_upload_wrong_extension(client):
    data = {"file": (io.BytesIO(b"data"), "bad.pdf", "application/pdf")}
    resp = client.post(
        "/upload", data=data, content_type="multipart/form-data", headers=USER_HEADERS
    )
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "unsupported_file_type"


@patch("app.routes.upload.profile_dataset")
@patch("app.routes.upload.mongo")
def test_upload_csv_success(mock_mongo, mock_task, client):
    mock_mongo.get_collection.return_value = MagicMock()
    mock_task.apply_async.return_value = MagicMock(id="task-abc")

    data = {"file": make_csv_file()}
    resp = client.post(
        "/upload",
        data=data,
        content_type="multipart/form-data",
        headers=USER_HEADERS,
    )
    assert resp.status_code == 202
    body = resp.get_json()
    assert "dataset_id" in body
    assert "task_id" in body


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200

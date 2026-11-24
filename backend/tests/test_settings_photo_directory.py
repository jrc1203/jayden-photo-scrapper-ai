"""Source directory settings API contract tests."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app import main as app_main
from app.core.config import settings

TEST_API_KEY = "settings-directory-contract-key"


def test_update_photo_directory_validates_and_persists(
    tmp_path: Path, monkeypatch
) -> None:
    photo_dir = tmp_path / "library"
    photo_dir.mkdir()
    data_dir = tmp_path / "data"
    monkeypatch.setattr(app_main.settings, "API_KEY", TEST_API_KEY)
    monkeypatch.setattr(settings, "DATA_DIR", data_dir)
    monkeypatch.setattr(settings, "PHOTOS_SOURCE_PATH", settings.PHOTOS_SOURCE_PATH)

    with TestClient(app_main.app) as client:
        response = client.put(
            "/api/v1/settings/",
            json={"photo_directory": str(photo_dir)},
            headers={"X-API-Key": TEST_API_KEY},
        )

    assert response.status_code == 200
    assert Path(settings.PHOTOS_SOURCE_PATH) == photo_dir
    persisted = json.loads((data_dir / "app-settings.json").read_text(encoding="utf-8"))
    assert persisted["photo_directory"] == str(photo_dir)


def test_update_photo_directory_rejects_missing_directory(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(app_main.settings, "API_KEY", TEST_API_KEY)
    with TestClient(app_main.app) as client:
        response = client.put(
            "/api/v1/settings/",
            json={"photo_directory": str(tmp_path / "missing")},
            headers={"X-API-Key": TEST_API_KEY},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Photo directory does not exist or is not a directory"

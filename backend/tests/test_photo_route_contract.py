"""Regression checks for the gallery's photo scan and face-processing routes.

TestClient is intentionally used without a context manager so the app lifespan
does not run. Service calls and the database dependency are replaced with small
synthetic doubles; these tests never scan photos or connect to a database.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app import main as app_main
from app.core.database import get_db
from app.services.face_recognition import FaceRecognitionService
from app.services.photo_scanner import PhotoScanner


TEST_API_KEY = "route-contract-test-key"
LOCAL_ORIGIN = "http://localhost:8000"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """Create a request client without entering it or starting app lifespan."""
    monkeypatch.setattr(app_main.settings, "API_KEY", TEST_API_KEY)

    def override_get_db() -> Iterator[object]:
        # Endpoint services are monkeypatched, so the yielded object is never used.
        yield object()

    overrides = app_main.app.dependency_overrides
    previous_override = overrides.get(get_db)
    had_previous_override = get_db in overrides
    overrides[get_db] = override_get_db

    async def as_loopback_peer(scope, receive, send):
        # Starlette's TestClient hard-codes its peer as "testclient"; replace
        # only that synthetic address to model a browser connected locally.
        if scope["type"] == "http":
            scope = {**scope, "client": ("127.0.0.1", 43210)}
        await app_main.app(scope, receive, send)

    # Deliberately do not use `with TestClient(...)`: that would run lifespan.
    test_client = TestClient(as_loopback_peer)
    try:
        yield test_client
    finally:
        if had_previous_override:
            overrides[get_db] = previous_override
        else:
            overrides.pop(get_db, None)


def test_scan_route_accepts_the_frontend_post_contract(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    expected_stats = {
        "total_files": 3,
        "new_photos": 2,
        "updated_photos": 0,
        "skipped_photos": 1,
        "errors": 0,
    }
    calls: list[bool] = []

    def fake_scan(self: PhotoScanner, force_rescan: bool = False) -> dict[str, int]:
        calls.append(force_rescan)
        return expected_stats

    monkeypatch.setattr(PhotoScanner, "scan", fake_scan)

    response = client.post(
        "/api/v1/photos/scan?force=false",
        headers={"Origin": LOCAL_ORIGIN},
    )

    assert response.status_code == 200
    assert response.json() == expected_stats
    assert calls == [False]


def test_process_all_faces_route_accepts_the_frontend_post_contract(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    expected_stats = {
        "processed": 2,
        "faces_found": 3,
        "new_persons": 1,
        "matched_persons": 2,
        "errors": 0,
    }
    calls: list[int] = []

    def fake_process_all(
        self: FaceRecognitionService, batch_size: int = 50
    ) -> dict[str, int]:
        calls.append(batch_size)
        return expected_stats

    monkeypatch.setattr(
        FaceRecognitionService, "process_all_unprocessed", fake_process_all
    )

    response = client.post(
        "/api/v1/photos/process-all-faces?batch_size=50",
        headers={"Origin": LOCAL_ORIGIN},
    )

    assert response.status_code == 200
    assert response.json() == expected_stats
    assert calls == [50]

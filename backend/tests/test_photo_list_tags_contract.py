"""Regression test for photo-list serialization of tag relationships."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as app_main
from app.core.database import Base, get_db
from app.models.photo import Photo
from app.models.tag import Tag


TEST_API_KEY = "photo-list-test-key"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    test_session = sessionmaker(bind=engine, expire_on_commit=False)
    with test_session() as db:
        photo = Photo(file_path="fixture.jpg", file_name="fixture.jpg", file_hash="fixture-hash")
        tag = Tag(name="fixture-tag", display_name="Fixture tag")
        photo.tags.append(tag)
        db.add(photo)
        db.commit()

    def override_get_db() -> Iterator[Session]:
        with test_session() as db:
            yield db

    monkeypatch.setattr(app_main.settings, "API_KEY", TEST_API_KEY)
    previous_override = app_main.app.dependency_overrides.get(get_db)
    had_previous_override = get_db in app_main.app.dependency_overrides
    app_main.app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app_main.app)
    finally:
        if had_previous_override:
            app_main.app.dependency_overrides[get_db] = previous_override
        else:
            app_main.app.dependency_overrides.pop(get_db, None)
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_list_photos_serializes_tag_names(client: TestClient) -> None:
    response = client.get("/api/v1/photos/", headers={"X-API-Key": TEST_API_KEY})

    assert response.status_code == 200
    payload = response.json()
    assert payload["photos"][0]["tags"] == [{"id": 1, "name": "fixture-tag"}]

    detail = client.get("/api/v1/photos/1", headers={"X-API-Key": TEST_API_KEY})
    assert detail.status_code == 200
    assert detail.json()["tags"] == [{
        "id": 1,
        "name": "fixture-tag",
        "display_name": "Fixture tag",
        "color": None,
    }]


def test_tag_create_and_edit_accept_json_payloads(client: TestClient) -> None:
    created = client.post(
        "/api/v1/tags/",
        json={"name": "new-tag", "display_name": "New tag", "color": "#123456"},
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert created.status_code == 200
    assert created.json()["name"] == "new-tag"

    updated = client.put(
        f"/api/v1/tags/{created.json()['id']}",
        json={"name": "renamed-tag", "description": "saved by UI"},
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "renamed-tag"

    read_back = client.get(
        f"/api/v1/tags/{created.json()['id']}",
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert read_back.status_code == 200
    assert read_back.json()["description"] == "saved by UI"

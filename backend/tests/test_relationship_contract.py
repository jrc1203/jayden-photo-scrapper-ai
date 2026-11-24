"""Regression coverage for the JSON relationship API used by the UI."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as app_main
from app.core.database import Base, get_db
from app.models.person import Person

TEST_API_KEY = "relationship-contract-test-key"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[tuple[TestClient, int, int]]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        people = [Person(name="Relationship A", is_manual=True), Person(name="Relationship B", is_manual=True)]
        db.add_all(people)
        db.commit()
        ids = (people[0].id, people[1].id)

    def override_get_db() -> Iterator[Session]:
        with factory() as db:
            yield db

    monkeypatch.setattr(app_main.settings, "API_KEY", TEST_API_KEY)
    previous = app_main.app.dependency_overrides.get(get_db)
    had_previous = get_db in app_main.app.dependency_overrides
    app_main.app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app_main.app), ids[0], ids[1]
    finally:
        if had_previous:
            app_main.app.dependency_overrides[get_db] = previous
        else:
            app_main.app.dependency_overrides.pop(get_db, None)
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_create_relationship_accepts_json_and_returns_ui_fields(client) -> None:
    test_client, person_id, related_person_id = client
    response = test_client.post(
        "/api/v1/relationships/",
        json={
            "person_id": person_id,
            "related_person_id": related_person_id,
            "relationship_type": "friend",
            "is_verified": False,
            "is_current": True,
        },
        headers={"X-API-Key": TEST_API_KEY},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["person_id"] == person_id
    assert payload["related_person_id"] == related_person_id
    assert payload["type"] == "friend"
    assert payload["is_verified"] is False
    assert payload["person_name"] == "Relationship A"
    assert payload["related_person_name"] == "Relationship B"


def test_update_relationship_accepts_json_partial_update(client) -> None:
    test_client, person_id, related_person_id = client
    created = test_client.post(
        "/api/v1/relationships/",
        json={"person_id": person_id, "related_person_id": related_person_id, "relationship_type": "friend"},
        headers={"X-API-Key": TEST_API_KEY},
    )
    relationship_id = created.json().get("id")

    response = test_client.put(
        f"/api/v1/relationships/{relationship_id}",
        json={"is_verified": True, "description": "Manually confirmed"},
        headers={"X-API-Key": TEST_API_KEY},
    )

    assert response.status_code == 200
    assert response.json()["is_verified"] is True
    assert response.json()["description"] == "Manually confirmed"

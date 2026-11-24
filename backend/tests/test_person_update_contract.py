"""Regression test for the frontend's JSON person-update contract."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as app_main
from app.core.database import Base, get_db
from app.models.person import Person


TEST_API_KEY = "person-contract-test-key"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[tuple[TestClient, int]]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    test_session = sessionmaker(bind=engine, expire_on_commit=False)
    with test_session() as db:
        person = Person(name="Old Name", display_name="Old Display", is_manual=True)
        db.add(person)
        db.commit()
        db.refresh(person)
        person_id = person.id

    def override_get_db() -> Iterator[Session]:
        with test_session() as db:
            yield db

    monkeypatch.setattr(app_main.settings, "API_KEY", TEST_API_KEY)
    previous_override = app_main.app.dependency_overrides.get(get_db)
    had_previous_override = get_db in app_main.app.dependency_overrides
    app_main.app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app_main.app), person_id
    finally:
        if had_previous_override:
            app_main.app.dependency_overrides[get_db] = previous_override
        else:
            app_main.app.dependency_overrides.pop(get_db, None)
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_json_update_changes_person_fields_and_persists(client: tuple[TestClient, int]) -> None:
    test_client, person_id = client
    response = test_client.put(
        f"/api/v1/persons/{person_id}",
        json={"name": "Updated Name", "display_name": "Updated Display", "notes": "reviewed"},
        headers={"X-API-Key": TEST_API_KEY},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Updated Name"
    assert response.json()["display_name"] == "Updated Display"

    persisted = test_client.get(
        f"/api/v1/persons/{person_id}",
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert persisted.status_code == 200
    assert persisted.json()["notes"] == "reviewed"


def test_json_create_person_contract(client: tuple[TestClient, int]) -> None:
    test_client, _ = client
    response = test_client.post(
        "/api/v1/persons/",
        json={"name": "New Person", "display_name": "New Display", "notes": "from UI"},
        headers={"X-API-Key": TEST_API_KEY},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "New Person"
    created = test_client.get(
        f"/api/v1/persons/{response.json()['id']}",
        headers={"X-API-Key": TEST_API_KEY},
    )
    assert created.status_code == 200
    assert created.json()["notes"] == "from UI"

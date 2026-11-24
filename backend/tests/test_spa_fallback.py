"""Regression tests for serving React Router routes from the local app."""

from fastapi.testclient import TestClient

from app.main import app


def test_client_side_routes_serve_the_frontend_entrypoint() -> None:
    client = TestClient(app)

    for path in ("/gallery", "/mindmap", "/persons", "/person/1", "/tags", "/settings"):
        response = client.get(path)
        assert response.status_code == 200, path
        assert "text/html" in response.headers["content-type"], path
        assert 'id="root"' in response.text, path


def test_missing_static_asset_remains_a_404() -> None:
    client = TestClient(app)

    response = client.get("/assets/this-file-does-not-exist.js")

    assert response.status_code == 404

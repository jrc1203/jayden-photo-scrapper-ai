"""Unit checks for the API-key and loopback access policy.

These call the dependency directly with ASGI Request objects. They do not start
the app lifespan, connect to the database, or call photo-processing endpoints.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app import main as app_main


TEST_API_KEY = "auth-policy-test-key"
ALLOWED_LOCAL_ORIGINS = (
    "http://localhost:8000",
    "http://127.0.0.1:8000",
)


def make_request(
    peer: str | None,
    *,
    method: str = "GET",
    origin: str | None = None,
    forwarded_for: str | None = None,
    server_port: int = 8000,
) -> Request:
    """Create a small ASGI request scope without opening a socket."""
    headers: list[tuple[bytes, bytes]] = []
    if origin is not None:
        headers.append((b"origin", origin.encode("ascii")))
    if forwarded_for is not None:
        headers.append((b"x-forwarded-for", forwarded_for.encode("ascii")))

    client = (peer, 43210) if peer is not None else None
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": "/api/v1/photos",
        "raw_path": b"/api/v1/photos",
        "query_string": b"",
        "headers": headers,
        "client": client,
        "server": ("127.0.0.1", server_port),
    }
    return Request(scope)


@pytest.fixture(autouse=True)
def test_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    # Use a synthetic key; never read or print the user's configured secret.
    monkeypatch.setattr(app_main.settings, "API_KEY", TEST_API_KEY)


async def authorize(
    peer: str | None,
    *,
    method: str = "GET",
    origin: str | None = None,
    api_key: str | None = None,
    forwarded_for: str | None = None,
    server_port: int = 8000,
) -> str | None:
    request = make_request(
        peer,
        method=method,
        origin=origin,
        forwarded_for=forwarded_for,
        server_port=server_port,
    )
    return await app_main.verify_api_key(request=request, x_api_key=api_key)


@pytest.mark.asyncio
async def test_valid_api_key_is_accepted_from_any_peer() -> None:
    assert await authorize("203.0.113.25", api_key=TEST_API_KEY) == TEST_API_KEY


@pytest.mark.parametrize("peer", ["127.0.0.1", "::1"])
@pytest.mark.asyncio
async def test_loopback_safe_get_without_origin_is_allowed(peer: str) -> None:
    assert await authorize(peer) is None


@pytest.mark.asyncio
async def test_loopback_state_change_accepts_same_origin_on_nondefault_port() -> None:
    assert await authorize(
        "127.0.0.1",
        method="POST",
        origin="http://127.0.0.1:8766",
        server_port=8766,
    ) is None


@pytest.mark.asyncio
async def test_loopback_state_change_rejects_origin_for_different_port() -> None:
    with pytest.raises(HTTPException) as error:
        await authorize(
            "127.0.0.1",
            method="POST",
            origin="http://127.0.0.1:8766",
            server_port=8765,
        )
    assert error.value.status_code == 403


@pytest.mark.parametrize("peer", ["127.0.0.1", "::1"])
@pytest.mark.parametrize("origin", ALLOWED_LOCAL_ORIGINS)
@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
@pytest.mark.asyncio
async def test_loopback_state_change_requires_an_allowed_origin(
    peer: str, origin: str, method: str
) -> None:
    assert await authorize(peer, method=method, origin=origin) is None


@pytest.mark.parametrize("peer", ["127.0.0.1", "::1"])
@pytest.mark.parametrize("origin", [None, "null", "https://attacker.example"])
@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
@pytest.mark.asyncio
async def test_loopback_state_change_rejects_missing_or_untrusted_origin(
    peer: str, origin: str | None, method: str
) -> None:
    with pytest.raises(HTTPException) as error:
        await authorize(peer, method=method, origin=origin)
    assert error.value.status_code in {401, 403}


@pytest.mark.parametrize(
    "peer",
    ["203.0.113.25", "127.0.0.2", "::ffff:127.0.0.1", "not-an-ip", None],
)
@pytest.mark.asyncio
async def test_non_exact_or_missing_peer_cannot_use_forwarded_loopback_claim(
    peer: str | None,
) -> None:
    with pytest.raises(HTTPException) as error:
        await authorize(peer, forwarded_for="127.0.0.1")
    assert error.value.status_code in {401, 403}


@pytest.mark.parametrize("peer", ["127.0.0.1", "::1", "203.0.113.25"])
@pytest.mark.asyncio
async def test_wrong_key_is_rejected_even_when_peer_is_loopback(peer: str) -> None:
    with pytest.raises(HTTPException) as error:
        await authorize(
            peer,
            method="POST",
            origin="http://localhost:8000",
            api_key="wrong-test-key",
        )
    assert error.value.status_code == 401


@pytest.mark.asyncio
async def test_empty_configured_api_key_fails_closed_for_remote_peer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(app_main.settings, "API_KEY", "")

    with pytest.raises(HTTPException) as error:
        await authorize("203.0.113.25", api_key="")

    assert error.value.status_code in {500, 503}

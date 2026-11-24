"""Read-only launch checks for the local API and built frontend.

This script must never call photo scan, face-processing, or database mutation
endpoints. It performs only health/root requests and a one-row gallery read.
"""
from __future__ import annotations

import argparse
import json
import sys
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


def fetch(base_url: str, path: str) -> tuple[int, str, bytes]:
    try:
        with urlopen(f"{base_url.rstrip('/')}{path}", timeout=8) as response:
            return response.status, response.headers.get("Content-Type", ""), response.read()
    except HTTPError as error:
        return error.code, error.headers.get("Content-Type", ""), error.read()
    except URLError as error:
        raise RuntimeError(f"Could not connect to {base_url}: {error.reason}") from error


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    args = parser.parse_args()

    try:
        status, content_type, payload = fetch(args.base_url, "/health")
        health = json.loads(payload)
        if status != 200 or health.get("status") != "healthy":
            raise RuntimeError(f"health check returned HTTP {status}: {health}")
        print("PASS backend health")

        status, content_type, payload = fetch(args.base_url, "/")
        if status != 200 or "text/html" not in content_type or b"id=\"root\"" not in payload:
            raise RuntimeError("app root did not serve the built React page")
        print("PASS built frontend")

        status, content_type, payload = fetch(
            args.base_url,
            "/api/v1/photos/?page=1&per_page=1",
        )
        if status != 200 or "application/json" not in content_type:
            raise RuntimeError(f"gallery API returned HTTP {status}: {payload[:300]!r}")
        gallery = json.loads(payload)
        if not isinstance(gallery.get("photos"), list) or gallery.get("page") != 1:
            raise RuntimeError("gallery API response has an unexpected shape")
        print("PASS read-only gallery API (at most one photo row)")
    except (RuntimeError, json.JSONDecodeError) as error:
        print(f"FAIL startup check: {error}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

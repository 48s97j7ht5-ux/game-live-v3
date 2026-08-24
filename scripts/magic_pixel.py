#!/usr/bin/env python3
"""Minimal Magic Pixel API client (base URL from env; extend when docs are known)."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request


def _env(name: str, required: bool = True) -> str:
    val = os.environ.get(name, "").strip()
    if required and not val:
        print(f"Missing environment variable: {name}", file=sys.stderr)
        sys.exit(2)
    return val


def api_request(method: str, path: str, body: dict | None = None) -> tuple[int, str]:
    base = _env("MAGIC_PIXEL_API_BASE").rstrip("/")
    key = _env("MAGIC_PIXEL_API_KEY")
    url = f"{base}{path}"
    data = None
    headers = {
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "User-Agent": "game-live-v3/1",
    }
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        payload = e.read().decode("utf-8", errors="replace")
        return e.code, payload


def cmd_ping(_: argparse.Namespace) -> None:
    """Call GET /v1/me or /health — adjust path when docs are known."""
    for path in ("/v1/me", "/api/v1/me", "/health"):
        status, text = api_request("GET", path)
        print(f"{path} -> HTTP {status}")
        print(text[:2000])
        if status < 400:
            return
    sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Magic Pixel API helper")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("ping", help="Test API key and base URL").set_defaults(func=cmd_ping)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

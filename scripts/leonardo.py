#!/usr/bin/env python3
"""Leonardo.ai REST API client. Confirmed reachable from this session
(cloud.leonardo.ai -> HTTP 401 without a key, i.e. real endpoint, not a
network block) -- see docs/character-factory.md for the egress history.

Auth: LEONARDO_API_KEY env var (get it from the Leonardo dashboard's API
Access section -- separate from the regular app subscription/credits on
many plans, check there first). Never paste the key into chat; put it in
.env (see .env.example) or the environment's secret store.

Generation is async on Leonardo's side: POST /generations starts a job,
GET /generations/{id} is polled until status == COMPLETE, then each
generated image has its own downloadable URL.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API_BASE = "https://cloud.leonardo.ai/api/rest/v1"


def _env(name: str, required: bool = True) -> str:
    val = os.environ.get(name, "").strip()
    if required and not val:
        print(f"Missing environment variable: {name}", file=sys.stderr)
        sys.exit(2)
    return val


def api_request(method: str, path: str, body: dict | None = None) -> tuple[int, dict]:
    key = _env("LEONARDO_API_KEY")
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "game-live-v3/1",
    }
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        payload = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(payload)
        except json.JSONDecodeError:
            return e.code, {"raw": payload}


def cmd_ping(_: argparse.Namespace) -> None:
    status, data = api_request("GET", "/me")
    print(f"GET /me -> HTTP {status}")
    print(json.dumps(data, indent=2)[:2000])
    sys.exit(0 if status < 400 else 1)


def cmd_models(args: argparse.Namespace) -> None:
    status, data = api_request("GET", "/platformModels")
    if status >= 400:
        print(f"HTTP {status}: {data}", file=sys.stderr)
        sys.exit(1)
    models = data.get("custom_models", data) if isinstance(data, dict) else data
    print(json.dumps(models, indent=2)[: args.limit_chars])


def cmd_generate(args: argparse.Namespace) -> None:
    body = {
        "prompt": args.prompt,
        "width": args.width,
        "height": args.height,
        "num_images": args.num_images,
    }
    if args.model_id:
        body["modelId"] = args.model_id
    if args.negative_prompt:
        body["negative_prompt"] = args.negative_prompt

    status, data = api_request("POST", "/generations", body)
    if status >= 400:
        print(f"POST /generations HTTP {status}: {data}", file=sys.stderr)
        sys.exit(1)

    gen_id = data.get("sdGenerationJob", {}).get("generationId") or data.get("generationId")
    if not gen_id:
        print(f"No generationId in response: {data}", file=sys.stderr)
        sys.exit(1)
    print(f"Started generation {gen_id}, polling...")

    deadline = time.time() + args.timeout
    result = None
    while time.time() < deadline:
        status, data = api_request("GET", f"/generations/{gen_id}")
        gen = data.get("generations_by_pk", {})
        state = gen.get("status")
        print(f"  status: {state}")
        if state == "COMPLETE":
            result = gen
            break
        if state == "FAILED":
            print(f"Generation failed: {gen}", file=sys.stderr)
            sys.exit(1)
        time.sleep(3)

    if result is None:
        print("Timed out waiting for generation", file=sys.stderr)
        sys.exit(1)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for i, img in enumerate(result.get("generated_images", [])):
        url = img["url"]
        req = urllib.request.Request(url, headers={"User-Agent": "game-live-v3/1"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            out_path = out_dir / f"{gen_id}_{i}.png"
            out_path.write_bytes(resp.read())
            print(f"Wrote {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Leonardo.ai API helper")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("ping", help="Verify API key and connectivity (GET /me)").set_defaults(func=cmd_ping)

    p_models = sub.add_parser("models", help="List platform/custom models")
    p_models.add_argument("--limit-chars", type=int, default=4000)
    p_models.set_defaults(func=cmd_models)

    p_gen = sub.add_parser("generate", help="Start a generation, poll, download results")
    p_gen.add_argument("prompt")
    p_gen.add_argument("--negative-prompt", default="")
    p_gen.add_argument(
        "--model-id",
        default="de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3",
        help="Leonardo model UUID (see `models` command). Defaults to Phoenix 1.0 -- "
        "the account default model ignored the prompt entirely in testing (asked for "
        "a red apple, got an unrelated grey/red mosaic heart); Phoenix 1.0 followed "
        "the same prompt correctly. Pass '' to use the account default instead.",
    )
    p_gen.add_argument("--width", type=int, default=512)
    p_gen.add_argument("--height", type=int, default=512)
    p_gen.add_argument("--num-images", type=int, default=1)
    p_gen.add_argument("--timeout", type=int, default=180, help="Max seconds to poll before giving up")
    p_gen.add_argument("--out-dir", default="output/leonardo")
    p_gen.set_defaults(func=cmd_generate)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Upload training images into a Leonardo dataset, then kick off custom-model
training on it. Endpoint shapes were discovered by probing (docs.leonardo.ai
is egress-blocked in this environment, the API host is not):

  POST /datasets                  {"name": ...}          -> dataset id
  POST /datasets/{id}/upload      {"extension": "png"}   -> presigned S3 form
  (multipart POST the file to that S3 url with the returned fields)
  POST /models                    {"name", "datasetId", "instance_prompt"}

`instance_prompt` is the trigger word: after training, putting it in a prompt
is what summons this character. Training draws on a separate, much smaller
token pool than normal generation (subscriptionModelTokens -- 20 on this
account vs 16k generation tokens), so don't burn runs on unvetted datasets.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from leonardo import api_request  # noqa: E402


def create_dataset(name: str) -> str:
    status, data = api_request("POST", "/datasets", {"name": name})
    if status >= 400:
        raise SystemExit(f"create dataset failed: {status} {data}")
    return data["insert_datasets_one"]["id"]


def upload_image(dataset_id: str, path: Path) -> str:
    ext = path.suffix.lstrip(".").lower()
    if ext == "jpeg":
        ext = "jpg"
    status, data = api_request("POST", f"/datasets/{dataset_id}/upload", {"extension": ext})
    if status >= 400:
        raise SystemExit(f"presign failed for {path.name}: {status} {data}")

    info = data["uploadDatasetImage"]
    fields = json.loads(info["fields"])
    with path.open("rb") as fh:
        resp = requests.post(info["url"], data=fields, files={"file": (path.name, fh, f"image/{ext}")}, timeout=120)
    if resp.status_code not in (200, 204):
        raise SystemExit(f"S3 upload failed for {path.name}: {resp.status_code} {resp.text[:300]}")
    return info["id"]


def train(dataset_id: str, name: str, instance_prompt: str, extra: dict) -> dict:
    body = {"name": name, "datasetId": dataset_id, "instance_prompt": instance_prompt, **extra}
    status, data = api_request("POST", "/models", body)
    if status >= 400:
        raise SystemExit(f"training failed to start: {status} {json.dumps(data)}")
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description="Leonardo dataset upload + custom model training")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_new = sub.add_parser("create", help="Create an empty dataset")
    p_new.add_argument("name")

    p_add = sub.add_parser("add", help="Upload image files into a dataset")
    p_add.add_argument("dataset_id")
    p_add.add_argument("images", nargs="+")

    p_train = sub.add_parser("train", help="Start training a custom model on a dataset")
    p_train.add_argument("dataset_id")
    p_train.add_argument("--name", required=True)
    p_train.add_argument("--instance-prompt", required=True, help="Trigger word, e.g. katchar")
    p_train.add_argument("--model-type", default="CHARACTERS", help="GENERAL | CHARACTERS | ENVIRONMENTS | ILLUSTRATIONS | OBJECTS")
    p_train.add_argument("--resolution", type=int, default=1024)

    p_get = sub.add_parser("status", help="Check a custom model's training status")
    p_get.add_argument("model_id")

    args = parser.parse_args()

    if args.cmd == "create":
        print(create_dataset(args.name))

    elif args.cmd == "add":
        for raw in args.images:
            path = Path(raw)
            image_id = upload_image(args.dataset_id, path)
            print(f"uploaded {path.name} -> {image_id}")

    elif args.cmd == "train":
        extra = {"modelType": args.model_type, "resolution": args.resolution}
        print(json.dumps(train(args.dataset_id, args.name, args.instance_prompt, extra), indent=2))

    elif args.cmd == "status":
        status, data = api_request("GET", f"/models/{args.model_id}")
        print(status)
        print(json.dumps(data, indent=2)[:3000])

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Validate one Agent-authored anomaly content bundle before publication."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]
if str(SKILL_DIR) not in sys.path:
    sys.path.insert(0, str(SKILL_DIR))

from engine.agent_content import AgentContentError, normalize_agent_content  # noqa: E402
from engine.contracts import ContractValidationError, validate_payload  # noqa: E402


def _load(path: Path, label: str) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise AgentContentError(f"{label} does not exist: {path}") from None
    except json.JSONDecodeError as exc:
        raise AgentContentError(f"{label} is invalid JSON: {exc}") from exc
    if not isinstance(payload, dict):
        raise AgentContentError(f"{label} root must be an object")
    return payload


def validate_bundle(
    workspace: str | Path,
    preparation: dict,
    bundle: dict,
) -> dict[str, dict]:
    validate_payload(preparation, "analysis-preparation.schema.json")
    validate_payload(bundle, "agent-analysis-bundle.schema.json")
    if bundle.get("run_id") != preparation.get("run_id"):
        raise AgentContentError("Agent bundle run_id does not match the preparation")
    expected = {
        request["event_id"]: request for request in preparation["analysis_requests"]
    }
    supplied: dict[str, dict] = {}
    for content in bundle["events"]:
        event_id = content.get("event_id")
        if event_id in supplied:
            raise AgentContentError(f"Agent bundle contains duplicate event_id: {event_id}")
        if event_id not in expected:
            raise AgentContentError(f"Agent bundle contains unprepared event_id: {event_id}")
        request = expected[event_id]
        detector_event = request["evidence"]["detector_event"]
        point_refs = [
            str(point["pointDataId"])
            for point in request["evidence"].get("source_points", [])
            if point.get("pointDataId")
        ]
        normalize_agent_content(
            content,
            event_id=event_id,
            workspace=workspace,
            point_refs=point_refs,
            event_start=detector_event["time_start"],
            event_end=detector_event["time_end"],
        )
        supplied[event_id] = content
    missing = sorted(set(expected) - set(supplied))
    if missing:
        raise AgentContentError(f"Agent bundle is missing prepared events: {missing}")
    return supplied


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", default=".")
    parser.add_argument("--preparation", required=True)
    parser.add_argument("--analysis-json", required=True)
    args = parser.parse_args()
    root = Path(args.workspace).resolve()
    preparation_path = (root / args.preparation).resolve() if not Path(args.preparation).is_absolute() else Path(args.preparation).resolve()
    analysis_path = (root / args.analysis_json).resolve() if not Path(args.analysis_json).is_absolute() else Path(args.analysis_json).resolve()
    try:
        preparation = _load(preparation_path, "preparation")
        bundle = _load(analysis_path, "Agent bundle")
        supplied = validate_bundle(root, preparation, bundle)
    except (AgentContentError, ContractValidationError, OSError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2
    print(
        json.dumps(
            {
                "ok": True,
                "run_id": preparation["run_id"],
                "validated_event_ids": sorted(supplied),
                "content_source": "agent_knowledge",
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Publish one prepared anomaly run with validated Agent content."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]
if str(SKILL_DIR) not in sys.path:
    sys.path.insert(0, str(SKILL_DIR))

from engine.agent_content import AgentContentError  # noqa: E402
from engine.contracts import ContractValidationError, validate_payload  # noqa: E402
from engine.loader import SensorDataError  # noqa: E402
from engine.workspace import run_workspace_detection  # noqa: E402
from validate_agent_analysis import _load, validate_bundle  # noqa: E402


def _temporary_cleanup(root: Path, paths: list[Path], *, enabled: bool) -> dict:
    if not enabled:
        return {"attempted": False, "deleted": []}
    temporary_root = (root / "tmp").resolve()
    deleted: list[str] = []
    for path in paths:
        try:
            path.resolve().relative_to(temporary_root)
        except ValueError:
            continue
        path.unlink(missing_ok=True)
        deleted.append(str(path.resolve().relative_to(root)).replace("\\", "/"))
    return {"attempted": True, "deleted": deleted}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", default=".")
    parser.add_argument("--preparation", required=True)
    parser.add_argument("--analysis-json", required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-cleanup", action="store_true")
    args = parser.parse_args()
    root = Path(args.workspace).resolve()
    preparation_path = (root / args.preparation).resolve() if not Path(args.preparation).is_absolute() else Path(args.preparation).resolve()
    analysis_path = None
    if args.analysis_json:
        analysis_path = (root / args.analysis_json).resolve() if not Path(args.analysis_json).is_absolute() else Path(args.analysis_json).resolve()
    try:
        preparation = _load(preparation_path, "preparation")
        validate_payload(preparation, "analysis-preparation.schema.json")
        analysis_payloads = None
        if analysis_path is not None:
            analysis_payloads = validate_bundle(
                root,
                preparation,
                _load(analysis_path, "Agent bundle"),
            )
        selection = preparation["selection"]
        outcome = run_workspace_detection(
            root,
            ser_no=preparation["ser_no"],
            paths=preparation["input_refs"],
            ship_id=selection.get("requested_ship_id"),
            device_id=selection.get("requested_device_id"),
            dry_run=args.dry_run,
            cleanup=not args.no_cleanup,
            created_at=datetime.fromisoformat(preparation["prepared_at"].replace("Z", "+00:00")),
            analysis_payloads=analysis_payloads,
        )
        if outcome["result"]["run_id"] != preparation["run_id"]:
            raise AgentContentError("Published run_id does not match the preparation")
        outcome["temporary_cleanup"] = _temporary_cleanup(
            root,
            [path for path in (preparation_path, analysis_path) if path is not None],
            enabled=not args.dry_run,
        )
    except (
        AgentContentError,
        SensorDataError,
        ContractValidationError,
        ValueError,
        OSError,
    ) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2
    print(json.dumps({"ok": True, **outcome}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

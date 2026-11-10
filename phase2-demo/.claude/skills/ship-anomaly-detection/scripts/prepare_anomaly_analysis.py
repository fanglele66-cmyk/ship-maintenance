#!/usr/bin/env python3
"""Prepare deterministic detector evidence for Agent-authored anomaly analysis."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]
if str(SKILL_DIR) not in sys.path:
    sys.path.insert(0, str(SKILL_DIR))

from engine.contracts import ContractValidationError  # noqa: E402
from engine.loader import SensorDataError  # noqa: E402
from engine.workspace import run_workspace_detection  # noqa: E402


def _save(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    temporary.replace(path)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run deterministic detection and prepare Agent analysis evidence without publishing."
    )
    parser.add_argument("--workspace", default=".")
    parser.add_argument("--ser-no", required=True)
    parser.add_argument("--lookback-hours", type=float, default=6.0)
    parser.add_argument("--max-files", type=int, default=12)
    parser.add_argument("--input", action="append", default=None)
    parser.add_argument("--ship-id", default=None)
    parser.add_argument("--device-id", default=None)
    parser.add_argument("--prepared-at", default=None)
    parser.add_argument("--output", default=None)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    root = Path(args.workspace).resolve()
    try:
        outcome = run_workspace_detection(
            root,
            ser_no=args.ser_no,
            paths=args.input,
            lookback_hours=args.lookback_hours,
            max_files=args.max_files,
            ship_id=args.ship_id,
            device_id=args.device_id,
            dry_run=True,
            cleanup=False,
            created_at=(
                datetime.fromisoformat(args.prepared_at.replace("Z", "+00:00"))
                if args.prepared_at
                else None
            ),
            prepare_only=True,
        )
        preparation = outcome["preparation"]
        output = Path(args.output) if args.output else Path(
            f"tmp/{preparation['run_id']}__analysis-preparation.json"
        )
        output_path = (output if output.is_absolute() else root / output).resolve()
        output_path.relative_to(root)
        _save(output_path, preparation)
    except (SensorDataError, ContractValidationError, ValueError, OSError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2
    outcome["preparation_ref"] = str(output_path.relative_to(root)).replace("\\", "/")
    print(json.dumps({"ok": True, **outcome}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

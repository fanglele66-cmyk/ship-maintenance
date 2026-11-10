"""Publish the host Agent's validated manual-event analysis."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL_DIR))
from engine.preparation import publish_manual_analysis
from engine.contracts import ManualContractError


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", default=".")
    parser.add_argument("--preparation", required=True)
    parser.add_argument("--analysis-json", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        outcome = publish_manual_analysis(
            args.workspace, args.preparation, analysis_ref=args.analysis_json,
            dry_run=args.dry_run,
        )
    except (ManualContractError, ValueError, OSError, KeyError, TypeError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2
    print(json.dumps({"ok": True, **outcome}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

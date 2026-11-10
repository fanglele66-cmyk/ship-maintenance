from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]
if str(SKILL_DIR) not in sys.path:
    sys.path.insert(0, str(SKILL_DIR))

from engine.workspace import cleanup_workspace  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Clean expired raw sensor input and non-event AI detection results."
    )
    parser.add_argument("--workspace", default=".")
    parser.add_argument("--input-hours", type=float, default=12.0)
    parser.add_argument("--max-raw-files", type=int, default=24)
    parser.add_argument("--output-hours", type=float, default=12.0)
    args = parser.parse_args()
    report = cleanup_workspace(
        Path(args.workspace),
        input_hours=args.input_hours,
        max_raw_files=args.max_raw_files,
        output_hours=args.output_hours,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

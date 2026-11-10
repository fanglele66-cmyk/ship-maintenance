from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]
if str(SKILL_DIR) not in sys.path:
    sys.path.insert(0, str(SKILL_DIR))

from engine.contracts import ManualContractError  # noqa: E402
from engine.mapping import MappingError  # noqa: E402
from engine.prompt import PromptContractError, parse_fixed_prompt  # noqa: E402
from engine.workflow import run_manual_anomaly  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Process one shipboard manual anomaly report.")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument(
        "--prompt-stdin",
        action="store_true",
        help="Read the current fixed prompt directly from standard input.",
    )
    source.add_argument("--prompt-file", help="UTF-8 fixed prompt file.")
    source.add_argument("--input-file", help="Workspace-relative report JSON.")
    parser.add_argument("--workspace", default=".")
    parser.add_argument("--raw-input", action="append", default=None, help="Offline/test raw JSON; repeatable.")
    parser.add_argument("--max-window-attempts", type=int, default=3)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--created-at", default=None, help="Test-only deterministic ISO 8601 run time.")
    args = parser.parse_args()

    workspace = Path(args.workspace).resolve()
    try:
        if args.prompt_stdin:
            prompt_text = sys.stdin.read()
            if not prompt_text.strip():
                raise PromptContractError("标准输入中没有收到固定异常上报提示词")
            report = parse_fixed_prompt(prompt_text)
        elif args.prompt_file:
            prompt_path = Path(args.prompt_file)
            prompt_path = prompt_path if prompt_path.is_absolute() else workspace / prompt_path
            report = parse_fixed_prompt(prompt_path.read_text(encoding="utf-8"))
        else:
            input_path = Path(args.input_file)
            input_path = input_path if input_path.is_absolute() else workspace / input_path
            report = json.loads(input_path.read_text(encoding="utf-8"))
        outcome = run_manual_anomaly(
            workspace,
            report,
            raw_inputs=args.raw_input,
            max_window_attempts=args.max_window_attempts,
            dry_run=args.dry_run,
            prepare_only=True,
            created_at=(
                datetime.fromisoformat(args.created_at.replace("Z", "+00:00"))
                if args.created_at
                else None
            ),
        )
    except (
        OSError,
        json.JSONDecodeError,
        ValueError,
        PromptContractError,
        MappingError,
        ManualContractError,
    ) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 2
    print(json.dumps({"ok": True, **outcome}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

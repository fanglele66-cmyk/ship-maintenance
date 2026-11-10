"""Validate a published ship-engine-health result against the current schema."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Sequence

from jsonschema import FormatChecker
from jsonschema.validators import validator_for


SKILL_DIR = Path(__file__).resolve().parents[1]
SCHEMA_PATH = SKILL_DIR / "template" / "result.schema.json"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate one ship-engine-health result with the current result schema."
    )
    parser.add_argument(
        "--workspace",
        default=".",
        help="Workspace root directory; defaults to the current directory.",
    )
    parser.add_argument(
        "result_json_path",
        help="Absolute result path or path relative to the workspace.",
    )
    return parser


def validate_payload(payload: Any) -> list[str]:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    validator_class = validator_for(schema)
    validator_class.check_schema(schema)
    validator = validator_class(schema, format_checker=FormatChecker())
    return [
        f"{'/'.join(str(item) for item in error.absolute_path) or '$'}: {error.message}"
        for error in sorted(
            validator.iter_errors(payload),
            key=lambda error: tuple(str(item) for item in error.absolute_path),
        )
    ]


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    workspace = Path(args.workspace).resolve()
    path = Path(args.result_json_path)
    if not path.is_absolute():
        path = workspace / path
    if not path.is_file():
        print(f"Result file does not exist: {path}")
        return 1

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Invalid result JSON: {exc}")
        return 1

    errors = validate_payload(payload)
    if errors:
        print("Result schema validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"OK: {path} matches {SCHEMA_PATH.name}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

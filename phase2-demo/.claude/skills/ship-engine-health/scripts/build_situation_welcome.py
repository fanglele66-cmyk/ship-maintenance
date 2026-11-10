"""Build the standalone welcome message for a new ship situation session."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from jsonschema import FormatChecker
from jsonschema.validators import validator_for


SKILL_DIR = Path(__file__).resolve().parents[1]
MESSAGE_SCHEMA_PATH = SKILL_DIR / "template" / "situation-message.schema.json"
RESULT_SCHEMA_PATH = SKILL_DIR / "template" / "result.schema.json"
SHIP_PROFILE_PATH = Path("data/ship-profile.json")


class SituationMessageError(ValueError):
    """Raised when a situation message violates its contract."""


def _configured_ship_name(workspace: Path) -> str:
    path = workspace / SHIP_PROFILE_PATH
    try:
        profile = json.loads(path.read_text(encoding="utf-8-sig"))
    except OSError as exc:
        raise SituationMessageError(f"cannot read ship profile: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SituationMessageError(f"invalid ship profile JSON: {path}: {exc}") from exc
    if not isinstance(profile, dict):
        raise SituationMessageError("ship profile root must be an object")
    ship_name = str(profile.get("shipName") or "").strip()
    if not ship_name:
        raise SituationMessageError("ship profile field shipName must not be empty")
    return ship_name


def _load_schema(path: Path):
    schema = json.loads(path.read_text(encoding="utf-8"))
    validator_class = validator_for(schema)
    validator_class.check_schema(schema)
    return validator_class(schema, format_checker=FormatChecker())


def _validation_errors(payload: Any, schema_path: Path) -> list[str]:
    validator = _load_schema(schema_path)
    errors = sorted(
        validator.iter_errors(payload),
        key=lambda error: tuple(str(part) for part in error.absolute_path),
    )
    details = []
    for error in errors[:12]:
        location = ".".join(str(part) for part in error.absolute_path) or "$"
        details.append(f"{location}: {error.message}")
    return details


def validate_message(message: dict[str, Any]) -> None:
    errors = _validation_errors(message, MESSAGE_SCHEMA_PATH)
    if errors:
        raise SituationMessageError(
            "situation-message.schema.json validation failed: " + "; ".join(errors)
        )


def _empty_metrics() -> dict[str, int | None]:
    return {
        "keyDeviceCount": None,
        "totalDeviceCount": None,
        "abnormalCount": None,
        "warningCount": None,
    }


def _latest_health_metrics(workspace: Path) -> dict[str, int | None]:
    output_dir = workspace / "result" / "engine-health" / "outputs"
    if not output_dir.is_dir():
        return _empty_metrics()

    candidates = sorted(
        output_dir.glob("engine-health-*__result.json"),
        key=lambda path: path.name,
        reverse=True,
    )
    for path in candidates:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if _validation_errors(payload, RESULT_SCHEMA_PATH):
            continue
        overview = payload["overview"]
        return {
            "keyDeviceCount": overview["key_device_count"],
            "totalDeviceCount": overview["total_device_count"],
            "abnormalCount": overview["abnormal_count"],
            "warningCount": overview["warning_count"],
        }
    return _empty_metrics()


def build_situation_welcome(
    *,
    workspace: Path | str = Path("."),
    ship_name: str | None = None,
) -> dict[str, Any]:
    workspace_path = Path(workspace).resolve()
    configured_ship_name = _configured_ship_name(workspace_path)
    normalized_ship_name = configured_ship_name if ship_name is None else ship_name.strip()
    if not normalized_ship_name:
        raise SituationMessageError("ship_name must not be empty")
    if normalized_ship_name != configured_ship_name:
        raise SituationMessageError(
            f"ship_name={normalized_ship_name!r} does not match ship profile "
            f"shipName={configured_ship_name!r}"
        )
    metrics = _latest_health_metrics(workspace_path)
    metric_values = tuple(metrics.values())
    if all(value is not None for value in metric_values):
        summary = (
            f"{normalized_ship_name}当前重点设备 "
            f"{metrics['keyDeviceCount']}/{metrics['totalDeviceCount']} 台，"
            f"异常 {metrics['abnormalCount']} 台、"
            f"预警 {metrics['warningCount']} 台。"
            "请选择左侧设备查看详情。"
        )
    else:
        summary = (
            f"欢迎进入{normalized_ship_name}船舶态势页面，"
            "当前暂无可用设备健康统计，请选择左侧设备查看详情。"
        )
    message = {
        "type": "situationWelcome",
        "data": {
            "shipName": normalized_ship_name,
            "title": "船舶运行概览",
            "metrics": metrics,
            "summary": summary,
            "suggestedQuestions": [
                "当前哪些重点设备需要优先关注？",
                "帮我查看主机的设备健康情况。",
                "最近是否有未闭环的异常事件？",
            ],
        },
    }
    validate_message(message)
    return message


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build the standalone welcome message for a new situation session."
    )
    parser.add_argument(
        "--workspace",
        default=".",
        help="Backend-bound workspace used to read the latest valid health result. Defaults to current directory.",
    )
    parser.add_argument(
        "--ship-name",
        default=None,
        help="Optional compatibility check; defaults to data/ship-profile.json shipName.",
    )
    return parser.parse_args()


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="strict")
    args = parse_args()
    try:
        message = build_situation_welcome(
            workspace=args.workspace,
            ship_name=args.ship_name,
        )
    except SituationMessageError as exc:
        raise SystemExit(f"ERROR: {exc}") from exc
    # Keep the JSON body compact and wrap it in the explicit frontend card
    # protocol. The frontend recognizes this card fence before Markdown.
    json_body = json.dumps(
        message,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
    )
    json.loads(json_body)
    sys.stdout.write(f"```card\n{json_body}\n```")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

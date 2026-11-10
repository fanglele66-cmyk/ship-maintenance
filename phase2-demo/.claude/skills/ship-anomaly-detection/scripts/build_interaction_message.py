"""Build read-only UI messages for an existing AI anomaly event."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator


SKILL_DIR = Path(__file__).resolve().parents[1]
SCHEMA_PATH = SKILL_DIR / "template" / "interaction-message.schema.json"
EVENT_ID_PATTERN = re.compile(r"^ai-[A-Za-z0-9_-]+$")

FALSE_ALARM_OPTIONS = [
    {
        "code": "equipment_stopped_or_maintenance",
        "label": "触发时设备处于停机/检修状态",
    },
    {
        "code": "sensor_collection_abnormal",
        "label": "传感器数据采集异常",
    },
    {
        "code": "alarm_threshold_improper",
        "label": "告警规则阈值设置不当",
    },
    {
        "code": "transient_condition_recovered",
        "label": "短暂工况波动已自行恢复",
    },
    {
        "code": "other",
        "label": "其他原因",
        "allowTextInput": True,
    },
]
BEIJING_TZ = timezone(timedelta(hours=8))


class InteractionMessageError(ValueError):
    """Raised when an existing event cannot produce a safe interaction message."""


def _event_directory(event_root: Path, event_id: str) -> Path:
    """Short folder for new events; preserve the location of legacy events."""
    directory_name = re.sub(r"-[0-9]{8}_[0-9]{6}$", "", event_id)
    event_dir = (event_root / directory_name).resolve()
    legacy_dir = (event_root / event_id).resolve()
    event_filename = f"{event_id}__event.json"
    if not (event_dir / event_filename).is_file() and (legacy_dir / event_filename).is_file():
        return legacy_dir
    return event_dir


def _read_object(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise InteractionMessageError(f"required file does not exist: {path}")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise InteractionMessageError(f"cannot read JSON file: {path}") from exc
    if not isinstance(payload, dict):
        raise InteractionMessageError(f"JSON root must be an object: {path}")
    return payload


def _validator() -> Draft202012Validator:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def validate_message(message: dict[str, Any]) -> None:
    errors = sorted(
        _validator().iter_errors(message),
        key=lambda error: tuple(str(part) for part in error.absolute_path),
    )
    if not errors:
        return
    details = []
    for error in errors[:10]:
        location = ".".join(str(part) for part in error.absolute_path) or "$"
        details.append(f"{location}: {error.message}")
    raise InteractionMessageError(
        "interaction-message.schema.json validation failed: " + "; ".join(details)
    )


def _event_files(workspace: Path, event_id: str) -> tuple[Path, Path]:
    if not EVENT_ID_PATTERN.fullmatch(event_id):
        raise InteractionMessageError(f"invalid AI event_id: {event_id}")
    root = workspace.resolve()
    parent = (root / "result" / "ai-anomaly" / "events").resolve()
    event_dir = _event_directory(parent, event_id)
    if event_dir.parent != parent:
        raise InteractionMessageError("event_id resolves outside AI event directory")
    return (
        event_dir / f"{event_id}__event.json",
        event_dir / f"{event_id}__anomaly-analysis-result.json",
    )


def _require_identity(
    payload: dict[str, Any],
    event_id: str,
    *,
    expected_type: str = "ai-anomaly",
) -> None:
    if payload.get("event_id") != event_id:
        raise InteractionMessageError("event_id does not match the requested event")
    if payload.get("event_type") != expected_type:
        raise InteractionMessageError(
            f"event_type must be {expected_type!r}, got {payload.get('event_type')!r}"
        )


def _parse_time(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is not None and parsed.utcoffset() is not None:
        parsed = parsed.astimezone(BEIJING_TZ).replace(tzinfo=None)
    return parsed


def _duration_metric(analysis: dict[str, Any]) -> list[dict[str, Any]]:
    bases = analysis.get("analysis_basis")
    if not isinstance(bases, list):
        return []
    for basis in bases:
        if not isinstance(basis, dict):
            continue
        window = basis.get("time_window")
        if not isinstance(window, dict):
            continue
        start = _parse_time(window.get("start_time"))
        end = _parse_time(window.get("end_time"))
        if start is None or end is None or end <= start:
            continue
        minutes = round((end - start).total_seconds() / 60.0, 1)
        return [{"name": "异常持续时间", "value": minutes, "unit": "分钟"}]
    return []


def build_event_welcome(workspace: Path, event_id: str) -> dict[str, Any]:
    event_path, analysis_path = _event_files(workspace, event_id)
    event = _read_object(event_path)
    analysis = _read_object(analysis_path)
    _require_identity(event, event_id)
    _require_identity(analysis, event_id)

    conclusion = analysis.get("analysis_conclusion")
    inference = analysis.get("engineering_inference")
    content = conclusion.get("summary") if isinstance(conclusion, dict) else None
    suggestion = inference.get("summary") if isinstance(inference, dict) else None
    title = event.get("event_title") or analysis.get("event_title")

    if not isinstance(title, str) or not title.strip():
        raise InteractionMessageError("event title is missing")
    if not isinstance(content, str) or not content.strip():
        raise InteractionMessageError("analysis conclusion summary is missing")
    if not isinstance(suggestion, str) or not suggestion.strip():
        raise InteractionMessageError("engineering inference summary is missing")

    message = {
        "type": "eventWelcome",
        "data": {
            "shipId": event.get("ship_id"),
            "eventId": event_id,
            "eventType": "ai-anomaly",
            "title": title.strip(),
            "content": content.strip(),
            "keyMetrics": _duration_metric(analysis),
            "suggestion": suggestion.strip(),
        },
    }
    validate_message(message)
    return message


def build_false_alarm_form(workspace: Path, event_id: str) -> dict[str, Any]:
    event_path, _ = _event_files(workspace, event_id)
    event = _read_object(event_path)
    _require_identity(event, event_id)
    message = {
        "type": "falseAlarmForm",
        "data": {
            "shipId": event.get("ship_id"),
            "eventId": event_id,
            "eventType": "ai-anomaly",
            "title": "请选择误报原因",
            "selectionMode": "single",
            "options": FALSE_ALARM_OPTIONS,
            "confirmText": "确认并记录",
            "cancelText": "取消",
        },
    }
    validate_message(message)
    return message


def build_message(workspace: Path, event_id: str, action: str) -> dict[str, Any]:
    if action == "event_welcome":
        return build_event_welcome(workspace, event_id)
    if action == "mark_false_alarm":
        return build_false_alarm_form(workspace, event_id)
    raise InteractionMessageError(f"unsupported action: {action}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a read-only AI event interaction message."
    )
    parser.add_argument("--workspace", default=".")
    parser.add_argument("--event-id", required=True)
    parser.add_argument(
        "--action",
        required=True,
        choices=["event_welcome", "mark_false_alarm"],
    )
    return parser.parse_args()


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="strict")
    args = parse_args()
    try:
        message = build_message(Path(args.workspace), args.event_id, args.action)
    except InteractionMessageError as exc:
        raise SystemExit(f"ERROR: {exc}") from exc
    if message["type"] == "falseAlarmForm":
        payload = json.dumps(
            message,
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
        )
        sys.stdout.write(payload)
        return 0
    data = message["data"]
    parts = [str(data["title"]).strip(), str(data["content"]).strip()]
    metrics = data.get("keyMetrics")
    if isinstance(metrics, list) and metrics:
        parts.append(
            "关键指标：\n"
            + "\n".join(
                f"- {item['name']}：{item['value']}{item.get('unit') or ''}"
                for item in metrics
            )
        )
    suggestion = str(data.get("suggestion") or "").strip()
    if suggestion:
        parts.append(suggestion)
    sys.stdout.write("\n\n".join(part for part in parts if part))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Build a read-only device-health card from the latest valid health result."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from jsonschema import FormatChecker
from jsonschema.validators import validator_for


SKILL_DIR = Path(__file__).resolve().parents[1]
RESULT_SCHEMA_PATH = SKILL_DIR / "template" / "result.schema.json"
MESSAGE_SCHEMA_PATH = SKILL_DIR / "template" / "device-detail-message.schema.json"
SHIP_PROFILE_PATH = Path("data/ship-profile.json")


class DeviceDetailError(ValueError):
    """Raised when a device detail message cannot satisfy its contract."""


CARD_OPEN = "```card\n"
CARD_CLOSE = "\n```"


def _configured_ship_id(workspace: Path) -> str:
    path = workspace / SHIP_PROFILE_PATH
    try:
        profile = json.loads(path.read_text(encoding="utf-8-sig"))
    except OSError as exc:
        raise DeviceDetailError(f"cannot read ship profile: {path}") from exc
    except json.JSONDecodeError as exc:
        raise DeviceDetailError(f"invalid ship profile JSON: {path}: {exc}") from exc
    if not isinstance(profile, dict):
        raise DeviceDetailError("ship profile root must be an object")
    ship_id = str(profile.get("shipId") or "").strip()
    if not ship_id:
        raise DeviceDetailError("ship profile field shipId must not be empty")
    return ship_id


def _validator(path: Path):
    schema = json.loads(path.read_text(encoding="utf-8"))
    validator_class = validator_for(schema)
    validator_class.check_schema(schema)
    return validator_class(schema, format_checker=FormatChecker())


def _errors(payload: Any, schema_path: Path) -> list[str]:
    errors = sorted(
        _validator(schema_path).iter_errors(payload),
        key=lambda error: tuple(str(part) for part in error.absolute_path),
    )
    return [
        (
            f"{'.'.join(str(part) for part in error.absolute_path) or '$'}: "
            f"{error.message}"
        )
        for error in errors[:12]
    ]


def _latest_result(workspace: Path) -> dict[str, Any]:
    output_dir = workspace / "result" / "engine-health" / "outputs"
    if not output_dir.is_dir():
        raise DeviceDetailError("no engine-health output directory exists")
    for path in sorted(
        output_dir.glob("engine-health-*__result.json"),
        key=lambda item: item.name,
        reverse=True,
    ):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(payload, dict) and not _errors(payload, RESULT_SCHEMA_PATH):
            return payload
    raise DeviceDetailError("no valid engine-health result is available")


def build_device_detail(
    *,
    workspace: Path | str,
    ship_id: str | None = None,
    device_id: str,
) -> dict[str, Any]:
    workspace_path = Path(workspace).resolve()
    configured_ship_id = _configured_ship_id(workspace_path)
    normalized_ship_id = configured_ship_id if ship_id is None else ship_id.strip()
    normalized_device_id = device_id.strip()
    if not normalized_ship_id:
        raise DeviceDetailError("ship_id must not be empty")
    if normalized_ship_id != configured_ship_id:
        raise DeviceDetailError(
            f"ship_id={normalized_ship_id!r} does not match ship profile "
            f"shipId={configured_ship_id!r}"
        )
    if not normalized_device_id.isdigit():
        raise DeviceDetailError("device_id must contain digits only")
    result = _latest_result(workspace_path)
    device = next(
        (
            item
            for item in result["devices"].values()
            if item.get("deviceDataId") == normalized_device_id
        ),
        None,
    )
    if device is None:
        raise DeviceDetailError(
            f"device_id is not present in the latest health result: {device_id}"
        )
    name = str(device["device_name"])
    context = str(device["context"]).replace("~", "～")
    message = {
        "type": "deviceDetail",
        "data": {
            "shipId": normalized_ship_id,
            "deviceId": normalized_device_id,
            "deviceName": name,
            "generatedAt": result["generated_at"],
            "analysisWindow": {
                "startTime": result["analysis_window"]["start_time"],
                "endTime": result["analysis_window"]["end_time"],
            },
            "status": device["status"],
            "dataQuality": device["data_quality"],
            "isKeyDevice": device["is_key_device"],
            "healthStatus": device["health_status"],
            "healthScore": device["health_score"],
            "healthLabel": device["health_label"],
            "operatingCondition": device["operating_condition"],
            "eventCount": device["event_count"],
            "abnormalParts": device["abnormal_parts"],
            "analysisHighlights": [
                {
                    "systemType": item["systemType"],
                    "systemName": item["system_name"],
                    "analysisConclusion": item["analysis_conclusion"],
                    "possibleCauses": item["possible_causes"],
                    "evidence": item["evidence"],
                }
                for item in device["analysis_highlights"]
            ],
            "analysisConclusion": device["analysis_conclusion"],
            "recommendations": device["recommendations"],
            "context": context,
            "suggestedQuestions": [
                f"{name}当前最需要优先检查什么？",
                f"{name}最近有哪些未闭环事件？",
                f"{name}下一次健康复查应关注哪些数据？",
            ],
        },
    }
    errors = _errors(message, MESSAGE_SCHEMA_PATH)
    if errors:
        raise DeviceDetailError(
            "device-detail-message.schema.json validation failed: "
            + "; ".join(errors)
        )
    return message


def build_card_envelope_bytes(message: dict[str, Any]) -> bytes:
    """Serialize one fully validated deviceDetail as an indivisible card payload."""

    errors = _errors(message, MESSAGE_SCHEMA_PATH)
    if errors:
        raise DeviceDetailError(
            "device-detail-message.schema.json validation failed before serialization: "
            + "; ".join(errors)
        )
    json_body = json.dumps(
        message,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
    )
    if "\n" in json_body or "\r" in json_body:
        raise DeviceDetailError("deviceDetail JSON body must be one physical line")
    try:
        decoded = json.loads(json_body)
    except json.JSONDecodeError as exc:
        raise DeviceDetailError(
            f"serialized deviceDetail is not valid JSON: {exc}"
        ) from exc
    if decoded != message:
        raise DeviceDetailError("serialized deviceDetail does not round-trip exactly")
    if (
        not isinstance(decoded, dict)
        or set(decoded) != {"type", "data"}
        or not isinstance(decoded["data"], dict)
    ):
        raise DeviceDetailError(
            "deviceDetail must contain exactly the top-level type/data object"
        )
    if decoded["type"] != "deviceDetail":
        raise DeviceDetailError("serialized card type must be deviceDetail")
    # Both the top-level object and its data object must be visibly closed. This
    # catches the exact historical failure where the final outer brace was lost.
    if not json_body.startswith('{"type":"deviceDetail","data":{'):
        raise DeviceDetailError("deviceDetail JSON body has an unexpected prefix")
    if not json_body.endswith("}}"):
        raise DeviceDetailError(
            "deviceDetail JSON body must close both data and top-level objects"
        )

    envelope = f"{CARD_OPEN}{json_body}{CARD_CLOSE}"
    lines = envelope.splitlines()
    if (
        len(lines) != 3
        or lines[0] != "```card"
        or lines[1] != json_body
        or lines[2] != "```"
    ):
        raise DeviceDetailError("deviceDetail card envelope is not exactly three lines")
    if json.loads(lines[1]) != message:
        raise DeviceDetailError("deviceDetail card body failed final JSON verification")

    encoded = envelope.encode("utf-8", errors="strict")
    if encoded.decode("utf-8", errors="strict") != envelope:
        raise DeviceDetailError("deviceDetail card envelope failed UTF-8 round-trip")
    return encoded


def write_card_envelope(message: dict[str, Any]) -> None:
    """Write all validated UTF-8 bytes and fail on a short stdout write."""

    encoded = build_card_envelope_bytes(message)
    buffer = getattr(sys.stdout, "buffer", None)
    if buffer is None:
        text = encoded.decode("utf-8", errors="strict")
        written = sys.stdout.write(text)
        if written is not None and written != len(text):
            raise DeviceDetailError("short text write while emitting deviceDetail")
        sys.stdout.flush()
        return

    offset = 0
    while offset < len(encoded):
        written = buffer.write(encoded[offset:])
        if written is None or written <= 0:
            raise DeviceDetailError("short byte write while emitting deviceDetail")
        offset += written
    buffer.flush()


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="strict")
    parser = argparse.ArgumentParser(
        description="Build a deviceDetail message from the latest health result."
    )
    parser.add_argument("--workspace", default=".")
    parser.add_argument(
        "--ship-id",
        default=None,
        help="Optional compatibility check; defaults to data/ship-profile.json shipId.",
    )
    parser.add_argument("--device-id", required=True)
    args = parser.parse_args()
    try:
        message = build_device_detail(
            workspace=args.workspace,
            ship_id=args.ship_id,
            device_id=args.device_id,
        )
        write_card_envelope(message)
    except DeviceDetailError as exc:
        raise SystemExit(f"ERROR: {exc}") from exc
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

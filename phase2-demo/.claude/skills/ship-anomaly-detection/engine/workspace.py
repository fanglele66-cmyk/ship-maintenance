from __future__ import annotations

import importlib.util
import json
import math
import re
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .agent_content import normalize_agent_content, format_sensor_display
from .contracts import validate_payload, validate_payloads
from .detector import detect_all
from .loader import SensorDataError, load_sensor_raw_data, parse_api_timestamp, parse_timestamp
from .registry import load_registry
from .ship_profile import (
    ShipProfileError,
    device_for_data_id,
    knowledge_package,
    load_ship_profile,
)
from .types import Channel, DetectionEvent


BEIJING_TZ = timezone(timedelta(hours=8))


def _event_directory(event_root: Path, event_id: str) -> Path:
    """Short folder for new events; preserve the location of legacy events."""
    directory_name = re.sub(r"-[0-9]{8}_[0-9]{6}$", "", event_id)
    event_dir = (event_root / directory_name).resolve()
    legacy_dir = (event_root / event_id).resolve()
    event_filename = f"{event_id}__event.json"
    if not (event_dir / event_filename).is_file() and (legacy_dir / event_filename).is_file():
        return legacy_dir
    return event_dir


def _beijing_now_naive() -> datetime:
    return datetime.now(BEIJING_TZ).replace(tzinfo=None, microsecond=0)


def _beijing_naive(value: datetime) -> datetime:
    if value.tzinfo is not None and value.utcoffset() is not None:
        value = value.astimezone(BEIJING_TZ).replace(tzinfo=None)
    return value.replace(microsecond=0)
SER_NO_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")
_PRIORITY_RUNTIME: Any | None = None
_PRIORITY_SEVERITY_FALLBACK = {
    "low": 15.0,
    "medium": 25.0,
    "high": 40.0,
    "critical": 50.0,
}


def _priority_runtime(workspace: Path) -> Any:
    """Load the deterministic scorer owned by ship-event-priority."""

    global _PRIORITY_RUNTIME
    if _PRIORITY_RUNTIME is not None:
        return _PRIORITY_RUNTIME
    candidates = (
        workspace / ".claude" / "skills" / "ship-event-priority" / "scripts" / "run_event_priority.py",
        Path(__file__).resolve().parents[2]
        / "ship-event-priority"
        / "scripts"
        / "run_event_priority.py",
    )
    priority_path = next((path for path in candidates if path.is_file()), None)
    if priority_path is None:
        raise ValueError(
            "ship-event-priority scorer is required before publishing an AI analysis result"
        )
    spec = importlib.util.spec_from_file_location(
        "ship_event_priority_embedded_runtime",
        priority_path,
    )
    if spec is None or spec.loader is None:
        raise ValueError(f"cannot load ship-event-priority scorer: {priority_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _PRIORITY_RUNTIME = module
    return module


def _assign_priority_score(workspace: Path, analysis: dict[str, Any]) -> float:
    try:
        runtime = _priority_runtime(workspace)
        detail = runtime.calculate_priority(analysis)
        score = float(detail["priority_score"])
        if not math.isfinite(score) or not 0.0 <= score <= 100.0:
            raise ValueError("priority_score must be a finite number between 0 and 100")
    except Exception:
        score = _PRIORITY_SEVERITY_FALLBACK.get(
            str(analysis.get("severity") or ""),
            25.0,
        )
    analysis["priority_score"] = score
    return score


def _selector_value(value: str | int | None, field_name: str) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    if not normalized:
        raise ValueError(f"{field_name} must not be empty")
    return normalized


def _required_ser_no(value: str | int | None) -> str:
    if value is None:
        raise ValueError("ser_no is required; AI anomaly cycle was not executed")
    normalized = str(value).strip()
    if not normalized:
        raise ValueError("ser_no is required; AI anomaly cycle was not executed")
    if not SER_NO_PATTERN.fullmatch(normalized):
        raise ValueError("ser_no must contain only letters, digits, underscores, or hyphens")
    return normalized


def _sample_device_data_ids(samples: list[Any]) -> set[str]:
    return {
        str(point.get("deviceDataId") or "").strip()
        for sample in samples
        for point in sample.point_refs.values()
        if str(point.get("deviceDataId") or "").strip()
    }


def _select_detection_samples(
    samples_by_equipment: dict[str, list[Any]],
    metadata: dict[str, Any],
    *,
    ship_id: str | int | None = None,
    device_id: str | int | None = None,
) -> tuple[dict[str, list[Any]], dict[str, Any]]:
    requested_ship_id = _selector_value(ship_id, "shipId")
    requested_device_id = _selector_value(device_id, "deviceId")
    available_ship_ids = {
        str(metadata.get(key) or "").strip()
        for key in ("ship_id", "source_ship_id")
        if str(metadata.get(key) or "").strip()
    }
    if requested_ship_id and requested_ship_id not in available_ship_ids:
        raise ValueError(
            f"shipId {requested_ship_id!r} does not match the selected workspace/raw data; "
            f"expected one of {sorted(available_ship_ids)}"
        )

    selected = samples_by_equipment
    selected_analyzer = str(metadata.get("analyzer") or "")
    if requested_device_id:
        capability = metadata.get("device_capabilities", {}).get(requested_device_id)
        if capability is None:
            raise ValueError(
                f"deviceId {requested_device_id!r} is not configured in "
                "data/ship-profile.json devices"
            )
        if not capability.get("analyzers"):
            raise ValueError(
                f"deviceId {requested_device_id!r} ({capability.get('device_name')}) "
                "has no configured analyzer; data may be collected but "
                "this AI cycle cannot analyze it"
            )
        selected_analyzer = str(capability["analyzers"][0])
        selected = {}
        available_device_ids: set[str] = set()
        for equipment_id, samples in samples_by_equipment.items():
            available_device_ids.update(_sample_device_data_ids(samples))
            matching_samples = [
                sample
                for sample in samples
                if requested_device_id in _sample_device_data_ids([sample])
            ]
            if matching_samples:
                selected[equipment_id] = matching_samples
        if not selected:
            raise ValueError(
                f"deviceId {requested_device_id!r} has no complete samples in the selected raw data; "
                f"available deviceIds are {sorted(available_device_ids)}"
            )
        if len(selected) != 1:
            raise ValueError(
                f"deviceId {requested_device_id!r} resolves to multiple equipment entries: "
                f"{sorted(selected)}"
            )

    analyzed_devices = [
        {
            "equipment_id": equipment_id,
            "equipment_name": samples[0].equipment_name,
            "deviceIds": sorted(_sample_device_data_ids(samples)),
        }
        for equipment_id, samples in sorted(selected.items())
        if samples
    ]
    return selected, {
        "mode": "device" if requested_device_id else "all",
        "analyzer": selected_analyzer,
        "requested_ship_id": requested_ship_id,
        "requested_device_id": requested_device_id,
        "analyzed_devices": analyzed_devices,
    }


def _validate_requested_device_capability(
    workspace: Path,
    device_id: str | int | None,
) -> None:
    requested_device_id = _selector_value(device_id, "deviceId")
    if requested_device_id is None:
        return
    try:
        profile, _ = load_ship_profile(workspace)
    except ShipProfileError as exc:
        raise ValueError(str(exc)) from exc
    matched = device_for_data_id(profile, requested_device_id)
    if matched is None:
        raise ValueError(
            f"deviceId {requested_device_id!r} is not configured in "
            "data/ship-profile.json devices"
        )
    _, device = matched
    if not device["analyzers"]:
        raise ValueError(
            f"deviceId {requested_device_id!r} ({device['deviceName']}) has no analyzer "
            "configured; data may be collected but this AI cycle "
            "cannot analyze it"
        )


def _reference_images(*values: Any, image_root: str) -> list[dict[str, str]]:
    """Return a reference image only when the detected object has a direct manual match."""
    text = " ".join(str(value) for value in values if value not in (None, ""))
    catalog = (
        (("主起动阀",), "主起动阀", "fig_21-2_主起动阀.png"),
        (("起动空气", "启动空气"), "起动空气系统", "fig_21-1_起动空气系统.png"),
        (("燃油",), "燃油系统示例", "fig_17-1_燃油系统示例.png"),
        (("高温冷却水", "缸套水"), "高温冷却水系统回路", "fig_19-1_高温冷却水系统回路示例.png"),
        (("低温冷却水",), "低温冷却水系统回路", "fig_19-2_低温冷却水系统回路示例.png"),
        (("温度传感器", "热电阻"), "温度和电阻关系", "fig_08-2_温度和电阻.png"),
        (("压力变送器",), "压力与电流关系", "fig_08-6_压力和电流之间的比率.png"),
    )
    for keywords, title, filename in catalog:
        if any(keyword in text for keyword in keywords):
            return [{"title": title, "path": f"{image_root}/{filename}"}]
    return []


def _save_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def _load_json(path: Path, default: dict[str, Any]) -> dict[str, Any]:
    if not path.is_file():
        return default
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else default
    except (OSError, json.JSONDecodeError):
        return default


def _slug(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "-", value).strip("-_").lower()
    return cleaned or "main-engine"


def _rel(workspace: Path, path: Path) -> str:
    return path.resolve().relative_to(workspace.resolve()).as_posix()


def _severity(confidence: float) -> str:
    if confidence >= 0.85:
        return "high"
    if confidence >= 0.65:
        return "medium"
    return "low"


def _collapse_confirmed(events: list[DetectionEvent]) -> list[DetectionEvent]:
    selected: dict[tuple[str, str, str], DetectionEvent] = {}
    for event in events:
        if not event.confirmed:
            continue
        key = (event.equipment_id, event.object_id or event.sensors[0], event.time_start.strftime("%Y%m%d%H"))
        previous = selected.get(key)
        if previous is None or (event.confidence_score, event.raw_score) > (
            previous.confidence_score,
            previous.raw_score,
        ):
            selected[key] = event
    return sorted(selected.values(), key=lambda item: item.time_start)


def _source_points(event: DetectionEvent) -> list[dict[str, Any]]:
    rows = event.details.get("sourcePoints", [])
    points: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for item in rows:
        if not isinstance(item, dict):
            continue
        device_data_id = str(item.get("deviceDataId") or "")
        point_data_id = str(item.get("pointDataId") or "")
        identity = (device_data_id, point_data_id)
        if not all(identity) or identity in seen:
            continue
        seen.add(identity)
        points.append({
            "deviceDataId": str(item["deviceDataId"]),
            "pointDataId": str(item["pointDataId"]),
            "pointName": str(item.get("pointName") or ""),
            "dataType": int(item.get("dataType") or 1),
            "unit": str(item.get("unit") or ""),
            "systemType": (
                str(item.get("systemType")).strip()
                if item.get("systemType") not in (None, "")
                else None
            ),
        })
    # A manual report owns its complete selected point set.
    return points if "manualReport" in event.details else points[:6]


def _query_points(event: DetectionEvent) -> list[dict[str, Any]]:
    return [
        {
            key: point[key]
            for key in ("deviceDataId", "pointDataId", "pointName", "dataType", "unit")
        }
        for point in _source_points(event)
    ]


def _related_system_type(event: DetectionEvent) -> str | None:
    values = [
        str(point["systemType"])
        for point in _source_points(event)
        if point.get("systemType") not in (None, "")
    ]
    if not values:
        return None
    first_seen = {value: index for index, value in enumerate(values)}
    return max(set(values), key=lambda value: (values.count(value), -first_seen[value]))


def _device_data_id(event: DetectionEvent) -> str:
    device_data_ids = {
        point["deviceDataId"]
        for point in _source_points(event)
        if point.get("deviceDataId")
    }
    if len(device_data_ids) != 1:
        raise ValueError(
            f"{event.equipment_name} event must resolve exactly one deviceDataId; "
            f"resolved={sorted(device_data_ids)}"
        )
    return next(iter(device_data_ids))


_DISPLAY_ANOMALY_TYPES = {
    "inter_cylinder_consistency": "持续偏离同组基线",
    "absolute_condition_residual": "持续偏离工况健康基线",
    "topology_temperature_delta_residual": "温差持续偏离健康基线",
    "low_mid_speed_physical_consistency": "中低速时持续偏离同组基线",
    "stopped_bearing_temperature_rise": "停机后持续异常升高",
    "stopped_exhaust_cooling_inconsistency": "停机冷却过程持续偏离同组",
    "stopped_temperature_reheat": "停机后持续异常回升",
    "iqr_outlier_candidate": "持续出现异常离群值",
    "dl_nf_cruise": "巡航联合特征持续偏离健康分布",
    "dl_nf_midlow": "中低速联合特征持续偏离健康分布",
}

_LEGACY_CHANNEL_EVENT_TYPES = {
    Channel.INTER_CYL.value: "inter_cylinder_consistency",
    Channel.ABS_AR.value: "absolute_condition_residual",
    Channel.DT_AR.value: "topology_temperature_delta_residual",
    Channel.MID_INTER_CYL.value: "low_mid_speed_physical_consistency",
    Channel.STOPPED.value: "stopped_temperature_reheat",
    Channel.IQR.value: "iqr_outlier_candidate",
    Channel.NF.value: "dl_nf_cruise",
    Channel.NF_MIDLOW.value: "dl_nf_midlow",
}


def _object_display_name(object_id: str | None, equipment_name: str) -> str:
    value = str(object_id or "").strip()
    longhang_cylinder = re.fullmatch(r"cylinder_([1-6])", value, flags=re.IGNORECASE)
    if longhang_cylinder:
        return f"{equipment_name}{longhang_cylinder.group(1)}缸"
    cylinder = re.fullmatch(r"([ABab])([1-6])", value)
    if cylinder:
        return f"{equipment_name}{cylinder.group(1).upper()}{cylinder.group(2)}缸"
    bearing = re.fullmatch(r"main_bearing_(\d+)", value, flags=re.IGNORECASE)
    if bearing:
        return f"{equipment_name}{bearing.group(1)}号主轴承"
    turbo = re.fullmatch(r"turbo_([ABab])", value)
    if turbo:
        return f"{equipment_name}{turbo.group(1).upper()}列增压器"
    bank = re.fullmatch(r"bank_([ABab])", value)
    if bank:
        return f"{equipment_name}{bank.group(1).upper()}列"
    fixed = {
        "charge_air_cooler": "增压空气冷却器",
        "lube_oil_cooler": "滑油冷却器",
        "left_main_engine": "",
        "right_main_engine": "",
    }
    if value.lower() in fixed:
        return f"{equipment_name}{fixed[value.lower()]}"
    return f"{equipment_name}相关参数"


def _point_display_name(event: DetectionEvent) -> str | None:
    points = _source_points(event)
    if not points:
        return None
    point_name = str(points[0].get("pointName") or "").strip()
    point_name = re.sub(r"^\d+--\d+#主机", "", point_name)
    point_name = re.sub(r"^\d+#主机", "", point_name)
    point_name = point_name.removeprefix(event.equipment_name).strip()
    if not point_name or not re.search(r"[\u4e00-\u9fff]", point_name):
        return None
    return f"{event.equipment_name}{point_name}"


def _is_display_anomaly_type(value: Any) -> bool:
    text = str(value or "")
    return (
        4 <= len(text)
        and "_" not in text
        and bool(re.search(r"[\u4e00-\u9fff]", text))
    )


def _build_display_anomaly_type(
    *,
    event_type: str,
    equipment_name: str,
    object_id: str | None,
    point_name: str | None = None,
) -> str:
    subject = point_name or _object_display_name(object_id, equipment_name)
    suffix = _DISPLAY_ANOMALY_TYPES.get(event_type, "持续偏离健康基线")
    text = f"{subject}{suffix}"
    if not _is_display_anomaly_type(text):
        text = f"{_object_display_name(object_id, equipment_name)}{suffix}"
    if not _is_display_anomaly_type(text):
        text = f"{equipment_name}相关参数持续偏离健康基线"
    if not _is_display_anomaly_type(text):
        raise ValueError(f"anomaly_type 必须是含中文说明的完整短句：{text!r}")
    return text


def _display_anomaly_type(event: DetectionEvent) -> str:
    point_name = None
    if event.event_type != "topology_temperature_delta_residual":
        point_name = _point_display_name(event)
    return _build_display_anomaly_type(
        event_type=event.event_type,
        equipment_name=event.equipment_name,
        object_id=event.object_id,
        point_name=point_name,
    )


def _event_title(anomaly_type: str) -> str:
    """Build a frontend title without exposing internal object/channel codes."""
    if not _is_display_anomaly_type(anomaly_type):
        raise ValueError(f"event_title 只能从合法中文 anomaly_type 生成：{anomaly_type!r}")
    suffixes = (
        ("温差持续偏离健康基线", "温差持续异常待确认"),
        ("中低速时持续偏离同组基线", "中低速持续异常待确认"),
        ("停机冷却过程持续偏离同组", "停机冷却过程异常待确认"),
        ("停机后持续异常升高", "停机后异常升高待确认"),
        ("停机后持续异常回升", "停机后异常回升待确认"),
        ("持续偏离工况健康基线", "持续异常待确认"),
        ("持续偏离同组基线", "持续异常待确认"),
        ("持续偏离健康分布", "持续异常待确认"),
        ("持续偏离健康基线", "持续异常待确认"),
        ("持续出现异常离群值", "异常离群待确认"),
    )
    for old_suffix, new_suffix in suffixes:
        if anomaly_type.endswith(old_suffix):
            return f"{anomaly_type[:-len(old_suffix)]}{new_suffix}"
    return f"{anomaly_type}待确认"


def _display_anomaly_type_from_legacy(value: Any, equipment_name: str) -> str:
    legacy = str(value or "")
    for channel in sorted(_LEGACY_CHANNEL_EVENT_TYPES, key=len, reverse=True):
        suffix = f"-{channel}"
        if legacy.endswith(suffix):
            return _build_display_anomaly_type(
                event_type=_LEGACY_CHANNEL_EVENT_TYPES[channel],
                equipment_name=equipment_name,
                object_id=legacy[: -len(suffix)],
            )
    return _build_display_anomaly_type(
        event_type="",
        equipment_name=equipment_name,
        object_id=None,
    )


def _normalize_active_anomaly_types(active_events: list[dict[str, Any]]) -> None:
    for item in active_events:
        if _is_display_anomaly_type(item.get("anomaly_type")):
            continue
        item["anomaly_type"] = _display_anomaly_type_from_legacy(
            item.get("anomaly_type"),
            str(item.get("equipment_name") or "主机"),
        )


def _query_windows(start: datetime, end: datetime, minutes: int) -> list[tuple[datetime, datetime]]:
    if end <= start:
        end = start + timedelta(seconds=10)
    windows: list[tuple[datetime, datetime]] = []
    cursor = start
    while cursor < end:
        window_end = min(cursor + timedelta(minutes=minutes), end)
        windows.append((cursor, window_end))
        cursor = window_end
    return windows


def _data_query_requests(
    event: DetectionEvent,
    *,
    source_ship_id: str,
    api_config: dict[str, Any],
) -> list[dict[str, Any]]:
    points = _query_points(event)
    manual_report = "manualReport" in event.details
    if len(points) < 2 or (not manual_report and len(points) > 6):
        raise ValueError(
            f"AI event data_query_requests must contain 2-6 unique related points; resolved={len(points)}"
        )
    base_url = str(api_config.get("baseUrl") or "").rstrip("/")
    endpoint = str(api_config.get("endpoints", {}).get("pointDataList") or "")
    request_defaults = api_config.get("pointDataRequestDefaults", {})
    if not isinstance(request_defaults, dict):
        raise ValueError("configured sensor API pointDataRequestDefaults must be an object")
    page_no = int(request_defaults.get("pageNo", 0))
    page_size = int(request_defaults.get("pageSize", 10000))
    request_timezone_name = str(request_defaults.get("requestTimeTimezone", "Asia/Shanghai"))
    if not source_ship_id:
        raise ValueError("point-data-list query requires source shipId")
    if page_no != 0 or page_size <= 0:
        raise ValueError("point-data-list query requires pageNo=0 and a positive pageSize")
    if request_timezone_name != "Asia/Shanghai":
        raise ValueError("point-data-list requestTimeTimezone must be Asia/Shanghai")
    if not base_url or not endpoint:
        raise ValueError("configured sensor API must define baseUrl and endpoints.pointDataList")
    device_ids = list(dict.fromkeys(point["deviceDataId"] for point in points))
    point_ids = list(dict.fromkeys(point["pointDataId"] for point in points))
    requests: list[dict[str, Any]] = []
    # Chart queries cover the whole event; collector batching is independent.
    start, end = _beijing_naive(event.time_start), _beijing_naive(event.time_end)
    if end <= start:
        end = start + timedelta(seconds=10)
    windows = [(start, end)]
    for index, (start, end) in enumerate(windows, start=1):
        requests.append(
            {
                "request_id": f"main_engine_anomaly_trend_{index:03d}",
                "data_type": "numeric",
                "api": {
                    "method": "POST",
                    "configRef": str(api_config.get("_configRef") or "data/sensor-api.json"),
                    "endpointKey": "pointDataList",
                    "baseUrl": base_url,
                    "path": endpoint,
                    "body": {
                        "shipId": source_ship_id,
                        "deviceDataIdList": device_ids,
                        "pointDataIdList": point_ids,
                        "collectTimeStart": start.strftime("%Y-%m-%d %H:%M:%S"),
                        "collectTimeEnd": end.strftime("%Y-%m-%d %H:%M:%S"),
                        "pageNo": page_no,
                        "pageSize": page_size,
                    },
                },
                "points": points,
                "time_window": {
                    "start_time": start.isoformat(),
                    "end_time": end.isoformat(),
                },
            }
        )
    return requests


def _analysis_payload(
    event: DetectionEvent,
    *,
    event_id: str,
    ser_no: str,
    created_at: str,
    ship_id: str,
    source_ship_id: str,
    ship_name: str,
    title: str,
    anomaly_type: str,
    api_config: dict[str, Any],
    workspace: Path | None = None,
    agent_content: dict[str, Any] | None = None,
    allow_fallback: bool = False,
) -> dict[str, Any]:
    event_start = _beijing_naive(event.time_start)
    event_end = _beijing_naive(event.time_end)
    point_rows = _source_points(event)
    point_refs = [item["pointDataId"] for item in point_rows]
    severity = _severity(event.confidence_score)
    system_type = _related_system_type(event)
    if allow_fallback or agent_content is None:
        raise ValueError(
            f"Agent-authored analysis based on event evidence and knowledge is required for {event_id}; "
            "deterministic task generation is disabled. Keep the preparation and regenerate the candidate."
        )
    content = normalize_agent_content(
        agent_content,
        event_id=event_id,
        workspace=workspace or Path.cwd(),
        point_refs=point_refs,
        event_start=event_start.isoformat(),
        event_end=event_end.isoformat(),
    )
    content_source = "agent_knowledge"
    payload = {
        "ser_no": ser_no,
        "event_id": event_id,
        "event_type": "ai-anomaly",
        "created_at": created_at,
        "ship_id": ship_id,
        "ship_name": ship_name,
        "deviceDataId": _device_data_id(event),
        "systemType": system_type,
        "image_ids": [],
        "equipment_id": event.equipment_id,
        "equipment_name": event.equipment_name,
        "event_title": title,
        "anomaly_type": anomaly_type,
        "severity": severity,
        "content_source": content_source,
        "analysis_conclusion": {
            "judgement": "suspected_anomaly",
            "confidence": round(event.confidence_score, 4),
            "summary": content["summary"],
        },
        "fault_causes": content["fault_causes"],
        "manual_follow_up_feedback": None,
        "workflow_state": {
            "stage": "event_overview",
            "task_index": None,
            "status": "ready",
            "updated_at": created_at,
            "closure_status": None,
            "summary_ref": None,
        },
        "engineering_inference": content["engineering_inference"],
        "analysis_basis": content["analysis_basis"],
        "diagnostic_plans": content["diagnostic_plans"],
        "data_query_requests": _data_query_requests(
            event,
            source_ship_id=source_ship_id,
            api_config=api_config,
        ),
    }
    _assign_priority_score(workspace or Path.cwd(), payload)
    return format_sensor_display(workspace or Path.cwd(), payload)


def _analysis_request(
    event: DetectionEvent,
    *,
    event_id: str,
    event_action: str,
    ser_no: str,
    title: str,
    anomaly_type: str,
    api_config: dict[str, Any],
    source_ship_id: str,
    knowledge_entry: str,
    knowledge_root: str,
) -> dict[str, Any]:
    point_rows = _source_points(event)
    operating = event.details.get("operatingContext", {})
    search_terms = list(
        dict.fromkeys(
            [
                event.equipment_name,
                str(event.object_id or ""),
                anomaly_type,
                *(str(value) for value in event.groups),
                *(str(point.get("pointName") or "") for point in point_rows),
            ]
        )
    )
    return {
        "event_id": event_id,
        "event_action": event_action,
        "ser_no": ser_no,
        "event_title": title,
        "anomaly_type": anomaly_type,
        "severity": _severity(event.confidence_score),
        "evidence": {
            "detector_event": event.to_dict(),
            "source_points": point_rows,
            "operating_context": operating if isinstance(operating, dict) else {},
            "data_query_requests": _data_query_requests(
                event,
                source_ship_id=source_ship_id,
                api_config=api_config,
            ),
        },
        "knowledge_search": {
            "index_ref": knowledge_entry,
            "required": True,
            "search_terms": [term for term in search_terms if term],
            "citation_rule": (
                "analysis_basis 中 knowledge 项必须写出实际读取的 "
                f"{knowledge_root}/*.md 路径及与本事件相关的具体原理、阈值或排故依据"
            ),
        },
        "agent_content_contract": {
            "schema_ref": (
                ".claude/skills/ship-anomaly-detection/template/"
                "agent-analysis-content.schema.json"
            ),
            "allowed_fields": [
                "event_id",
                "summary",
                "fault_causes",
                "engineering_inference",
                "analysis_basis",
                "diagnostic_plans",
            ],
            "system_managed_fields": [
                "ser_no",
                "created_at",
                "ship_id",
                "deviceDataId",
                "systemType",
                "severity",
                "workflow_state",
                "manual_follow_up_feedback",
                "data_query_requests",
                "order",
                "probability_score",
                "answer_type",
                "required",
                "answer",
                "feedback_text",
                "feedback_image_ids",
            ],
        },
    }


def _find_active_match(
    active: list[dict[str, Any]],
    event: DetectionEvent,
    anomaly_type: str,
    anomaly_code: str,
    gap_sec: float,
    *,
    event_source: str = "ai-anomaly",
) -> dict[str, Any] | None:
    event_start = _beijing_naive(event.time_start)
    event_end = _beijing_naive(event.time_end)
    for item in active:
        if str(item.get("event_source") or "ai-anomaly") != event_source:
            continue
        same_internal_identity = f"-{anomaly_code}-" in str(item.get("event_id") or "")
        if (
            item.get("equipment_id") != event.equipment_id
            or (item.get("anomaly_type") != anomaly_type and not same_internal_identity)
        ):
            continue
        if item.get("status") not in {"active", "confirmed", "monitoring"}:
            continue
        try:
            last_start = parse_timestamp(item.get("time_start"))
            last_end = parse_timestamp(item.get("time_end"))
        except Exception:
            continue
        if (
            event_start <= last_end + timedelta(seconds=gap_sec)
            and last_start <= event_end + timedelta(seconds=gap_sec)
        ):
            return item
    return None


def _document_time(path: Path, fields: tuple[str, ...]) -> datetime:
    payload = _load_json(path, {})
    for field in fields:
        value = payload.get(field)
        if value:
            try:
                return parse_timestamp(str(value))
            except Exception:
                pass
    return datetime.fromtimestamp(path.stat().st_mtime, tz=BEIJING_TZ).replace(tzinfo=None)


def _is_event_linked_output(path: Path) -> bool:
    payload = _load_json(path, {})
    return bool(
        payload.get("events")
        or payload.get("created_event_ids")
        or payload.get("updated_event_ids")
    )


def _format_window_hours(start: datetime, end: datetime) -> str:
    hours = max(0.0, (end - start).total_seconds() / 3600)
    if hours.is_integer():
        return str(int(hours))
    return f"{hours:.2f}".rstrip("0").rstrip(".")


def _raw_document_time(path: Path) -> datetime | None:
    payload = _load_json(path, {})
    records = payload.get("pointDataList")
    if isinstance(records, list):
        try:
            return max(
                parse_api_timestamp(record.get("collectTime"))
                for record in records
                if isinstance(record, dict) and record.get("collectTime")
            )
        except (SensorDataError, ValueError, TypeError):
            pass
    metadata = payload.get("_fetchMetadata")
    if not isinstance(metadata, dict):
        return None
    for field in ("collectTimeEnd", "actualCollectTimeEnd"):
        value = metadata.get(field)
        if value:
            try:
                return parse_api_timestamp(value)
            except (SensorDataError, ValueError, TypeError):
                continue
    value = metadata.get("fetchedAt")
    if value:
        try:
            return parse_timestamp(value)
        except (SensorDataError, ValueError, TypeError):
            pass
    return None


def cleanup_workspace(
    workspace: str | Path,
    *,
    now: datetime | None = None,
    input_hours: float = 12.0,
    output_hours: float = 12.0,
    max_raw_files: int | None = 24,
) -> dict[str, Any]:
    """Keep the latest raw-data window and delete expired non-event outputs."""
    root = Path(workspace).resolve()
    current = _beijing_naive(now) if now is not None else _beijing_now_naive()
    if max_raw_files is not None and max_raw_files <= 0:
        raise ValueError("max_raw_files must be a positive integer or None")
    report: dict[str, Any] = {
        "input_retention_hours": input_hours,
        "max_raw_files": max_raw_files,
        "raw_files_before": 0,
        "raw_files_after": 0,
        "raw_retention_anchor": None,
        "output_retention_hours": output_hours,
        "deleted_raw_inputs": [],
        "deleted_non_event_outputs": [],
        "preserved_event_outputs": [],
        "event_directories_touched": 0,
    }
    raw_root = (root / "input" / "sensor-raw-data").resolve()
    if raw_root.is_dir():
        timed_paths: list[tuple[datetime, Path]] = []
        for path in raw_root.glob("*.json"):
            if path.resolve().parent != raw_root:
                continue
            document_time = _raw_document_time(path)
            if document_time is not None:
                timed_paths.append((document_time, path))
        timed_paths.sort(key=lambda item: (item[0], item[1].name))
        report["raw_files_before"] = len(timed_paths)
        delete_paths: set[Path] = set()
        if timed_paths:
            latest_data_time = timed_paths[-1][0]
            report["raw_retention_anchor"] = latest_data_time.isoformat()
            cutoff = latest_data_time - timedelta(hours=input_hours)
            delete_paths.update(path for document_time, path in timed_paths if document_time < cutoff)
            retained = [item for item in timed_paths if item[1] not in delete_paths]
            if max_raw_files is not None and len(retained) > max_raw_files:
                delete_paths.update(
                    path for _, path in retained[: len(retained) - max_raw_files]
                )
        for _, path in timed_paths:
            if path not in delete_paths:
                continue
            report["deleted_raw_inputs"].append(_rel(root, path))
            path.unlink()
        report["raw_files_after"] = len(timed_paths) - len(delete_paths)

    output_root = (root / "result" / "ai-anomaly" / "outputs").resolve()
    if output_root.is_dir():
        cutoff = current - timedelta(hours=output_hours)
        for path in output_root.glob("*.json"):
            if path.resolve().parent != output_root:
                continue
            if _is_event_linked_output(path):
                report["preserved_event_outputs"].append(_rel(root, path))
                continue
            if _document_time(path, ("created_at",)) < cutoff:
                report["deleted_non_event_outputs"].append(_rel(root, path))
                path.unlink()
    validate_payload(report, "cleanup-report.schema.json")
    return report


def run_workspace_detection(
    workspace: str | Path,
    *,
    ser_no: str | int | None,
    paths: list[str | Path] | None = None,
    lookback_hours: float = 6.0,
    max_files: int | None = 12,
    ship_id: str | int | None = None,
    device_id: str | int | None = None,
    dry_run: bool = False,
    cleanup: bool = True,
    created_at: datetime | None = None,
    analysis_payloads: dict[str, dict[str, Any]] | None = None,
    allow_analysis_fallback: bool = False,
    prepare_only: bool = False,
) -> dict[str, Any]:
    if allow_analysis_fallback:
        raise ValueError("Deterministic analysis fallback is disabled; supply Agent content based on event evidence and knowledge")
    root = Path(workspace).resolve()
    cycle_ser_no = _required_ser_no(ser_no)
    _validate_requested_device_capability(root, device_id)
    samples, input_refs, metadata = load_sensor_raw_data(
        root,
        paths=paths,
        lookback_hours=lookback_hours,
        max_files=max_files,
    )
    samples, selection = _select_detection_samples(
        samples,
        metadata,
        ship_id=ship_id,
        device_id=device_id,
    )
    detection_results = detect_all(samples, workspace=root)
    all_events = [event for result in detection_results for event in result.events]
    confirmed = _collapse_confirmed(all_events)
    now = _beijing_naive(created_at) if created_at is not None else _beijing_now_naive()
    run_id = f"ai-run-{cycle_ser_no}-{now:%Y%m%d_%H%M%S}"
    output_ref = f"result/ai-anomaly/outputs/{run_id}__result.json"
    active_path = root / "result" / "ai-anomaly" / "active-events.json"
    active_payload = _load_json(active_path, {"updated_at": now.isoformat(), "events": []})
    active_events = active_payload.setdefault("events", [])
    _normalize_active_anomaly_types(active_events)
    result_events: list[dict[str, Any]] = []
    created_ids: list[str] = []
    updated_ids: list[str] = []
    duplicate_ids: list[str] = []
    reserved_event_ids: set[str] = set()
    pending_writes: list[tuple[Path, dict[str, Any], str]] = []
    analysis_requests: list[dict[str, Any]] = []
    consumed_analysis_ids: set[str] = set()
    registry = load_registry()
    profile, _ = load_ship_profile(root)
    api_config = _load_json(root / profile["dataSource"]["configPath"], {})
    api_config["_configRef"] = profile["dataSource"]["configPath"]
    knowledge = knowledge_package(root, profile=profile)

    for event in confirmed:
        device_data_id = _device_data_id(event)
        anomaly_code = _slug(f"{event.object_id or event.sensors[0]}-{event.channel.value}")
        anomaly_type = _display_anomaly_type(event)
        event_start = _beijing_naive(event.time_start)
        event_end = _beijing_naive(event.time_end)
        candidate_event_id = (
            f"ai-{metadata['ship_id']}-{cycle_ser_no}-"
            f"{event_start:%Y%m%d_%H%M%S}"
        )
        candidate_event_dir = (
            _event_directory(root / "result" / "ai-anomaly" / "events", candidate_event_id)
        )
        candidate_event_path = (
            candidate_event_dir / f"{candidate_event_id}__event.json"
        )
        if candidate_event_path.is_file():
            existing_event = _load_json(candidate_event_path, {})
            validate_payload(existing_event, "event.schema.json")
            duplicate_ids.append(candidate_event_id)
            continue
        match = _find_active_match(
            active_events,
            event,
            anomaly_type,
            anomaly_code,
            float(registry["event_rules"]["event_match_gap_sec"]),
        )
        if match:
            event_id = str(match["event_id"])
            existing_ser_no = str(match.get("ser_no") or "").strip()
            if not existing_ser_no:
                existing_event_dir = root / str(match.get("event_dir") or "")
                existing_event_path = existing_event_dir / f"{event_id}__event.json"
                existing_ser_no = str(
                    _load_json(existing_event_path, {}).get("ser_no") or ""
                ).strip()
            event_ser_no = _required_ser_no(existing_ser_no)
            event_action = "updated"
            updated_ids.append(event_id)
        else:
            if candidate_event_id in reserved_event_ids:
                raise ValueError(
                    f"multiple confirmed anomalies resolve to the same event_id {candidate_event_id!r}"
                )
            reserved_event_ids.add(candidate_event_id)
            event_id = candidate_event_id
            event_ser_no = cycle_ser_no
            event_action = "created"
            created_ids.append(event_id)
        event_dir = _event_directory(root / "result" / "ai-anomaly" / "events", event_id)
        event_ref_path = event_dir / f"{event_id}__event.json"
        analysis_path = event_dir / f"{event_id}__anomaly-analysis-result.json"
        event_ref, analysis_ref = _rel(root, event_ref_path), _rel(root, analysis_path)
        title = _event_title(anomaly_type)
        analysis_requests.append(
            _analysis_request(
                event,
                event_id=event_id,
                event_action=event_action,
                ser_no=event_ser_no,
                title=title,
                anomaly_type=anomaly_type,
                api_config=api_config,
                source_ship_id=str(metadata["source_ship_id"]),
                knowledge_entry=knowledge["entry"],
                knowledge_root=knowledge["root"],
            )
        )
        if prepare_only:
            continue
        agent_content = None
        if analysis_payloads is not None:
            agent_content = analysis_payloads.get(event_id)
            if agent_content is None:
                raise ValueError(
                    f"Agent analysis bundle is missing event content for {event_id}"
                )
            consumed_analysis_ids.add(event_id)
        analysis = _analysis_payload(
            event,
            event_id=event_id,
            ser_no=event_ser_no,
            created_at=now.isoformat(),
            ship_id=str(metadata["ship_id"]),
            source_ship_id=str(metadata["source_ship_id"]),
            ship_name=str(metadata["ship_name"]),
            title=title,
            anomaly_type=anomaly_type,
            api_config=api_config,
            workspace=root,
            agent_content=agent_content,
            allow_fallback=allow_analysis_fallback,
        )
        title = analysis["event_title"]
        existing_event = _load_json(event_ref_path, {})
        event_master = {
            "ser_no": event_ser_no,
            "event_id": event_id,
            "event_type": "ai-anomaly",
            "ship_id": str(metadata["ship_id"]),
            "deviceDataId": device_data_id,
            "equipment_id": event.equipment_id,
            "equipment_name": event.equipment_name,
            "event_title": title,
            "status": str(existing_event.get("status") or "active"),
            "status_suggestion": str(existing_event.get("status_suggestion") or "inspection_required"),
            "analysis_refs": list(dict.fromkeys([*existing_event.get("analysis_refs", []), analysis_ref])),
            "feedback_refs": list(existing_event.get("feedback_refs", [])),
            "maintenance_feedback_refs": list(existing_event.get("maintenance_feedback_refs", [])),
            "maintenance_refs": list(existing_event.get("maintenance_refs", [])),
            "history": [
                *existing_event.get("history", []),
                {
                    "time": now.isoformat(),
                    "action": f"ai_anomaly_event_{event_action}",
                    "type": "event_created" if event_action == "created" else "event_updated",
                    "title": "AI异常事件已创建" if event_action == "created" else "AI异常事件已更新",
                    "detail": f"{analysis['event_title']}已完成本轮AI异常分析。",
                    "timeline_label": "异常发现" if event_action == "created" else "当前进度生成",
                    "source_label": "系统生成",
                    "actor": {
                        "side": "system",
                        "name": "AI预警",
                        "role": "系统",
                        "display_name": "AI预警",
                    },
                    "stage_result": f"{analysis['event_title']}已完成本轮AI异常分析并写入事件。",
                    "next_action": "由船端接收事件并按诊断方案开始排查。",
                    "ref": output_ref,
                },
            ],
        }
        if "maintenance_processing" in existing_event:
            event_master["maintenance_processing"] = existing_event["maintenance_processing"]
        active_entry = match or {}
        previous_start = active_entry.get("time_start")
        previous_end = active_entry.get("time_end")
        active_entry.update(
            {
                "ser_no": event_ser_no,
                "event_id": event_id,
                "event_source": "ai-anomaly",
                "event_dir": _rel(root, event_dir),
                "status": event_master["status"],
                "status_suggestion": event_master["status_suggestion"],
                "deviceDataId": device_data_id,
                "systemType": analysis.get("systemType"),
                "equipment_id": event.equipment_id,
                "equipment_name": event.equipment_name,
                "event_title": title,
                "anomaly_type": anomaly_type,
                "time_start": min(
                    [value for value in [previous_start, event_start.isoformat()] if value]
                ),
                "time_end": max(
                    [value for value in [previous_end, event_end.isoformat()] if value]
                ),
            }
        )
        if not match:
            active_events.append(active_entry)
        pending_writes.append((event_ref_path, event_master, "event.schema.json"))
        pending_writes.append((analysis_path, analysis, "event-analysis-result.schema.json"))
        result_events.append(
            {
                "ser_no": event_ser_no,
                "event_id": event_id,
                "event_action": event_action,
                "status": event_master["status"],
                "severity": analysis["severity"],
                "deviceDataId": device_data_id,
                "equipment_id": event.equipment_id,
                "equipment_name": event.equipment_name,
                "anomaly_type": anomaly_type,
                "event_title": title,
                "time_range": {"start_time": event_start.isoformat(), "end_time": event_end.isoformat()},
                "summary": analysis["analysis_conclusion"]["summary"],
                "event_ref": event_ref,
                "analysis_result_ref": analysis_ref,
            }
        )

    if analysis_payloads is not None:
        unexpected_analysis_ids = sorted(set(analysis_payloads) - consumed_analysis_ids)
        if unexpected_analysis_ids:
            raise ValueError(
                "Agent analysis bundle contains events that are not part of this prepared run: "
                f"{unexpected_analysis_ids}"
            )

    if prepare_only:
        preparation = {
            "run_id": run_id,
            "prepared_at": now.isoformat(),
            "ser_no": cycle_ser_no,
            "ship_id": str(metadata["ship_id"]),
            "ship_name": str(metadata["ship_name"]),
            "analysis_window": {
                "start_time": metadata["window_start"].isoformat(),
                "end_time": metadata["window_end"].isoformat(),
            },
            "input_refs": input_refs,
            "selection": selection,
            "analysis_requests": analysis_requests,
            "candidate_bundle_ref": f"tmp/{run_id}__agent-analysis.json",
            "candidate_schema_ref": (
                ".claude/skills/ship-anomaly-detection/template/"
                "agent-analysis-bundle.schema.json"
            ),
        }
        validate_payload(preparation, "analysis-preparation.schema.json")
        return {
            "preparation": preparation,
            "detections": [item.to_dict() for item in detection_results],
            "dry_run": True,
            "selection": selection,
            "contract_validation": {
                "ok": True,
                "validated_schemas": ["analysis-preparation.schema.json"],
                "write_set_size": 0,
            },
        }

    status = "anomalyDetected" if confirmed else ("candidate" if all_events else "normal")
    window_hours = _format_window_hours(metadata["window_start"], metadata["window_end"])
    low_confidence_count = len(all_events) - len(confirmed)
    suppressed_count = low_confidence_count + len(duplicate_ids)
    if confirmed:
        summary_message = (
            f"本次分析窗口为 {window_hours} 小时，确认 {len(confirmed)} 个异常事件候选；"
            f"创建 {len(created_ids)} 个、更新 {len(updated_ids)} 个，"
            f"{len(duplicate_ids)} 个同一事件已存在并保持原记录，"
            f"另抑制 {low_confidence_count} 个低置信候选。"
        )
    elif all_events:
        summary_message = (
            f"本次分析窗口为 {window_hours} 小时，当前窗口无确认事件，"
            f"抑制 {suppressed_count} 个低置信候选；本轮结论不引用历史事件状态。"
        )
    else:
        summary_message = (
            f"本次分析窗口为 {window_hours} 小时，当前窗口无异常候选且无确认事件；"
            "本轮结论不引用历史事件状态。"
        )
    result_payload = {
        "run_id": run_id,
        "source": "ai_anomaly",
        "created_at": now.isoformat(),
        "ship_id": str(metadata["ship_id"]),
        "ship_name": str(metadata["ship_name"]),
        "analysis_window": {
            "start_time": metadata["window_start"].isoformat(),
            "end_time": metadata["window_end"].isoformat(),
        },
        "input_refs": input_refs,
        "summary": {
            "result_status": status,
            "new_events": len(created_ids),
            "updated_events": len(updated_ids),
            "suppressed_events": suppressed_count,
            "message": summary_message,
        },
        "created_event_ids": created_ids,
        "updated_event_ids": updated_ids,
        "events": result_events,
    }
    active_payload["updated_at"] = now.isoformat()
    validated_schemas = validate_payloads(
        [
            *((payload, schema_name) for _, payload, schema_name in pending_writes),
            (result_payload, "result.schema.json"),
            (active_payload, "active-events.schema.json"),
        ]
    )
    cleanup_report = None
    if not dry_run:
        for path, payload, _ in pending_writes:
            _save_json(path, payload)
        _save_json(root / output_ref, result_payload)
        _save_json(active_path, active_payload)
        if cleanup:
            cleanup_report = cleanup_workspace(root, now=now)
    return {
        "result": result_payload,
        "detections": [item.to_dict() for item in detection_results],
        "result_ref": output_ref,
        "dry_run": dry_run,
        "selection": selection,
        "analysis_mode": (
            "agent_knowledge" if analysis_payloads is not None else "no_analysis_required"
        ),
        "cleanup": cleanup_report,
        "contract_validation": {
            "ok": True,
            "validated_schemas": validated_schemas,
            "write_set_size": len(pending_writes) + 2,
        },
    }

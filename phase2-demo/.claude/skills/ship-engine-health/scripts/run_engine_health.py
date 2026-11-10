"""Run configured ship health analysis with the established result schema."""

from __future__ import annotations

import argparse
import json
import math
import re
import statistics
import sys
import tempfile
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from jsonschema import FormatChecker
from jsonschema.validators import validator_for


SKILL_DIR = Path(__file__).resolve().parents[1]
if str(SKILL_DIR) not in sys.path:
    sys.path.insert(0, str(SKILL_DIR))

WORKSPACE_ROOT = Path(__file__).resolve().parents[4]
LIB_DIR = WORKSPACE_ROOT / ".claude" / "lib"
if str(LIB_DIR) not in sys.path:
    sys.path.insert(0, str(LIB_DIR))

from ship_workspace_config import (  # noqa: E402
    analyzer_profile,
    import_entrypoint,
    load_ship_profile,
    primary_analyzer,
)


BEIJING_TZ = timezone(timedelta(hours=8))
RAW_FILE_GLOB = "*__raw-data.json"
RESULT_FILE_RE = re.compile(r"^engine-health-(\d{8}_\d{6})__result\.json$")
OUTPUT_RETENTION_HOURS = 12
OUTPUT_PROTECTED_FILE_COUNT = 6
ACTIVE_EVENT_INDEXES = (
    Path("result/ai-anomaly/active-events.json"),
    Path("result/oem-alarm/active-events.json"),
)
DEFAULT_SYSTEM_TYPE_MAPPING = {
    0: "其它",
    1: "燃油系统",
    2: "滑油系统",
    3: "冷却水系统",
    4: "起动空气系统",
    5: "排气系统",
    6: "进气系统",
    7: "气缸温度",
    8: "曲轴箱",
    9: "大端轴承温度",
}
SYSTEM_POSSIBLE_CAUSES = {
    1: ["燃油品质或黏度偏离当前工况要求", "燃油滤器、管路或供油泵状态异常", "喷油器或喷油控制状态异常"],
    2: ["滑油压力、温度或供油状态异常", "滑油滤器或冷却器阻力增大", "轴承状态或关联传感器需要复核"],
    3: ["冷却水泵、阀门或流量状态异常", "换热器换热面结垢或堵塞", "温度、压力或流量传感器需要复核"],
    4: ["起动空气供气压力不足", "起动阀或管路存在泄漏、阻塞", "压力传感器或报警回路需要复核"],
    5: ["燃烧不均或排气阀密封状态异常", "增压器或废气通道积污", "排气温度测点需要复核"],
    6: ["进气滤器阻力增大", "空冷器换热能力下降", "增压器性能或关联测点需要复核"],
    7: ["燃烧或喷油状态不均", "气缸冷却状态不均", "气缸温度测点需要复核"],
    8: ["曲轴箱通风状态异常", "窜气、泄漏或轴承状态需要检查", "压力或油雾测点需要复核"],
    9: ["滑油供给状态异常", "大端轴承磨损或间隙异常", "轴承温度测点需要复核"],
}


def _validate_result_schema(payload: dict[str, Any]) -> None:
    schema_path = Path(__file__).resolve().parents[1] / "template" / "result.schema.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    validator_class = validator_for(schema)
    validator_class.check_schema(schema)
    errors = list(validator_class(schema, format_checker=FormatChecker()).iter_errors(payload))
    if errors:
        raise ValueError("result schema validation failed: " + "; ".join(error.message for error in errors))


def _to_float(value: Any) -> float | None:
    if value in ("", None):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return number


def _decode_api_numeric_value(value: Any, *, signed_16: bool) -> float | None:
    numeric = _to_float(value)
    if numeric is None:
        return None
    if signed_16:
        if numeric >= 32768.0:
            numeric -= 65536.0
        elif numeric >= 3276.8:
            numeric -= 6553.6
        elif numeric >= 327.68:
            numeric -= 655.36
    return numeric


def _is_signed_16_point(
    name: str,
    data_type: int,
    signed16_markers: tuple[str, ...],
) -> bool:
    return data_type in (0, 1) and any(
        marker in name for marker in signed16_markers
    )


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        for fmt in ("%Y%m%d_%H%M%S", "%Y-%m-%d %H:%M:%S"):
            try:
                dt = datetime.strptime(text, fmt)
                break
            except ValueError:
                dt = None
        if dt is None:
            return None
    if dt.tzinfo is not None and dt.utcoffset() is not None:
        dt = dt.astimezone(BEIJING_TZ).replace(tzinfo=None)
    return dt


def _format_value(value: float | None) -> str:
    if value is None:
        return "无数据"
    if abs(value) >= 100:
        return f"{value:.1f}".rstrip("0").rstrip(".")
    return f"{value:.2f}".rstrip("0").rstrip(".")


def _iso_local(value: datetime) -> str:
    if value.tzinfo is not None and value.utcoffset() is not None:
        value = value.astimezone(BEIJING_TZ).replace(tzinfo=None)
    return value.replace(microsecond=0).isoformat()


def _safe_relative(path: Path, workspace: Path) -> str:
    try:
        return str(path.resolve().relative_to(workspace.resolve()))
    except ValueError:
        return str(path)


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _extract_doc_time(doc: dict[str, Any], path: Path) -> datetime:
    for field in ("collect_time", "window_end", "created_at"):
        parsed = _parse_datetime(doc.get(field))
        if parsed:
            return parsed
    fetch_metadata = doc.get("_fetchMetadata")
    if isinstance(fetch_metadata, dict):
        parsed = _parse_datetime(
            fetch_metadata.get("collectTimeEnd") or fetch_metadata.get("fetchedAt")
        )
        if parsed:
            return parsed
    return datetime.fromtimestamp(path.stat().st_mtime, tz=BEIJING_TZ).replace(tzinfo=None)


def _normalize_point(
    point: dict[str, Any],
    default_device: str = "",
    sample_time: str = "",
    signed16_markers: tuple[str, ...] = (),
) -> dict[str, Any]:
    name = (
        point.get("name")
        or point.get("pointName")
        or point.get("point_name")
        or point.get("pointKey")
        or point.get("point_key")
        or ""
    )
    device = (
        point.get("device")
        or point.get("deviceName")
        or point.get("device_name")
        or default_device
    )
    data_type = int(point.get("dataType") or point.get("data_type") or 0)
    value = _decode_api_numeric_value(
        point.get("value"),
        signed_16=_is_signed_16_point(str(name), data_type, signed16_markers),
    )
    return {
        "device": str(device),
        "name": str(name),
        "deviceDataId": str(
            point.get("deviceDataId")
            or point.get("device_data_id")
            or ""
        ),
        "pointDataId": str(
            point.get("pointDataId")
            or point.get("point_data_id")
            or ""
        ),
        "pointName": str(
            point.get("pointName")
            or point.get("point_name")
            or name
        ),
        "systemType": str(point.get("systemType") or point.get("system_type") or "").strip(),
        "dataType": data_type,
        "unit": str(point.get("unit") or ""),
        "value": value,
        "raw_value": point.get("raw_value"),
        "scale": _to_float(point.get("scale")),
        "register": str(point.get("register") or ""),
        "index": point.get("index"),
        "sample_time": sample_time,
        "legacyPointKey": str(
            point.get("legacyPointKey") or point.get("pointCode") or ""
        ),
    }


def _extract_points(
    doc: dict[str, Any],
    api_catalog: dict[tuple[str, str], dict[str, Any]] | None = None,
    signed16_markers: tuple[str, ...] = (),
) -> list[dict[str, Any]]:
    points: list[dict[str, Any]] = []
    collect_time = str(doc.get("collect_time") or doc.get("window_end") or doc.get("created_at") or "")

    if isinstance(doc.get("points"), list):
        for point in doc["points"]:
            if isinstance(point, dict):
                points.append(
                    _normalize_point(
                        point,
                        sample_time=collect_time,
                        signed16_markers=signed16_markers,
                    )
                )
        return points

    if isinstance(doc.get("pointDataList"), list):
        for record in doc["pointDataList"]:
            if not isinstance(record, dict):
                continue
            key = (
                str(record.get("deviceDataId") or ""),
                str(record.get("pointDataId") or ""),
            )
            metadata = (api_catalog or {}).get(key, {})
            merged = {**record, **metadata}
            points.append(
                _normalize_point(
                    merged,
                    sample_time=str(record.get("collectTime") or collect_time),
                    signed16_markers=signed16_markers,
                )
            )
        return points

    # Compatibility with the richer nested contract documented for future API use.
    for device in doc.get("devices", []) if isinstance(doc.get("devices"), list) else []:
        if not isinstance(device, dict):
            continue
        default_device = str(device.get("device_name") or device.get("device_id") or "")
        for sample in device.get("samples", []) if isinstance(device.get("samples"), list) else []:
            if not isinstance(sample, dict):
                continue
            sample_time = str(sample.get("timestamp") or collect_time)
            for point in sample.get("points", []) if isinstance(sample.get("points"), list) else []:
                if isinstance(point, dict):
                    points.append(
                        _normalize_point(
                            point,
                            default_device=default_device,
                            sample_time=sample_time,
                            signed16_markers=signed16_markers,
                        )
                    )

    return points


def _load_api_point_catalog(input_dir: Path) -> dict[tuple[str, str], dict[str, Any]]:
    try:
        workspace = input_dir.resolve().parents[1]
        profile, _ = load_ship_profile(workspace)
        payload = _load_json(workspace / profile["dataSource"]["pointMappingPath"])
    except (OSError, json.JSONDecodeError, IndexError):
        return {}
    point_list = payload.get("pointList") if isinstance(payload, dict) else None
    if not isinstance(point_list, list):
        return {}
    return {
        (str(item.get("deviceDataId") or ""), str(item.get("pointDataId") or "")): item
        for item in point_list
        if isinstance(item, dict)
        and item.get("deviceDataId") not in (None, "")
        and item.get("pointDataId") not in (None, "")
    }


def _load_system_type_mapping(workspace: Path) -> dict[int, str]:
    mapping = dict(DEFAULT_SYSTEM_TYPE_MAPPING)
    try:
        profile, _ = load_ship_profile(workspace)
        payload = _load_json(workspace / profile["dataSource"]["pointMappingPath"])
    except (OSError, json.JSONDecodeError):
        return mapping
    configured = payload.get("systemTypeMapping") if isinstance(payload, dict) else None
    if not isinstance(configured, dict):
        return mapping
    for key, value in configured.items():
        try:
            system_type = int(key)
        except (TypeError, ValueError):
            continue
        name = str(value or "").strip()
        if name:
            mapping[system_type] = name
    return mapping


def _extract_data_time_bounds(
    doc: dict[str, Any],
    points: list[dict[str, Any]],
    fallback: datetime,
) -> tuple[datetime, datetime]:
    sample_times: list[datetime] = []
    seen: set[str] = set()
    for point in points:
        sample_time = str(point.get("sample_time") or "").strip()
        if not sample_time or sample_time in seen:
            continue
        seen.add(sample_time)
        parsed = _parse_datetime(sample_time)
        if parsed is not None:
            sample_times.append(parsed)
    if sample_times:
        return min(sample_times), max(sample_times)

    fetch_metadata = doc.get("_fetchMetadata")
    if isinstance(fetch_metadata, dict):
        start = _parse_datetime(fetch_metadata.get("collectTimeStart"))
        end = _parse_datetime(fetch_metadata.get("collectTimeEnd"))
        if start is not None or end is not None:
            return start or end or fallback, end or start or fallback
    return fallback, fallback


def _analysis_time_window(
    raw_docs: list[dict[str, Any]],
) -> tuple[datetime | None, datetime | None]:
    if not raw_docs:
        return None, None
    starts = [item.get("window_start") or item["timestamp"] for item in raw_docs]
    ends = [item.get("window_end") or item["timestamp"] for item in raw_docs]
    return min(starts), max(ends)


def _discover_latest_raw_files(
    input_dir: Path,
    limit: int,
    signed16_markers: tuple[str, ...] = (),
) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    if not input_dir.exists():
        return candidates
    api_catalog = _load_api_point_catalog(input_dir)

    for path in input_dir.glob(RAW_FILE_GLOB):
        if not path.is_file():
            continue
        try:
            doc = _load_json(path)
            timestamp = _extract_doc_time(doc, path)
            points = _extract_points(doc, api_catalog, signed16_markers)
            window_start, window_end = _extract_data_time_bounds(
                doc, points, timestamp
            )
        except (OSError, json.JSONDecodeError):
            continue
        candidates.append(
            {
                "path": path,
                "doc": doc,
                "timestamp": timestamp,
                "window_start": window_start,
                "window_end": window_end,
                "points": points,
            }
        )

    candidates.sort(key=lambda item: (item["timestamp"], item["path"].stat().st_mtime, item["path"].name))
    return candidates[-max(limit, 1) :]


def _stats(values: list[float]) -> dict[str, float] | None:
    clean = [v for v in values if v is not None]
    if not clean:
        return None
    mean = statistics.fmean(clean)
    std = statistics.pstdev(clean) if len(clean) > 1 else 0.0
    cv = abs(std / mean * 100) if abs(mean) > 1e-9 else 0.0
    return {
        "count": float(len(clean)),
        "mean": mean,
        "min": min(clean),
        "max": max(clean),
        "delta": clean[-1] - clean[0] if len(clean) > 1 else 0.0,
        "cv": cv,
    }


def _find_first(points: list[dict[str, Any]], include: tuple[str, ...], exclude: tuple[str, ...] = ()) -> dict[str, Any] | None:
    for point in points:
        name = point["name"]
        if all(token in name for token in include) and not any(token in name for token in exclude):
            return point
    return None


def _numeric_values(points: list[dict[str, Any]], include: tuple[str, ...], exclude: tuple[str, ...] = ()) -> list[float]:
    values = []
    for point in points:
        name = point["name"]
        if all(token in name for token in include) and not any(token in name for token in exclude):
            value = point["value"]
            if value is not None:
                values.append(value)
    return values


def _range_text(values: list[float]) -> str:
    if not values:
        return "无数据"
    return f"{_format_value(min(values))}~{_format_value(max(values))}"


def _latest_points_by_device(raw_docs: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    if not raw_docs:
        return {}
    by_device: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for point in raw_docs[-1]["points"]:
        by_device[point["device"]].append(point)
    return dict(by_device)


def _point_value(points: list[dict[str, Any]], include: tuple[str, ...], exclude: tuple[str, ...] = ()) -> float | None:
    point = _find_first(points, include, exclude)
    return point["value"] if point else None


def _format_time(dt: datetime | None) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S") if dt else "无数据"


def _duration_text(start: datetime | None, end: datetime | None) -> str:
    if not start or not end:
        return "无数据"
    seconds = abs((end - start).total_seconds())
    if seconds < 60:
        return f"约 {int(seconds)} 秒"
    if seconds < 3600:
        return f"约 {seconds / 60:.0f} 分钟"
    if seconds < 86400:
        return f"约 {seconds / 3600:.1f} 小时"
    return f"约 {seconds / 86400:.1f} 天"


def _ordered_devices(device_names: list[str], preferred_order: list[str]) -> list[str]:
    known = [device for device in preferred_order if device in device_names]
    extras = sorted(device for device in device_names if device not in preferred_order)
    return known + extras


def _device_points_from_doc(doc_item: dict[str, Any], device: str) -> list[dict[str, Any]]:
    return [point for point in doc_item["points"] if point["device"] == device]


def _device_docs(raw_docs: list[dict[str, Any]], device: str) -> list[dict[str, Any]]:
    docs: list[dict[str, Any]] = []
    for item in raw_docs:
        points = _device_points_from_doc(item, device)
        grouped: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
        for point in points:
            grouped[str(point.get("sample_time") or "")].append(point)
        for sample_time, sample_points in grouped.items():
            timestamp = _parse_datetime(sample_time) or item["timestamp"]
            docs.append({"timestamp": timestamp, "points": sample_points})
    docs.sort(key=lambda item: item["timestamp"])
    return docs


def _series_values_for_device(
    docs: list[dict[str, Any]], include: tuple[str, ...], exclude: tuple[str, ...] = ()
) -> list[float]:
    values: list[float] = []
    for item in docs:
        point = _find_first(item["points"], include, exclude)
        if point and point["value"] is not None:
            values.append(point["value"])
    return values


def _latest_value_for_device(
    docs: list[dict[str, Any]], include: tuple[str, ...], exclude: tuple[str, ...] = ()
) -> float | None:
    if not docs:
        return None
    point = _find_first(docs[-1]["points"], include, exclude)
    return point["value"] if point else None


def _latest_unit_for_device(docs, include):
    point = _find_first(docs[-1]["points"], include) if docs else None
    return str(point.get("unit") or "（单位未提供）") if point else "（单位未提供）"


def _mean_from_series(values: list[float]) -> float | None:
    return statistics.fmean(values) if values else None


def _is_main_engine(device: str) -> bool:
    return device in ("主机", "左主机", "右主机")


def _is_generator(device: str) -> bool:
    return "发电机" in device


def _operating_values(device: str, docs: list[dict[str, Any]]) -> dict[str, float | None]:
    if _is_main_engine(device):
        rpm_series = _series_values_for_device(docs, ("主机转速",))
        load_series = _series_values_for_device(docs, ("主机负荷",))
        fuel_series = _series_values_for_device(docs, ("燃油指令",))
        if not fuel_series:
            fuel_series = _series_values_for_device(docs, ("油门齿条位置",))
    elif _is_generator(device):
        rpm_series = _series_values_for_device(docs, ("转速",))
        load_series = []
        fuel_series = []
    else:
        rpm_series = []
        load_series = []
        fuel_series = []

    return {
        "latest_rpm": rpm_series[-1] if rpm_series else None,
        "avg_rpm": _mean_from_series(rpm_series),
        "latest_load": load_series[-1] if load_series else None,
        "avg_load": _mean_from_series(load_series),
        "latest_fuel": fuel_series[-1] if fuel_series else None,
        "avg_fuel": _mean_from_series(fuel_series),
    }


def _operating_status(device: str, docs: list[dict[str, Any]]) -> str:
    values = _operating_values(device, docs)
    rpm = values["avg_rpm"] or 0.0
    load = values["avg_load"] or 0.0
    fuel = values["avg_fuel"] or 0.0
    if _is_main_engine(device) or _is_generator(device):
        return "running" if rpm > 0 or load > 0 or fuel > 0 else "stopped"
    return "monitoring"


def _clean_attention_name(name: str, device: str) -> str:
    cleaned = re.sub(r"^\d+--", "", name).strip()
    for prefix in (device, "1#主机", "2#主机"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix) :].strip("-_ ")
    cleaned = re.sub(
        r"(高限|低限|偏差|降负荷|停车)?报警$",
        "",
        cleaned,
    ).strip("-_ ")
    return cleaned or name


def _device_attention_items(
    device: str,
    docs: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not docs:
        return []
    latest = docs[-1]["points"]
    items: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    for point in latest:
        name = str(point.get("name") or "")
        value = point.get("value")
        if value is None or value < 0.5:
            continue
        if not any(token in name for token in ("报警", "故障", "异常")):
            continue
        level = (
            "abnormal"
            if any(token in name for token in ("停机", "停车", "降负荷", "故障"))
            else "warning"
        )
        part = _clean_attention_name(name, device)
        key = (level, part)
        if key not in seen:
            items.append(
                {
                    "level": level,
                    "part": part,
                    "system_type": str(point.get("systemType") or ""),
                    "point_ids": [str(point.get("pointDataId") or "")],
                }
            )
            seen.add(key)

    analog_rules = [
        {
            "include": ("冷却水", "温度"),
            "exclude": ("报警",),
            "maximum": 90.0,
            "level": "abnormal",
            "part": "冷却水温",
        },
        {
            "include": ("振动",),
            "exclude": ("报警",),
            "maximum": 4.5,
            "level": "warning",
            "part": "主机振动" if _is_main_engine(device) else "设备振动",
        },
    ]
    for rule in analog_rules:
        matches = [
            point
            for point in latest
            if all(token in str(point.get("name") or "") for token in rule["include"])
            and not any(
                token in str(point.get("name") or "")
                for token in rule["exclude"]
            )
            and point.get("value") is not None
            and point["value"] > rule["maximum"]
        ]
        if matches:
            key = (str(rule["level"]), str(rule["part"]))
            if key not in seen:
                system_types = [
                    str(point.get("systemType") or "") for point in matches
                    if str(point.get("systemType") or "")
                ]
                items.append(
                    {
                        "level": key[0],
                        "part": key[1],
                        "system_type": system_types[0] if system_types else "",
                        "point_ids": list(
                            dict.fromkeys(
                                str(point.get("pointDataId") or "")
                                for point in matches
                                if str(point.get("pointDataId") or "")
                            )
                        ),
                    }
                )
                seen.add(key)

    return items[:8]


def _device_health_status(
    device: str,
    docs: list[dict[str, Any]],
    attention_items: list[dict[str, str]],
    event_count: int,
) -> str:
    if event_count > 0:
        return "abnormal"
    if any(item["level"] == "abnormal" for item in attention_items):
        return "abnormal"
    if attention_items:
        return "warning"
    if not docs or _operating_status(device, docs) == "stopped":
        return "unknown"
    return "normal"


def _device_health_score(
    health_status: str,
    attention_items: list[dict[str, str]],
    event_count: int,
) -> float | None:
    if health_status == "unknown":
        return None
    abnormal_count = sum(item["level"] == "abnormal" for item in attention_items)
    abnormal_count = max(abnormal_count, int(event_count > 0))
    warning_count = sum(item["level"] == "warning" for item in attention_items)
    return float(max(0, 100 - abnormal_count * 20 - warning_count * 10))


def _device_health_label(health_status: str) -> str:
    return {
        "normal": "状态良好",
        "warning": "需要关注",
        "abnormal": "存在异常",
        "unknown": "暂无法评价",
    }[health_status]


def _operating_condition(device: str, docs: list[dict[str, Any]]) -> str:
    return {
        "running": "运行中",
        "stopped": "停机",
        "monitoring": "状态监测",
    }[_operating_status(device, docs)]


def _device_analysis_conclusion(
    device: str,
    health_status: str,
    abnormal_parts: list[str],
    event_count: int,
    highlighted_systems: list[str],
) -> str:
    system_sentence = (
        f"重点关注系统：{'、'.join(highlighted_systems)}。"
        if highlighted_systems
        else ""
    )
    if event_count > 0:
        if abnormal_parts:
            parts = "、".join(abnormal_parts)
            return (
                f"{device}当前存在{event_count}个未闭环活跃事件，"
                f"本次分析归纳的关注点为：{parts}。"
                f"{system_sentence}"
                "活跃事件本身不能被当前瞬时值替代，建议结合事件趋势、现场工况和排查记录完成闭环。"
            )
        return (
            f"{device}当前存在{event_count}个未闭环活跃事件；"
            "本次结构化传感器检查未发现额外超限项，"
            f"{system_sentence}仍需优先完成事件排查和闭环。"
        )
    if health_status == "unknown":
        return f"{device}当前缺少可用于运行健康评价的有效工况，暂不形成健康结论。"
    if health_status == "normal":
        return f"{device}本次健康检查未检测到激活的报警、故障或结构化超限项。{system_sentence}"
    parts = "、".join(abnormal_parts) or "设备状态"
    if health_status == "abnormal":
        return f"{device}当前存在异常，重点关注{parts}；{system_sentence}建议尽快现场复核并按需进入排查流程。"
    return f"{device}存在需要关注的状态，重点关注{parts}；{system_sentence}建议结合趋势和现场工况确认是否持续。"


def _device_recommendations(
    device: str,
    health_status: str,
    abnormal_parts: list[str],
    event_count: int,
) -> list[str]:
    if event_count > 0:
        parts = "、".join(abnormal_parts)
        sensor_action = (
            f"复核关注点（{parts}）关联的传感器趋势和现场状态，确认是否持续。"
            if parts
            else "复核活跃事件关联测点的当前值，确认报警或异常是否持续。"
        )
        return [
            f"优先进入并完成与{device}相关的{event_count}个活跃事件排查，逐项记录反馈和闭环状态。",
            sensor_action,
            "对比事件发生前后的历史趋势，并记录现场工况与排查结果。",
        ]
    if health_status == "unknown":
        return ["确认数据采集和设备工况后，重新执行设备健康检查。"]
    if health_status == "normal":
        return ["继续按计划监测关键温度、压力、转速和振动趋势。"]
    parts = "、".join(abnormal_parts) or "异常项"
    return [
        f"复核{parts}对应的传感器当前值和状态，确认是否持续。",
        "对比历史趋势，并记录现场工况与排查结果。",
        "必要时通知维修人员，按照相关 SOP 进入排查流程。",
    ]


def _manual_system_type_aliases(workspace: Path) -> dict[str, list[str]]:
    """Use this ship's declared numeric types; never borrow another ship's IDs."""
    path = workspace / ".claude/skills/ship-engine-health/data/system-profiles.json"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    aliases = payload.get("system_aliases") if isinstance(payload, dict) else None
    if not isinstance(aliases, list):
        return {}
    mapping: dict[str, list[str]] = {}
    for alias in aliases:
        if not isinstance(alias, dict):
            continue
        system_id = str(alias.get("system_id") or "").strip()
        declared = alias.get("system_types")
        if not system_id or not isinstance(declared, list):
            continue
        numeric_types = mapping.setdefault(system_id, [])
        for value in declared:
            try:
                numeric = str(int(str(value)))
            except (TypeError, ValueError):
                continue
            if numeric not in numeric_types:
                numeric_types.append(numeric)
    return mapping


def _event_system_types(event: dict[str, Any], aliases: dict[str, list[str]]) -> list[str]:
    values = event.get("systemTypes") or [event.get("systemType")]
    if not isinstance(values, list):
        values = [values]
    systems: list[str] = []
    for value in values:
        # Unknown symbolic IDs stay visible internally, while the existing
        # numeric health contract omits their unsupported system highlights.
        system_id = str(value or "").strip()
        for system_type in aliases.get(system_id, [system_id]):
            if system_type and system_type not in systems:
                systems.append(system_type)
    return systems


def _active_events_by_device(workspace: Path) -> dict[str, list[dict[str, Any]]]:
    events_by_device: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    seen_event_ids: set[str] = set()
    system_aliases = _manual_system_type_aliases(workspace)
    for relative_path in ACTIVE_EVENT_INDEXES:
        path = workspace / relative_path
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        events = payload.get("events") if isinstance(payload, dict) else None
        if not isinstance(events, list):
            continue
        for event in events:
            if not isinstance(event, dict) or event.get("status") == "closed":
                continue
            event_id = str(event.get("event_id") or "").strip()
            device_name = str(event.get("equipment_name") or "").strip()
            if not event_id or not device_name or event_id in seen_event_ids:
                continue
            seen_event_ids.add(event_id)
            title = next(
                (
                    str(event.get(field) or "").strip()
                    for field in ("event_title", "anomaly_type", "alarm_name")
                    if str(event.get(field) or "").strip()
                ),
                f"未闭环事件（{event_id}）",
            )
            events_by_device[device_name].append(
                {
                    "event_id": event_id,
                    "title": title,
                    "system_type": str(event.get("systemType") or ""),
                    "system_types": _event_system_types(event, system_aliases),
                }
            )
    return dict(events_by_device)


def _analysis_highlights(
    active_events: list[dict[str, Any]],
    attention_items: list[dict[str, Any]],
    system_type_mapping: dict[int, str],
) -> list[dict[str, Any]]:
    grouped: dict[int, list[dict[str, str]]] = defaultdict(list)
    for event in active_events:
        for value in event.get("system_types") or [event.get("system_type")]:
            try:
                system_type = int(value or 0)
            except (TypeError, ValueError):
                continue
            if system_type <= 0 or system_type not in system_type_mapping:
                continue
            grouped[system_type].append(
                {
                    "source": "active_event",
                    "id": str(event["event_id"]),
                    "label": str(event["title"]),
                }
            )
    for item in attention_items:
        try:
            system_type = int(item.get("system_type") or 0)
        except (TypeError, ValueError):
            continue
        if system_type <= 0 or system_type not in system_type_mapping:
            continue
        point_ids = item.get("point_ids") or []
        if point_ids:
            grouped[system_type].extend(
                {
                    "source": "sensor_point",
                    "id": str(point_id),
                    "label": str(item["part"]),
                }
                for point_id in point_ids
            )
        else:
            grouped[system_type].append(
                {"source": "sensor_point", "id": "unmapped", "label": str(item["part"])}
            )
    highlights: list[dict[str, Any]] = []
    for system_type in sorted(grouped):
        evidence = list(
            {
                (item["source"], item["id"], item["label"]): item
                for item in grouped[system_type]
            }.values()
        )
        system_name = system_type_mapping[system_type]
        labels = "、".join(dict.fromkeys(item["label"] for item in evidence))
        highlights.append(
            {
                "systemType": system_type,
                "system_name": system_name,
                "analysis_conclusion": f"{system_name}存在需关注证据：{labels}。",
                "possible_causes": SYSTEM_POSSIBLE_CAUSES.get(
                    system_type,
                    ["关联部件、工况或传感器状态需要现场复核"],
                ),
                "evidence": evidence,
            }
        )
    return highlights


def _build_device_result(
    device: str,
    docs: list[dict[str, Any]],
    *,
    active_events: list[dict[str, Any]],
    system_type_mapping: dict[int, str],
    key_device_names: set[str],
) -> dict[str, Any]:
    event_count = len(active_events)
    device_data_ids = {
        str(point.get("deviceDataId") or "").strip()
        for doc in docs
        for point in doc.get("points", [])
        if isinstance(point, dict)
        and str(point.get("deviceDataId") or "").strip()
    }
    if len(device_data_ids) != 1:
        raise ValueError(
            f"{device} must resolve exactly one deviceDataId from the configured point mapping; "
            f"resolved={sorted(device_data_ids)}"
        )
    attention_items = _device_attention_items(device, docs)
    health_status = _device_health_status(
        device,
        docs,
        attention_items,
        event_count,
    )
    event_attention = [item["title"] for item in active_events]
    sensor_attention = [item["part"] for item in attention_items]
    abnormal_parts = list(dict.fromkeys(event_attention + sensor_attention))[:3]
    analysis_highlights = _analysis_highlights(
        active_events,
        attention_items,
        system_type_mapping,
    )
    highlighted_systems = [item["system_name"] for item in analysis_highlights]
    return {
        "deviceDataId": next(iter(device_data_ids)),
        "device_name": device,
        "event_count": event_count,
        "status": _operating_status(device, docs),
        "data_quality": (
            "available"
            if any(item.get("points") for item in docs)
            else "insufficient"
        ),
        "is_key_device": device in key_device_names,
        "health_status": health_status,
        "health_score": _device_health_score(
            health_status,
            attention_items,
            event_count,
        ),
        "health_label": _device_health_label(health_status),
        "operating_condition": _operating_condition(device, docs),
        "abnormal_parts": abnormal_parts,
        "analysis_highlights": analysis_highlights,
        "analysis_conclusion": _device_analysis_conclusion(
            device,
            health_status,
            abnormal_parts,
            event_count,
            highlighted_systems,
        ),
        "recommendations": _device_recommendations(
            device,
            health_status,
            abnormal_parts,
            event_count,
        ),
        "context": _build_device_context(device, docs, event_count),
    }


def _temperature_range(points: list[dict[str, Any]], keywords: tuple[str, ...]) -> str:
    values = []
    for keyword in keywords:
        values.extend(_numeric_values(points, (keyword,), ("偏差", "降负荷")))
    return _range_text(values)


def _device_conclusion(
    device: str,
    docs: list[dict[str, Any]],
    event_count: int,
) -> str:
    status = _operating_status(device, docs)
    values = _operating_values(device, docs)
    rpm = _format_value(values["avg_rpm"])
    load = _format_value(values["avg_load"])
    fuel = _format_value(values["avg_fuel"])

    if event_count > 0:
        if status == "running":
            return (
                f"**{device}当前存在{event_count}个未闭环活跃事件。** "
                f"设备处于运行状态，平均转速 {rpm} RPM、平均负荷 {load}%；"
                "需优先完成事件排查和闭环。"
            )
        if status == "stopped":
            return (
                f"**{device}当前存在{event_count}个未闭环活跃事件。** "
                "设备虽处于停机状态，仍需核实现有事件并完成闭环。"
            )
        return (
            f"**{device}当前存在{event_count}个未闭环活跃事件。** "
            "需结合状态量和现场情况完成事件排查。"
        )
    if status == "stopped":
        if _is_main_engine(device):
            return f"**{device}处于停机状态。** 转速为 {rpm} RPM，负荷为 {load}%，燃油指令为 {fuel}%，无需进行运行健康分析。"
        return f"**{device}处于停机状态。** 转速为 {rpm} RPM，设备未运行，无需进行运行健康分析。"
    if status == "running":
        if _is_main_engine(device):
            return f"**{device}处于运行状态。** 平均转速 {rpm} RPM，平均负荷 {load}%，本次按运行态检查关键温度、压力和均衡性。"
        return f"**{device}处于运行状态。** 平均转速 {rpm} RPM，本次按运行态检查关键温度和压力。"
    return f"**{device}完成状态观察。** 本设备以状态量监测为主，当前未形成运行态健康结论。"


def _device_running_info(device: str, docs: list[dict[str, Any]]) -> list[str]:
    if not docs:
        return ["- 无可用数据。"]
    start = docs[0]["timestamp"]
    end = docs[-1]["timestamp"]
    values = _operating_values(device, docs)
    lines = [
        f"- 数据时间范围：{_format_time(start)} ~ {_format_time(end)}（跨度{_duration_text(start, end)}）",
        f"- 最后采集时刻：{_format_time(end)}",
    ]
    if _is_main_engine(device):
        lines.extend(
            [
                f"- 平均转速：{_format_value(values['avg_rpm'])} RPM",
                f"- 平均负荷：{_format_value(values['avg_load'])}%",
                f"- 平均燃油指令：{_format_value(values['avg_fuel'])}%",
            ]
        )
    elif _is_generator(device):
        lines.append(f"- 平均转速：{_format_value(values['avg_rpm'])} RPM")
    else:
        lines.append("- 本设备按状态量观察，暂无转速/负荷类运行指标。")
    return lines


def _main_engine_environment_lines(device: str, docs: list[dict[str, Any]]) -> list[str]:
    latest = docs[-1]["points"]
    exhaust = _temperature_range(latest, ("排气温度",))
    jacket = _temperature_range(latest, ("冷却淡水出口温度", "气缸套温度"))
    bearing = _temperature_range(latest, ("轴承温度",))
    start_air = _latest_value_for_device(docs, ("起动空气压力",))
    fuel_pressure = _latest_value_for_device(docs, ("燃油进", "压力"))
    fuel_temp = _latest_value_for_device(docs, ("燃油进", "温度"))
    lube_pressure = _latest_value_for_device(docs, ("滑油进", "压力"))
    lube_temp = _latest_value_for_device(docs, ("滑油进", "温度"))

    lines = [
        f"- 各缸排气温度范围 {exhaust}°C。",
        f"- 缸套冷却水出口温度范围 {jacket}°C，轴承相关温度测点范围 {bearing}°C。",
        f"- 起动空气压力约 {_format_value(start_air)} {_latest_unit_for_device(docs, ('起动空气压力',))}。",
        f"- 燃油进口压力 {_format_value(fuel_pressure)} {_latest_unit_for_device(docs, ('燃油进', '压力'))}，燃油进口温度 {_format_value(fuel_temp)}°C。",
        f"- 滑油进机压力 {_format_value(lube_pressure)} {_latest_unit_for_device(docs, ('滑油进', '压力'))}，滑油进机温度 {_format_value(lube_temp)}°C。",
        "- 无 AIS 位置信息。",
    ]
    return lines


def _generator_environment_lines(device: str, docs: list[dict[str, Any]]) -> list[str]:
    latest = docs[-1]["points"]
    temp = _temperature_range(latest, ("温度",))
    pressure_values = _numeric_values(latest, ("压力",))
    voltage_values = _numeric_values(latest, ("电压",))
    current_values = _numeric_values(latest, ("电流",))
    lines = [f"- 温度类点位范围 {temp}°C。"]
    if pressure_values:
        lines.append(f"- 压力类点位范围 {_range_text(pressure_values)} bar。")
    if voltage_values:
        lines.append(f"- 电压类点位范围 {_range_text(voltage_values)} V。")
    if current_values:
        lines.append(f"- 电流类点位范围 {_range_text(current_values)} A。")
    lines.append("- 无 AIS 位置信息。")
    return lines


def _generic_environment_lines(device: str, docs: list[dict[str, Any]]) -> list[str]:
    latest = docs[-1]["points"]
    temp = _temperature_range(latest, ("温度",))
    pressure = _numeric_values(latest, ("压力",))
    lines = []
    if temp != "无数据":
        lines.append(f"- 温度类点位范围 {temp}°C。")
    if pressure:
        lines.append(f"- 压力类点位范围 {_range_text(pressure)} bar。")
    if not lines:
        lines.append("- 当前以状态量采集为主，未形成可直接判读的温度/压力概况。")
    lines.append("- 无 AIS 位置信息。")
    return lines


def _device_environment_lines(device: str, docs: list[dict[str, Any]]) -> list[str]:
    if not docs:
        return ["- 无可用数据。"]
    if _is_main_engine(device):
        return _main_engine_environment_lines(device, docs)
    if _is_generator(device):
        return _generator_environment_lines(device, docs)
    return _generic_environment_lines(device, docs)


def _changed_point_lines(device: str, docs: list[dict[str, Any]], limit: int = 3) -> list[str]:
    series: dict[str, list[float]] = defaultdict(list)
    for item in docs:
        for point in item["points"]:
            value = point["value"]
            if value is not None:
                series[point["name"]].append(value)

    changed = []
    for name, values in series.items():
        stat = _stats(values)
        if not stat or stat["count"] < 2 or abs(stat["delta"]) <= 0:
            continue
        if any(token in name for token in ("温度", "压力", "转速", "负荷", "油门")):
            changed.append((abs(stat["delta"]), name, stat))
    changed.sort(reverse=True, key=lambda item: item[0])
    lines = []
    for _, name, stat in changed[:limit]:
        lines.append(
            f"- {name}：范围 {_format_value(stat['min'])}~{_format_value(stat['max'])}，首末变化 {_format_value(stat['delta'])}。"
        )
    return lines


def _device_remark_lines(device: str, docs: list[dict[str, Any]]) -> list[str]:
    status = _operating_status(device, docs)
    lines: list[str] = []
    if status == "stopped":
        lines.append("- 当前为非运行状态，无需展开运行健康分析；后续有转速或负荷后再进行物理关系判断。")
    elif status == "monitoring":
        lines.append("- 当前以状态观察为主，未形成需要立即处置的健康建议。")
    else:
        changed = _changed_point_lines(device, docs)
        lines.extend(changed or ["- 本窗口内未发现明显首末变化点。"])
    if not lines:
        lines.append("- 本次未形成额外处置建议。")
    return lines


def _build_device_context(
    device: str,
    docs: list[dict[str, Any]],
    event_count: int,
) -> str:
    sections = [
        "## 结论",
        "",
        _device_conclusion(device, docs, event_count),
        "",
        "## 运行信息",
        "",
        *_device_running_info(device, docs),
        "",
        "## 环境状态",
        "",
        *_device_environment_lines(device, docs),
        "",
        "## 备注",
        "",
        *_device_remark_lines(device, docs),
    ]
    return "\n".join(sections).strip() + "\n"


def _overall_environment_lines(raw_docs: list[dict[str, Any]]) -> list[str]:
    by_device = _latest_points_by_device(raw_docs)
    left = by_device.get("左主机", [])
    right = by_device.get("右主机", [])
    lines: list[str] = []
    if left and right:
        left_exhaust = _numeric_values(left, ("排气温度",), ("偏差", "平均"))
        right_exhaust = _numeric_values(right, ("排气温度",), ("偏差", "平均"))
        lines.append(f"- 左主机排气温度范围 {_range_text(left_exhaust)}°C，右主机排气温度范围 {_range_text(right_exhaust)}°C。")
        lines.append(
            f"- 左主机起动空气压力 {_format_value(_point_value(left, ('起动空气压力',)))} bar，"
            f"右主机起动空气压力 {_format_value(_point_value(right, ('起动空气压力',)))} bar。"
        )
    if not lines:
        lines.append("- 本次未形成可汇总的环境状态描述。")
    lines.append("- 无 AIS 位置信息。")
    return lines


def _overall_running_info_lines(raw_docs: list[dict[str, Any]], device_names: list[str]) -> list[str]:
    start, end = _analysis_time_window(raw_docs)
    assert start is not None and end is not None
    lines = [
        f"- 数据时间范围：{_format_time(start)} ~ {_format_time(end)}（跨度{_duration_text(start, end)}）",
        f"- 最后采集时刻：{_format_time(end)}",
    ]

    main_parts = []
    for device in ("左主机", "右主机"):
        docs = _device_docs(raw_docs, device)
        if not docs:
            continue
        values = _operating_values(device, docs)
        main_parts.append(
            f"{device}平均转速 {_format_value(values['avg_rpm'])} RPM、平均负荷 {_format_value(values['avg_load'])}%"
        )
    if main_parts:
        lines.append(f"- 主推进状态：{'；'.join(main_parts)}。")

    generator_names = [device for device in device_names if _is_generator(device)]
    generator_statuses = [
        _operating_status(device, _device_docs(raw_docs, device))
        for device in generator_names
    ]
    if generator_statuses:
        if all(status == "stopped" for status in generator_statuses):
            lines.append("- 发电设备状态：柴油发电机组未见运行转速。")
        elif any(status == "running" for status in generator_statuses):
            lines.append("- 发电设备状态：存在运行中的柴油发电机组，需关注温度、压力和电参量。")

    auxiliary_count = sum(1 for device in device_names if not _is_main_engine(device) and not _is_generator(device))
    if auxiliary_count:
        lines.append("- 辅助系统状态：配电、燃油调拨等设备按状态量观察。")
    return lines


def _build_overall_context(
    raw_docs: list[dict[str, Any]],
    devices: dict[str, dict[str, Any]],
    preferred_device_order: list[str],
) -> str:
    if not raw_docs:
        return (
            "## 结论\n\n"
            "**未获取到可分析的传感器原始数据。** 本次无法形成设备健康结论。\n\n"
            "## 运行信息\n\n"
            "- 未获得本次健康检查所需的传感器数据。\n\n"
            "## 环境状态\n\n"
            "- 无可用环境或设备状态。\n\n"
            "## 备注\n\n"
            "- 建议确认数据采集链路后重新触发健康检查。\n"
        )

    by_device = _latest_points_by_device(raw_docs)
    device_names = _ordered_devices(list(by_device), preferred_device_order)
    statuses = {
        device: _operating_status(device, _device_docs(raw_docs, device))
        for device in device_names
    }
    stopped = [device for device, status in statuses.items() if status == "stopped"]
    running = [device for device, status in statuses.items() if status == "running"]
    monitoring = [device for device, status in statuses.items() if status == "monitoring"]
    active_event_count = sum(
        int(item.get("event_count") or 0)
        for item in devices.values()
    )
    active_event_devices = [
        device
        for device, item in devices.items()
        if int(item.get("event_count") or 0) > 0
    ]
    if active_event_count:
        conclusion = (
            f"**设备健康检查发现{active_event_count}个未闭环活跃事件，"
            f"涉及{'、'.join(active_event_devices)}。** "
            "应优先完成相关事件排查和闭环。"
        )
    elif running:
        conclusion = "**设备健康检查已完成。** 存在运行状态设备，建议关注运行设备的温度、压力和电参量。"
    elif stopped:
        conclusion = "**主要动力设备处于非运行状态。** 本次按停机或状态监测记录。"
    else:
        conclusion = "**设备健康检查已完成。** 当前以状态观察为主，未形成运行态健康结论。"

    lines = [
        "## 结论",
        "",
        conclusion,
        "",
        "## 运行信息",
        "",
        *_overall_running_info_lines(raw_docs, device_names),
        "",
        "## 环境状态",
        "",
    ]
    lines.extend(_overall_environment_lines(raw_docs))
    lines.extend(["", "## 备注", ""])
    if active_event_count:
        lines.append("- 活跃事件优先级高于本次结构化传感器检查的正常结果，不得据此将相关设备判为正常。")
    if stopped:
        lines.append("- 停机设备不展开运行健康分析；待转速、负荷或发电机转速恢复后再进行运行态物理关系判断。")
    if monitoring:
        lines.append("- 部分辅助系统未包含转速/负荷指标，按状态量观察即可。")
    if not stopped and not monitoring:
        lines.append("- 本次未形成额外处置建议。")
    return "\n".join(lines).strip() + "\n"


def _run_configured_physical_analysis(
    raw_docs: list[dict[str, Any]],
    workspace: Path,
) -> tuple[dict[str, Any] | None, str, str]:
    """Run the configured health analyzer while keeping pointDataList as public input."""
    profile, _ = load_ship_profile(workspace)
    analyzer = primary_analyzer(profile)
    config = analyzer_profile(profile, analyzer)
    health_target = str(config.get("healthEntrypoint") or "").strip()
    target_device_name = next(
        (
            str(device["deviceName"])
            for device in profile["devices"].values()
            if analyzer in device["analyzers"]
        ),
        "",
    )
    if not health_target:
        return None, analyzer, target_device_name
    analyze_health = import_entrypoint(
        health_target,
        search_paths=[SKILL_DIR],
    )
    canonical = config["canonicalInput"]
    samples: defaultdict[str, dict[str, Any]] = defaultdict(dict)
    for doc in raw_docs:
        for point in doc.get("points", []):
            sample_time = str(point.get("sample_time") or "").strip()
            legacy_key = str(point.get("legacyPointKey") or "").strip()
            value = point.get("value")
            if sample_time and legacy_key.startswith("DC") and value is not None:
                samples[sample_time][legacy_key] = value
    if not samples:
        return None, analyzer, target_device_name

    rows = []
    for index, sample_time in enumerate(
        sorted(samples, key=lambda value: _parse_datetime(value) or datetime.min)
    ):
        sensors = [
            {"key": key, "value": str(value)}
            for key, value in sorted(samples[sample_time].items())
        ]
        rows.append(
            {
                "imoNumber": canonical["shipIdentifier"],
                "terminalTime": sample_time,
                "transId": f"canonical-health-{index}",
                "sensorList": [
                    {
                        "serialNumber": canonical["deviceSerialNumber"],
                        "sensorList": sensors,
                    }
                ],
                "asi": {},
            }
        )

    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".json",
            prefix="ship-health-analyzer-",
            encoding="utf-8",
            delete=False,
        ) as handle:
            json.dump(
                {"serialNumber": canonical["serialNumber"], "data": rows},
                handle,
                ensure_ascii=False,
            )
            temp_path = Path(handle.name)
        result = analyze_health(temp_path, full_output=True)
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
    return (result if isinstance(result, dict) else None), analyzer, target_device_name


def _configured_physical_context(payload: dict[str, Any], analyzer: str) -> str:
    lines = [
        "## 设备物理关系分析",
        "",
        "- 本节依据采样数据计算设备工况和物理关系。",
        f"- 有效样本：{int(payload.get('dataPoints') or 0)}；运行状态：{dict(stopped='停机',running='运行').get(payload.get('operatingStatus'),'尚不明确')}；工况：{dict(cruise='巡航',maneuver_high='较高转速操纵',maneuver_mid='中等转速操纵').get(payload.get('operatingMode'),'不适用或尚不明确')}。",
        f"- 平均转速：{_format_value(_to_float(payload.get('avgRpm')))} RPM；平均燃油指令：{_format_value(_to_float(payload.get('avgFuelIndex')))}%。",
    ]
    balances = payload.get("cylinderBalance")
    if isinstance(balances, list) and balances:
        lines.extend(["", "### 缸间均衡", ""])
        for item in balances[:5]:
            if not isinstance(item, dict):
                continue
            lines.append(
                "- "
                f"{item.get('group') or '未命名组'}：缸间 CV "
                f"{_format_value(_to_float(item.get('interCylinderCV')))}%，"
                f"最大偏离点 {item.get('worstCylinder') or '无数据'}，"
                f"偏离 {_format_value(_to_float(item.get('worstDeviation')))}。"
            )
    relations = payload.get("physicalRelationships")
    if isinstance(relations, dict) and relations:
        labels = {
            "rpm_to_turbocharger": "转速—增压器转速关系",
            "exhaust_temp_level": "转速—排温关系",
            "scavenge_vs_rpm": "转速—扫气压力关系",
            "fuel_vs_exhaust": "燃油指令—排温关系",
            "cooling_water_delta": "缸套水进出口温差",
            "piston_cooling_oil": "活塞冷却油温差",
            "turbocharger_exhaust_delta": "增压器前后排温差",
            "fuel_type": "燃油温度关系",
        }
        lines.extend(["", "### 物理关系", ""])
        for key, label in labels.items():
            item = relations.get(key)
            if not isinstance(item, dict):
                continue
            numeric = [
                f"{name}={_format_value(_to_float(value))}"
                for name, value in item.items()
                if name != "note" and isinstance(value, (int, float))
            ]
            if numeric:
                lines.append(f"- {label}：{'，'.join(numeric)}。")
    lines.extend(
        [
            "",
            "> 这些关系用于工况、缸间均衡和物理一致性解释，不替代 OEM 阈值报警，也不单独创建事件。",
        ]
    )
    return "\n".join(lines)


def _build_result_payload(
    raw_docs: list[dict[str, Any]],
    *,
    workspace: Path,
    created_at: datetime,
    expected_file_count: int,
    active_events_by_device: dict[str, list[dict[str, Any]]] | None = None,
    system_type_mapping: dict[int, str] | None = None,
) -> dict[str, Any]:
    active_events_by_device = active_events_by_device or {}
    system_type_mapping = system_type_mapping or dict(DEFAULT_SYSTEM_TYPE_MAPPING)
    profile, _ = load_ship_profile(workspace)
    preferred_device_order = [
        str(device["deviceName"]) for device in profile["devices"].values()
    ]
    key_device_names = {
        str(device["deviceName"])
        for device in profile["devices"].values()
        if device["keyDevice"]
    }
    physical_health, analyzer, target_device_name = _run_configured_physical_analysis(
        raw_docs, workspace
    )
    device_names = (
        _ordered_devices(
            list(_latest_points_by_device(raw_docs)),
            preferred_device_order,
        )
        if raw_docs
        else []
    )
    devices = {
        device: _build_device_result(
            device,
            device_docs,
            active_events=active_events_by_device.get(device, []),
            system_type_mapping=system_type_mapping,
            key_device_names=key_device_names,
        )
        for device in device_names
        for device_docs in [_device_docs(raw_docs, device)]
    }
    if physical_health and target_device_name in devices:
        device = devices[target_device_name]
        device["analysis_conclusion"] = (
            f"{device['analysis_conclusion']} "
            f"配置分析器已计算{int(physical_health.get('dataPoints') or 0)}个样本的工况、缸间均衡和物理关系；"
            "这些关系不作为独立阈值报警。"
        )
        device["context"] = (
            device["context"].rstrip()
            + "\n\n"
            + _configured_physical_context(physical_health, analyzer)
            + "\n"
        )
    if raw_docs:
        raw_start, raw_end = _analysis_time_window(raw_docs)
        assert raw_start is not None and raw_end is not None
        physical_range = (
            physical_health.get("timeRange", {})
            if isinstance(physical_health, dict)
            else {}
        )
        start = _parse_datetime(physical_range.get("start")) or raw_start
        end = _parse_datetime(physical_range.get("end")) or raw_end
        duration_hours = round(max(0.0, (end - start).total_seconds() / 3600), 4)
        start_time: str | None = _iso_local(start)
        end_time: str | None = _iso_local(end)
    else:
        start_time = None
        end_time = None
        duration_hours = 0.0
    used_file_count = len(raw_docs)
    quality_status = (
        "insufficient"
        if used_file_count == 0
        else "sufficient"
        if used_file_count >= expected_file_count
        else "partial"
    )
    return {
        "generated_at": _iso_local(created_at),
        "analysis_window": {
            "start_time": start_time,
            "end_time": end_time,
            "duration_hours": duration_hours,
        },
        "data_quality": {
            "status": quality_status,
            "used_file_count": used_file_count,
            "expected_file_count": expected_file_count,
            "available_device_count": len(devices),
        },
        "overview": {
            "key_device_count": sum(
                item["is_key_device"] for item in devices.values()
            ),
            "total_device_count": len(devices),
            "abnormal_count": sum(
                item["health_status"] == "abnormal" for item in devices.values()
            ),
            "warning_count": sum(
                item["health_status"] == "warning" for item in devices.values()
            ),
        },
        "context": _build_overall_context(
            raw_docs,
            devices,
            preferred_device_order,
        ),
        "devices": devices,
    }


def _cleanup_old_outputs(output_dir: Path, now: datetime) -> list[str]:
    local_now = _parse_datetime(now)
    if local_now is None:
        raise ValueError("cleanup time must be a valid Beijing local timestamp")
    cutoff = local_now - timedelta(hours=OUTPUT_RETENTION_HOURS)
    removed: list[str] = []
    if not output_dir.exists():
        return removed

    outputs: list[tuple[datetime, Path]] = []
    for path in output_dir.glob("engine-health-*__result.json"):
        if not path.is_file():
            continue
        match = RESULT_FILE_RE.match(path.name)
        file_time = None
        if match:
            file_time = _parse_datetime(match.group(1))
        if file_time is None:
            file_time = datetime.fromtimestamp(path.stat().st_mtime, tz=BEIJING_TZ).replace(tzinfo=None)
        outputs.append((file_time, path))

    outputs.sort(key=lambda item: (item[0], item[1].name))
    remaining_count = len(outputs)
    for file_time, path in outputs:
        is_expired = file_time < cutoff
        exceeds_file_limit = remaining_count > OUTPUT_PROTECTED_FILE_COUNT
        if not is_expired and not exceeds_file_limit:
            continue
        if remaining_count <= OUTPUT_PROTECTED_FILE_COUNT:
            break
        path.unlink()
        removed.append(str(path))
        remaining_count -= 1
    return removed


def run(workspace: Path, input_dir: Path, output_dir: Path, limit: int, created_at: datetime) -> dict[str, Any]:
    workspace = workspace.resolve()
    input_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    profile, _ = load_ship_profile(workspace)
    configured_analyzer = primary_analyzer(profile)
    signed16_markers = tuple(
        analyzer_profile(profile, configured_analyzer)["signed16PointNameMarkers"]
    )
    raw_docs = _discover_latest_raw_files(input_dir, limit, signed16_markers)
    result_payload = _build_result_payload(
        raw_docs,
        workspace=workspace,
        created_at=created_at,
        expected_file_count=max(limit, 1),
        active_events_by_device=_active_events_by_device(workspace),
        system_type_mapping=_load_system_type_mapping(workspace),
    )

    result_path = output_dir / f"engine-health-{created_at.strftime('%Y%m%d_%H%M%S')}__result.json"
    _validate_result_schema(result_payload)
    result_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = result_path.with_suffix(result_path.suffix + ".tmp")
    temporary.write_text(json.dumps(result_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(result_path)

    removed = _cleanup_old_outputs(output_dir, created_at)
    return {
        "ok": True,
        "result_path": _safe_relative(result_path, workspace),
        "used_raw_data_files": [_safe_relative(item["path"], workspace) for item in raw_docs],
        "used_file_count": len(raw_docs),
        "removed_expired_outputs": [_safe_relative(Path(path), workspace) for path in removed],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run ship-engine-health.")
    parser.add_argument("--workspace", default=".", help="Workspace root. Defaults to current directory.")
    parser.add_argument(
        "--input-dir",
        default=None,
        help="Raw-data input directory; defaults to ship-profile dataSource.rawDataDir.",
    )
    parser.add_argument("--output-dir", default="result/engine-health/outputs", help="Result output directory.")
    parser.add_argument("--limit", type=int, default=12, help="Number of latest raw-data files to read.")
    parser.add_argument("--created-at", default="", help="ISO timestamp for deterministic output filenames.")
    args = parser.parse_args()

    workspace = Path(args.workspace).resolve()
    profile, _ = load_ship_profile(workspace)
    input_dir_value = args.input_dir or profile["dataSource"]["rawDataDir"]
    input_dir = (
        (workspace / input_dir_value).resolve()
        if not Path(input_dir_value).is_absolute()
        else Path(input_dir_value)
    )
    output_dir = (
        (workspace / args.output_dir).resolve()
        if not Path(args.output_dir).is_absolute()
        else Path(args.output_dir)
    )
    created_at = (
        _parse_datetime(args.created_at)
        if args.created_at
        else datetime.now(BEIJING_TZ).replace(tzinfo=None, microsecond=0)
    )
    if created_at is None:
        raise SystemExit(f"Invalid --created-at: {args.created_at}")

    summary = run(workspace, input_dir, output_dir, args.limit, created_at)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

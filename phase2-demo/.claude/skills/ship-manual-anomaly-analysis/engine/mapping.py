from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .bridge import anomaly_module
from .contracts import report_system_names


SKILL_DIR = Path(__file__).resolve().parents[1]


class MappingError(ValueError):
    """Raised when a Chinese form label cannot be mapped uniquely."""


@dataclass(frozen=True)
class ResolvedReport:
    report: dict[str, Any]
    equipment_id: str
    equipment_name: str
    device_data_id: str
    source_ship_id: str
    system_id: str
    system_name: str
    sensors: tuple[dict[str, Any], ...]
    query_sensors: tuple[dict[str, Any], ...]
    mechanism_profile: dict[str, str]
    system_ids: tuple[str, ...] = ()
    system_names: tuple[str, ...] = ()


def _normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).strip().casefold()
    text = text.replace("号", "#")
    return re.sub(r"[\s\-—_:/：()（）]+", "", text)


def _sensor_aliases(point_name: str, equipment_name: str) -> set[str]:
    without_register = re.sub(r"^\d+--", "", point_name).strip()
    without_engine = re.sub(r"^[12](?:#|号)主机", "", without_register).strip()
    without_repeated_engine = re.sub(r"^主机", "", without_engine).strip()
    return {
        alias
        for alias in {
            _normalize(point_name),
            _normalize(without_register),
            _normalize(without_engine),
            _normalize(without_repeated_engine),
            _normalize(f"{equipment_name}{without_engine}"),
            _normalize(f"{equipment_name}{without_repeated_engine}"),
        }
        if alias
    }


def _profile_key(system_id: str, groups: set[str]) -> str:
    # Mechanism groups refine analysis only; DC membership controls admission.
    if system_id == "cooling" and groups == {"piston_lo"}:
        return "piston_cooling"
    return system_id


def _resolve_system_selection(
    report: dict[str, Any], profiles: dict[str, Any]
) -> tuple[list[dict[str, Any]], list[str]]:
    systems: list[dict[str, Any]] = []
    names: list[str] = []
    seen: set[str] = set()
    for requested in report_system_names(report):
        matches = [
            item for item in profiles["system_aliases"]
            if _normalize(requested) in {_normalize(name) for name in item["names"]}
        ]
        if len(matches) != 1:
            valid_names = "、".join(item["names"][0] for item in profiles["system_aliases"])
            raise MappingError(f"系统中文名称无法唯一映射：{requested!r}；允许的系统：{valid_names}")
        system = matches[0]
        system_id = str(system["system_id"])
        if system_id not in seen:
            systems.append(system)
            names.append(requested)
            seen.add(system_id)
    return systems, names


def _selected_mechanism_profile(
    profiles: dict[str, Any], systems: list[dict[str, Any]],
    names: list[str], sensors: list[dict[str, Any]],
) -> dict[str, str]:
    selected_profiles = []
    for system in systems:
        groups = {
            str(sensor["group"]) for sensor in sensors
            if sensor["system_id"] == system["system_id"]
        }
        key = _profile_key(str(system["system_id"]), groups)
        selected_profiles.append(dict(
            profiles["mechanism_profiles"].get(key)
            or profiles["mechanism_profiles"]["default"]
        ))
    if len(selected_profiles) == 1:
        return selected_profiles[0]
    merged = {
        key: "；".join(dict.fromkeys(profile[key] for profile in selected_profiles))
        for key in selected_profiles[0]
    }
    merged["related_system"] = "、".join(names)
    return merged


def resolve_report(workspace: str | Path, report: dict[str, Any]) -> ResolvedReport:
    root = Path(workspace).resolve()
    profile_module = anomaly_module("ship_profile")
    profile, _ = profile_module.load_ship_profile(root)
    mapping_path = root / profile["dataSource"]["pointMappingPath"]
    try:
        payload = json.loads(mapping_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise MappingError(f"无法读取根传感器 mapping：{mapping_path}") from exc
    point_list = payload.get("pointList") if isinstance(payload, dict) else None
    if not isinstance(point_list, list) or not point_list:
        raise MappingError("sensor-point-mapping.json 必须包含非空 pointList[]")

    registry = anomaly_module("registry").load_registry(root)
    profile_module.validate_profile_registry(profile, registry)
    analysis_devices = profile_module.analyzable_devices(profile)
    supported_by_name = {
        str(config["deviceName"]): equipment_id
        for equipment_id, config in analysis_devices.items()
    }
    supported_by_device_id = {
        str(config["deviceDataId"]): equipment_id
        for equipment_id, config in analysis_devices.items()
    }
    rows_by_device: dict[str, list[dict[str, Any]]] = {}
    for row in point_list:
        if not isinstance(row, dict):
            continue
        name = str(row.get("deviceName") or "")
        device_id = str(row.get("deviceDataId") or "")
        equipment_id = supported_by_device_id.get(device_id)
        if equipment_id is None:
            continue
        expected_name = analysis_devices[equipment_id]["deviceName"]
        if name != expected_name:
            raise MappingError(
                f"设备 {device_id} 的 mapping 名称 {name!r} 与 ship-profile {expected_name!r} 不一致"
            )
        rows_by_device.setdefault(device_id, []).append(row)

    device_aliases: dict[str, set[str]] = {}
    for device_id, rows in rows_by_device.items():
        name = str(rows[0].get("deviceName") or "")
        aliases = {_normalize(name), _normalize(device_id), _normalize(rows[0].get("deviceCode"))}
        matched_profile = next(
            config
            for config in analysis_devices.values()
            if str(config["deviceDataId"]) == device_id
        )
        aliases.update(_normalize(item) for item in matched_profile.get("aliases", []))
        device_aliases[device_id] = {item for item in aliases if item}

    requested_device = _normalize(report.get("equipment_name"))
    device_matches = [device_id for device_id, aliases in device_aliases.items() if requested_device in aliases]
    if len(device_matches) != 1:
        raise MappingError(
            f"设备中文名称必须唯一映射到当前主机；输入={report.get('equipment_name')!r}，匹配={device_matches}"
        )
    device_data_id = device_matches[0]
    device_rows = rows_by_device[device_data_id]
    equipment_name = str(device_rows[0]["deviceName"])
    equipment_id = supported_by_name[equipment_name]

    numeric_rows = sorted(
        (row for row in device_rows if int(row.get("dataType") or 0) == 1),
        key=lambda row: int(row["pointDataId"]),
    )
    point_specs = anomaly_module("registry").point_specs()
    if len(numeric_rows) != len(point_specs):
        raise MappingError(
            f"设备 {equipment_name} 的数值测点数量为 {len(numeric_rows)}，检测模型要求 {len(point_specs)}"
        )
    sensor_catalog: dict[str, list[dict[str, Any]]] = {}
    all_sensors: list[dict[str, Any]] = []
    for row, spec in zip(numeric_rows, point_specs, strict=True):
        sensor = {
            "deviceDataId": device_data_id,
            "pointDataId": str(row["pointDataId"]),
            "pointCode": str(row.get("pointCode") or "").strip().upper(),
            "pointName": str(row.get("pointName") or spec.key),
            "dataType": 1,
            "unit": str(row.get("unit") or spec.unit),
            "internal_key": spec.key,
            "group": spec.group,
            "object_id": spec.object_id,
            "bank": spec.bank,
            "cylinder": spec.cylinder,
            "systemType": (
                str(row.get("systemType")).strip()
                if row.get("systemType") not in (None, "")
                else None
            ),
        }
        all_sensors.append(sensor)
        for alias in _sensor_aliases(sensor["pointName"], equipment_name):
            sensor_catalog.setdefault(alias, []).append(sensor)

    profiles = json.loads((SKILL_DIR / "data" / "system-profiles.json").read_text(encoding="utf-8"))
    systems_by_code: dict[str, dict[str, Any]] = {}
    for item in profiles["system_aliases"]:
        for code in item["point_codes"]:
            if not re.fullmatch(r"DC\d{4}", code) or code in systems_by_code:
                raise MappingError(f"系统点位配置中的 DC 编号无效或重复：{code!r}")
            systems_by_code[code] = item
    actual_codes = [sensor["pointCode"] for sensor in all_sensors]
    if len(set(actual_codes)) != len(actual_codes):
        raise MappingError("根传感器 mapping 的 DC 点位编号重复")
    if set(actual_codes) != set(systems_by_code):
        raise MappingError(
            "系统点位配置与根传感器 mapping 不一致；"
            f"未配置归属={sorted(set(actual_codes) - set(systems_by_code))}，"
            f"不存在的点位={sorted(set(systems_by_code) - set(actual_codes))}"
        )
    systems, selected_system_names = _resolve_system_selection(report, profiles)
    selected_system_ids = {str(system["system_id"]) for system in systems}
    for sensor in all_sensors:
        owner = systems_by_code[sensor["pointCode"]]
        sensor["system_id"] = str(owner["system_id"])
        sensor["system_name"] = str(owner["names"][0])

    resolved_sensors: list[dict[str, Any]] = []
    for requested in report.get("sensor_names", []):
        matches = sensor_catalog.get(_normalize(requested), [])
        unique = {
            item["pointDataId"]: item for item in matches
            if item["system_id"] in selected_system_ids
        }
        if not unique and matches:
            expected = "；".join(dict.fromkeys(
                f"{item['pointName']}属于{item['system_name']}" for item in matches
            ))
            raise MappingError(
                f"系统 {'、'.join(selected_system_names)!r} 与所选传感器所属系统不一致：{expected}"
            )
        if len(unique) != 1:
            suggestions = [
                row["pointName"]
                for row in numeric_rows
                if _normalize(requested) in _normalize(row.get("pointName"))
            ][:5]
            raise MappingError(
                f"关联传感器必须在 {equipment_name} 的所选系统数值测点中唯一解析；输入={requested!r}，"
                f"匹配={list(unique)}，候选={suggestions}"
            )
        resolved_sensors.append(next(iter(unique.values())))
    resolved_sensors = list({item["pointDataId"]: item for item in resolved_sensors}.values())
    if not resolved_sensors:
        raise MappingError("关联传感器至少包含一个可解析的数值测点")
    groups = {str(item["group"]) for item in resolved_sensors}
    mechanism_profile = _selected_mechanism_profile(
        profiles, systems, selected_system_names, resolved_sensors
    )
    # Every explicitly selected point survives; six limits supplementary context only.
    query_sensors = list(resolved_sensors)
    selected_ids = {item["pointDataId"] for item in query_sensors}
    related_candidates = [
        item for item in all_sensors
        if item["pointDataId"] not in selected_ids
        and (item["group"] in groups or item["system_id"] in selected_system_ids)
    ]
    fallback_candidates = [
        item for item in all_sensors
        if item["pointDataId"] not in selected_ids and item not in related_candidates
    ]
    for item in related_candidates + fallback_candidates:
        if len(query_sensors) >= 6:
            break
        query_sensors.append(item)
        selected_ids.add(item["pointDataId"])
    if len(query_sensors) < 2:
        raise MappingError(f"人工事件关联点位必须解析为至少2个；当前={len(query_sensors)}")
    source_ship_id = str(device_rows[0].get("shipId") or "")
    if not source_ship_id:
        raise MappingError("传感器 mapping 缺少接口 shipId")
    expected_source_ship_id = str(profile["sensorApiShipId"])
    if source_ship_id != expected_source_ship_id:
        raise MappingError(
            f"传感器 mapping shipId={source_ship_id!r} 与 ship-profile "
            f"sensorApiShipId={expected_source_ship_id!r} 不一致"
        )
    valid_ship_ids = {str(profile["shipId"]), expected_source_ship_id}
    if str(report.get("ship_id") or "") not in valid_ship_ids:
        raise MappingError(
            f"船舶ID {report.get('ship_id')!r} 与工作空间不一致；允许值={sorted(valid_ship_ids)}"
        )
    return ResolvedReport(
        report=report,
        equipment_id=equipment_id,
        equipment_name=equipment_name,
        device_data_id=device_data_id,
        source_ship_id=source_ship_id,
        system_id=str(systems[0]["system_id"]),
        system_name=selected_system_names[0],
        system_ids=tuple(str(system["system_id"]) for system in systems),
        system_names=tuple(selected_system_names),
        sensors=tuple(resolved_sensors),
        query_sensors=tuple(query_sensors),
        mechanism_profile=mechanism_profile,
    )

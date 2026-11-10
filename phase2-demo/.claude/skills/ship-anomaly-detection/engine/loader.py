from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable

from .math_utils import finite
from .registry import load_registry, point_by_index
from .ship_profile import (
    ShipProfileError,
    analyzable_devices,
    analyzer_profile,
    load_ship_profile,
    primary_analyzer,
    validate_profile_registry,
)
from .types import Sample


BEIJING_TZ = timezone(timedelta(hours=8))


class SensorDataError(RuntimeError):
    """Raised when scheduled raw-data files cannot be interpreted safely."""


def parse_timestamp(value: Any) -> datetime:
    text = str(value or "").strip()
    if not text:
        raise SensorDataError("raw-data JSON is missing collect_time/created_at")
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise SensorDataError(f"invalid timestamp: {text}") from exc
    if parsed.tzinfo is not None and parsed.utcoffset() is not None:
        parsed = parsed.astimezone(BEIJING_TZ).replace(tzinfo=None)
    return parsed


def parse_api_timestamp(value: Any) -> datetime:
    """Interpret point-data-list wall-clock timestamps as Asia/Shanghai local time."""
    text = str(value or "").strip()
    if not text:
        raise SensorDataError("point-data-list row is missing collectTime")
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise SensorDataError(f"invalid point-data-list collectTime: {text}") from exc
    if parsed.tzinfo is not None and parsed.utcoffset() is not None:
        parsed = parsed.astimezone(BEIJING_TZ).replace(tzinfo=None)
    return parsed


def decode_point_value_for_spec(
    point: dict[str, Any], spec: Any
) -> float | None:
    if spec is None:
        return None
    raw_value = point.get("raw_value")
    scale = point.get("scale")
    try:
        raw = float(raw_value)
    except (TypeError, ValueError):
        raw = None
    try:
        scale_value = float(scale)
    except (TypeError, ValueError):
        scale_value = None

    if raw is not None and spec.signed_16 and raw >= 32768:
        if scale_value not in (None, 0.0):
            return (raw - 65536.0) / scale_value
        return raw - 65536.0
    if raw is not None and scale_value == 0.0:
        return raw
    value = point.get("value")
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        if raw is None:
            return None
        if scale_value not in (None, 0.0):
            numeric = raw / scale_value
        else:
            numeric = raw
    return numeric if finite(numeric) else None


def decode_point_value(point: dict[str, Any], index: int) -> float | None:
    return decode_point_value_for_spec(point, point_by_index(index))


def _api_mapping_catalog(
    workspace: Path,
    profile: dict[str, Any],
) -> dict[tuple[str, str], dict[str, Any]]:
    path = workspace / profile["dataSource"]["pointMappingPath"]
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise SensorDataError(f"API point mapping is missing: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SensorDataError(f"API point mapping is invalid JSON: {path}") from exc
    point_list = payload.get("pointList") if isinstance(payload, dict) else None
    if not isinstance(point_list, list):
        raise SensorDataError("API point mapping must contain pointList[]")
    catalog: dict[tuple[str, str], dict[str, Any]] = {}
    for item in point_list:
        if not isinstance(item, dict):
            continue
        key = (str(item.get("deviceDataId") or ""), str(item.get("pointDataId") or ""))
        if key[0] and key[1]:
            catalog[key] = item
    if not catalog:
        raise SensorDataError("API point mapping pointList[] is empty")
    mapping_ship_ids = {
        str(item.get("shipId") or "").strip()
        for item in catalog.values()
        if str(item.get("shipId") or "").strip()
    }
    expected_ship_id = str(profile["sensorApiShipId"])
    if mapping_ship_ids and mapping_ship_ids != {expected_ship_id}:
        raise SensorDataError(
            "API point mapping shipId does not match data/ship-profile.json; "
            f"mapping={sorted(mapping_ship_ids)}, expected={expected_ship_id}"
        )
    return catalog


def _api_numeric_value(value: Any, spec: Any) -> float | None:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if spec.signed_16:
        if numeric >= 32768.0:
            numeric -= 65536.0
        elif numeric >= 3276.8:
            numeric -= 6553.6
        elif numeric >= 327.68:
            numeric -= 655.36
    return numeric if finite(numeric) else None


def samples_from_api_payload(
    payload: dict[str, Any],
    *,
    workspace: Path,
    source_ref: str,
) -> list[Sample]:
    rows = payload.get("pointDataList")
    if not isinstance(rows, list):
        raise SensorDataError("point-data-list raw JSON must contain pointDataList[]")
    try:
        profile, _ = load_ship_profile(workspace)
    except ShipProfileError as exc:
        raise SensorDataError(str(exc)) from exc
    registry = load_registry(workspace)
    selected_analyzer = primary_analyzer(profile)
    try:
        validate_profile_registry(profile, registry, selected_analyzer)
    except ShipProfileError as exc:
        raise SensorDataError(str(exc)) from exc
    catalog = _api_mapping_catalog(workspace, profile)
    profile_devices = analyzable_devices(profile)
    equipment_by_name = {
        str(device["deviceName"]): equipment_id
        for equipment_id, device in profile_devices.items()
    }
    equipment_by_device_id = {
        str(device["deviceDataId"]): equipment_id
        for equipment_id, device in profile_devices.items()
    }
    numeric_points_by_device: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in catalog.values():
        device_data_id = str(item.get("deviceDataId") or "")
        device_name = str(item.get("deviceName") or "")
        equipment_id = equipment_by_device_id.get(device_data_id)
        if equipment_id and device_name != profile_devices[equipment_id]["deviceName"]:
            raise SensorDataError(
                "API point mapping device identity does not match data/ship-profile.json; "
                f"deviceDataId={device_data_id}, mappingName={device_name!r}, "
                f"expectedName={profile_devices[equipment_id]['deviceName']!r}"
            )
        if equipment_id and int(item.get("dataType") or 0) == 1:
            numeric_points_by_device[device_data_id].append(item)

    expected_points = int(
        analyzer_profile(profile, selected_analyzer)["requiredPointCount"]
    )
    model_points: dict[tuple[str, str], Any] = {}
    for equipment_id, device in profile_devices.items():
        device_data_id = str(device["deviceDataId"])
        items = numeric_points_by_device.get(device_data_id, [])
        try:
            ordered_items = sorted(
                items,
                key=lambda item: int(
                    item.get("modelIndex")
                    if item.get("modelIndex") not in (None, "")
                    else item["pointDataId"]
                ),
            )
        except (TypeError, ValueError) as exc:
            raise SensorDataError(
                f"API mapping {equipment_id} must define integer modelIndex for "
                "non-numeric provisional pointDataId values"
            ) from exc
        if len(ordered_items) != expected_points:
            raise SensorDataError(
                f"API mapping {equipment_id} deviceDataId={device_data_id} has "
                f"{len(ordered_items)} numeric points; "
                f"expected {expected_points}"
            )
        for index, item in enumerate(ordered_items):
            model_points[(device_data_id, str(item["pointDataId"]))] = point_by_index(index)

    grouped: dict[tuple[datetime, str], list[dict[str, Any]]] = defaultdict(list)
    payload_ship_ids = {
        str(row.get("shipId") or "").strip()
        for row in rows
        if isinstance(row, dict) and str(row.get("shipId") or "").strip()
    }
    expected_source_ship_id = str(profile["sensorApiShipId"])
    if payload_ship_ids and payload_ship_ids != {expected_source_ship_id}:
        raise SensorDataError(
            "point-data-list raw shipId does not match data/ship-profile.json; "
            f"raw={sorted(payload_ship_ids)}, expected={expected_source_ship_id}"
        )
    for row in rows:
        if not isinstance(row, dict):
            continue
        device_data_id = str(row.get("deviceDataId") or "")
        point_data_id = str(row.get("pointDataId") or "")
        catalog_item = catalog.get((device_data_id, point_data_id))
        if catalog_item is None or (device_data_id, point_data_id) not in model_points:
            continue
        device_name = str(catalog_item.get("deviceName") or "")
        if device_name not in equipment_by_name:
            continue
        grouped[(parse_api_timestamp(row.get("collectTime")), device_data_id)].append(row)

    samples: list[Sample] = []
    for (timestamp, device_data_id), device_rows in sorted(grouped.items()):
        by_point_id = {
            str(row.get("pointDataId")): row
            for row in device_rows
            if row.get("pointDataId") not in (None, "")
        }
        if len(by_point_id) != expected_points:
            continue
        ordered = sorted(
            by_point_id.items(),
            key=lambda item: model_points[(device_data_id, item[0])].index,
        )
        first_catalog = catalog[(device_data_id, ordered[0][0])]
        device_name = str(first_catalog.get("deviceName") or "")
        equipment_id = equipment_by_name.get(device_name)
        if not equipment_id:
            continue
        values: dict[str, float] = {}
        refs: dict[str, dict[str, Any]] = {}
        for point_data_id, row in ordered:
            spec = model_points[(device_data_id, point_data_id)]
            if spec is None:
                continue
            point_metadata = catalog[(device_data_id, point_data_id)]
            value = _api_numeric_value(row.get("value"), spec)
            if value is None:
                continue
            values[spec.key] = value
            refs[spec.key] = {
                "deviceDataId": device_data_id,
                "pointDataId": point_data_id,
                "pointName": str(point_metadata.get("pointName") or spec.key),
                "dataType": int(point_metadata.get("dataType") or 1),
                "unit": str(point_metadata.get("unit") or spec.unit),
                "systemType": (
                    str(point_metadata.get("systemType")).strip()
                    if point_metadata.get("systemType") not in (None, "")
                    else None
                ),
            }
        samples.append(
            Sample(
                timestamp=timestamp,
                equipment_id=equipment_id,
                equipment_name=profile_devices[equipment_id]["deviceName"],
                values=values,
                point_refs=refs,
                source_ref=source_ref,
            )
        )
    return samples


def _resolve_input_paths(workspace: Path, paths: Iterable[str | Path] | None) -> list[Path]:
    if paths is None:
        profile, _ = load_ship_profile(workspace)
        candidates = sorted(
            (workspace / profile["dataSource"]["rawDataDir"]).glob("*.json")
        )
    else:
        candidates = []
        for raw_path in paths:
            path = Path(raw_path)
            path = path if path.is_absolute() else workspace / path
            candidates.append(path)
    return [path.resolve() for path in candidates if path.is_file()]


def load_sensor_raw_data(
    workspace: str | Path,
    *,
    paths: Iterable[str | Path] | None = None,
    lookback_hours: float = 6.0,
    max_files: int | None = 12,
) -> tuple[dict[str, list[Sample]], list[str], dict[str, Any]]:
    workspace_path = Path(workspace).resolve()
    input_paths = _resolve_input_paths(workspace_path, paths)
    if not input_paths:
        profile, _ = load_ship_profile(workspace_path)
        raise SensorDataError(
            f"no raw-data JSON found under {profile['dataSource']['rawDataDir']}"
        )

    loaded: list[tuple[datetime, Path, dict[str, Any], list[dict[str, Any]]]] = []
    errors: list[str] = []
    for path in input_paths:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(payload, dict):
                raise SensorDataError("root must be an object")
            if not isinstance(payload.get("pointDataList"), list):
                raise SensorDataError("raw-data JSON must use the point-data-list response format")
            metadata = payload.get("_fetchMetadata")
            if not isinstance(metadata, dict) or metadata.get("recordsPath") != "pointDataList":
                raise SensorDataError("raw-data JSON is missing point-data-list _fetchMetadata")
            records = [item for item in payload["pointDataList"] if isinstance(item, dict)]
            if not records:
                raise SensorDataError("point-data-list raw JSON contains no records")
            record_times = [parse_api_timestamp(record.get("collectTime")) for record in records]
            loaded.append((max(record_times), path, payload, records))
        except (OSError, json.JSONDecodeError, SensorDataError) as exc:
            errors.append(f"{path.name}: {exc}")
    if not loaded:
        raise SensorDataError("no readable raw-data JSON: " + "; ".join(errors))
    if max_files is not None and max_files <= 0:
        raise SensorDataError("max_files must be a positive integer or None")

    latest = max(item[0] for item in loaded)
    earliest = latest - timedelta(hours=max(lookback_hours, 0.0))
    eligible = sorted((item for item in loaded if earliest <= item[0] <= latest), key=lambda item: item[0])
    selected = eligible[-max_files:] if max_files is not None else eligible

    grouped: dict[str, list[Sample]] = defaultdict(list)
    input_refs: list[str] = []
    seen_refs: set[str] = set()
    for _, path, payload, records in selected:
        try:
            relative = path.relative_to(workspace_path).as_posix()
        except ValueError as exc:
            raise SensorDataError(f"input path escapes workspace: {path}") from exc
        if relative not in seen_refs:
            input_refs.append(relative)
            seen_refs.add(relative)
        for sample in samples_from_api_payload(
            payload,
            workspace=workspace_path,
            source_ref=relative,
        ):
            grouped[sample.equipment_id].append(sample)

    deduplicated: dict[str, list[Sample]] = {}
    for equipment_id, samples in grouped.items():
        by_time = {sample.timestamp: sample for sample in samples}
        deduplicated[equipment_id] = [by_time[key] for key in sorted(by_time)]
    selected_samples = [sample for samples in deduplicated.values() for sample in samples]
    if not selected_samples:
        raise SensorDataError("selected raw-data JSON contains no complete main-engine samples")

    try:
        profile, _ = load_ship_profile(workspace_path)
    except ShipProfileError as exc:
        raise SensorDataError(str(exc)) from exc
    metadata = {
        "ship_id": str(profile["shipId"]),
        "source_ship_id": str(
            selected[-1][2].get("_fetchMetadata", {}).get("shipId")
            or selected[-1][3][-1].get("shipId")
            or ""
        ),
        "ship_name": str(profile["shipName"]),
        "analyzer": primary_analyzer(profile),
        "device_capabilities": {
            str(device["deviceDataId"]): {
                "equipment_id": equipment_id,
                "device_name": str(device["deviceName"]),
                "collect_enabled": bool(device["collectEnabled"]),
                "analyzers": list(device["analyzers"]),
            }
            for equipment_id, device in profile["devices"].items()
        },
        "window_start": min(sample.timestamp for sample in selected_samples),
        "window_end": max(sample.timestamp for sample in selected_samples),
        "available_file_count": len(loaded),
        "window_eligible_file_count": len(eligible),
        "selected_file_count": len(selected),
        "max_files": max_files,
        "lookback_hours": lookback_hours,
        "ignored_files": errors,
    }
    return deduplicated, input_refs, metadata


def sample_from_data_array(
    *,
    timestamp: datetime,
    equipment_id: str,
    equipment_name: str,
    data_array: list[list[Any]],
    source_ref: str = "dataset/jnl_sensor_data.db",
) -> Sample:
    """Build a sample from the historical DB array for calibration/replay only."""
    values: dict[str, float] = {}
    refs: dict[str, dict[str, Any]] = {}
    for index, item in enumerate(data_array):
        if not isinstance(item, list):
            continue
        spec = point_by_index(index)
        if spec is None:
            continue
        point = {
            "raw_value": item[0] if len(item) > 0 else None,
            "value": item[1] if len(item) > 1 else None,
            "scale": item[2] if len(item) > 2 else None,
        }
        value = decode_point_value(point, index)
        if value is None:
            continue
        values[spec.key] = value
        refs[spec.key] = {"index": index, "register": "", "name": spec.key, "unit": spec.unit}
    return Sample(
        timestamp=parse_timestamp(timestamp),
        equipment_id=equipment_id,
        equipment_name=equipment_name,
        values=values,
        point_refs=refs,
        source_ref=source_ref,
    )

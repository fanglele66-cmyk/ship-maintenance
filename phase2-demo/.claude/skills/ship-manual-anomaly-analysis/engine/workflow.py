from __future__ import annotations

import copy
import json
import math
import re
import shutil
import statistics
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from dataclasses import replace

from .bridge import anomaly_module
from .contracts import ManualContractError, validate_report, validate_write_set
from .mapping import ResolvedReport, resolve_report
from .scope import matches_exact_retry, scope_fields


BEIJING_TZ = timezone(timedelta(hours=8))
RAW_ROOT_REF = "result/ship-manual-anomaly-analysis/raw"
OUTPUT_ROOT_REF = "result/ship-manual-anomaly-analysis/outputs"
MANUAL_EVENT_TYPES = {
    "ship": "ship-manual",
    "shore": "shore-manual",
}
MANUAL_EVENT_ID_SUFFIXES = {
    "ship": "manual",
    "shore": "shore",
}


def _manual_source(report: dict[str, Any]) -> tuple[str, str]:
    sender = str(report.get("sender") or "ship")
    try:
        return MANUAL_EVENT_TYPES[sender], MANUAL_EVENT_ID_SUFFIXES[sender]
    except KeyError as exc:
        raise ManualContractError(f"unsupported manual anomaly sender={sender!r}") from exc


def _file_signature(path: Path) -> dict[str, int] | None:
    if not path.is_file():
        return None
    stat = path.stat()
    return {"size": stat.st_size, "mtime_ns": stat.st_mtime_ns}


def _file_set_signature(root: Path, pattern: str) -> dict[str, dict[str, int]]:
    if not root.is_dir():
        return {}
    return {
        path.name: signature
        for path in sorted(root.glob(pattern))
        if (signature := _file_signature(path)) is not None
    }


def _snapshot_periodic_boundary(root: Path) -> dict[str, Any]:
    ai_root = root / "result" / "ai-anomaly"
    event_root = ai_root / "events"
    return {
        "periodic_outputs": _file_set_signature(
            ai_root / "outputs",
            "ai-run-*__result.json",
        ),
        "fetch_state": _file_signature(ai_root / "fetch-state.json"),
        "baseline_raw": _file_set_signature(
            root / "input" / "sensor-raw-data",
            "*.json",
        ),
        "active_index": _file_signature(ai_root / "active-events.json"),
        "event_ids": sorted(
            path.name.removesuffix("__event.json")
            for path in event_root.glob("*/*__event.json") if path.is_file()
        ) if event_root.is_dir() else [],
    }


def _require_periodic_boundary(
    before: dict[str, Any],
    after: dict[str, Any],
    *,
    phase: str,
    allowed_event_ids: set[str] | None = None,
    allow_active_index_change: bool = False,
) -> dict[str, Any]:
    allowed = allowed_event_ids or set()
    before_ids = set(before["event_ids"])
    after_ids = set(after["event_ids"])
    unexpected_event_ids = sorted(after_ids - before_ids - allowed)
    checks = {
        "periodic_outputs_unchanged": before["periodic_outputs"] == after["periodic_outputs"],
        "fetch_state_unchanged": before["fetch_state"] == after["fetch_state"],
        "baseline_raw_unchanged": before["baseline_raw"] == after["baseline_raw"],
        "active_index_unchanged": (
            True
            if allow_active_index_change
            else before["active_index"] == after["active_index"]
        ),
        "no_unexpected_event_ids": not unexpected_event_ids,
    }
    report = {
        "phase": phase,
        "ok": all(checks.values()),
        "checks": checks,
        "allowed_event_ids": sorted(allowed),
        "unexpected_event_ids": unexpected_event_ids,
        "periodic_output_count": len(after["periodic_outputs"]),
        "baseline_raw_count": len(after["baseline_raw"]),
    }
    if not report["ok"]:
        failed = ", ".join(name for name, passed in checks.items() if not passed)
        raise ManualContractError(
            f"manual anomaly execution crossed the periodic detection boundary during {phase}: {failed}"
        )
    return report


def _beijing_local(value: str | datetime) -> datetime:
    parsed = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is not None and parsed.utcoffset() is not None:
        parsed = parsed.astimezone(BEIJING_TZ).replace(tzinfo=None)
    return parsed.replace(microsecond=0)


def split_half_hour_windows(start: str | datetime, end: str | datetime) -> list[tuple[datetime, datetime]]:
    cursor = _beijing_local(start)
    stop = _beijing_local(end)
    if stop <= cursor:
        raise ValueError("end_time must be later than start_time")
    windows: list[tuple[datetime, datetime]] = []
    while cursor < stop:
        window_end = min(cursor + timedelta(minutes=30), stop)
        windows.append((cursor, window_end))
        cursor = window_end
    return windows


def _relative(root: Path, path: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def _safe_source(root: Path, value: str | Path) -> Path:
    source = Path(value)
    source = source if source.is_absolute() else root / source
    source = source.resolve()
    if not source.is_relative_to(root):
        raise ValueError(f"raw input escapes workspace: {source}")
    if not source.is_file():
        raise ValueError(f"raw input does not exist: {source}")
    return source


def _coverage_for_sensor_samples(
    resolved: ResolvedReport, sensor_samples: list[dict[str, Any]],
) -> dict[str, Any]:
    """Check every reported point against the immutable report window."""
    start = _beijing_local(resolved.report["time_window"]["start_time"])
    end = _beijing_local(resolved.report["time_window"]["end_time"])
    duration = (end - start).total_seconds()
    if duration <= 0:
        raise ManualContractError("人工上报时间窗无效；未创建事件")
    times_by_point: dict[str, set[datetime]] = {
        str(sensor["pointDataId"]): set() for sensor in resolved.sensors
    }
    for sample in sensor_samples:
        try:
            timestamp = _beijing_local(sample["time"])
            values = sample["values"]
            if not isinstance(values, dict):
                raise ValueError("values must be an object")
        except (KeyError, TypeError, ValueError) as exc:
            raise ManualContractError("人工上报采样证据格式无效；未创建事件") from exc
        if not start <= timestamp <= end:
            raise ManualContractError(
                f"人工上报采样证据超出上报时间窗：{timestamp.isoformat()}；未创建事件，请重新准备"
            )
        for point_id, times in times_by_point.items():
            value = values.get(point_id)
            try:
                valid = not isinstance(value, bool) and math.isfinite(float(value))
            except (TypeError, ValueError, OverflowError):
                valid = False
            if valid:
                times.add(timestamp)
    sensors = []
    all_times: set[datetime] = set()
    for sensor in resolved.sensors:
        point_id = str(sensor["pointDataId"])
        times = times_by_point[point_id]
        all_times.update(times)
        covered = (max(times) - min(times)).total_seconds() if times else 0.0
        sensors.append({
            "pointDataId": point_id, "pointName": sensor["pointName"],
            "sample_count": len(times), "ratio": covered / duration,
            "covered_seconds": covered,
            "actual_window": {
                "start_time": min(times).isoformat(), "end_time": max(times).isoformat(),
            } if times else None,
        })
    coverage = {
        "policy": "minimum_per_sensor_time_span_ratio", "minimum_ratio": 0.5,
        "ratio": min((item["ratio"] for item in sensors), default=0.0),
        "requested_seconds": duration,
        "requested_window": {"start_time": start.isoformat(), "end_time": end.isoformat()},
        "actual_window": {
            "start_time": min(all_times).isoformat(), "end_time": max(all_times).isoformat(),
        } if all_times else None,
        "sensors": sensors,
    }
    if coverage["ratio"] < coverage["minimum_ratio"]:
        raise ManualContractError(
            "人工上报数据覆盖不足：每个关联传感器在原上报时间窗内的有效数值时间跨度须达到 50%；"
            "未创建事件，不使用历史 raw 替代。覆盖诊断："
            + json.dumps(coverage, ensure_ascii=False, separators=(",", ":"))
        )
    return coverage


def _crop_raw_to_window(path: Path, resolved: ResolvedReport) -> list[dict[str, Any]]:
    """Crop only the staged copy, before the loader chooses its lookback range."""
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(payload, dict) or not isinstance(payload.get("pointDataList"), list):
        raise ManualContractError("人工上报 raw 必须包含 pointDataList；未创建事件")
    start = _beijing_local(resolved.report["time_window"]["start_time"])
    end = _beijing_local(resolved.report["time_window"]["end_time"])
    rows = []
    samples = []
    for row in payload["pointDataList"]:
        if not isinstance(row, dict):
            continue
        try:
            timestamp = _beijing_local(row.get("collectTime"))
        except (ValueError, TypeError) as exc:
            raise ManualContractError("人工上报 raw 的 collectTime 无效；未创建事件") from exc
        if not start <= timestamp <= end:
            continue
        rows.append(row)
        if str(row.get("deviceDataId")) != str(resolved.device_data_id):
            continue
        if str(row.get("shipId") or resolved.source_ship_id) != str(resolved.source_ship_id):
            raise ManualContractError("人工上报 raw 船舶与上报船舶不一致；未创建事件")
        samples.append({
            "time": timestamp.isoformat(),
            "values": {str(row.get("pointDataId")): row.get("value")},
        })
    payload["pointDataList"] = rows
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return samples


def _validate_prepared_evidence(
    resolved: ResolvedReport, evidence: dict[str, Any],
) -> dict[str, Any]:
    if evidence.get("raw_fallback", {}).get("used") or evidence.get("data_error"):
        raise ManualContractError("人工上报准备证据包含历史回放或数据错误；未创建事件，请重新准备")
    if not evidence.get("raw_refs"):
        raise ManualContractError("人工上报准备证据没有有效 raw；未创建事件，请重新准备")
    event = evidence.get("detector_event", {})
    for event_field, report_field in (("time_start", "start_time"), ("time_end", "end_time")):
        if _beijing_local(event.get(event_field)) != _beijing_local(resolved.report["time_window"][report_field]):
            raise ManualContractError("人工上报准备事件与上报时间窗不一致；未创建事件，请重新准备")
    return _coverage_for_sensor_samples(resolved, evidence.get("sensor_samples", []))


def _prepare_raw_data(
    root: Path,
    resolved: ResolvedReport,
    *,
    run_id: str,
    raw_inputs: list[str] | None,
    max_window_attempts: int,
) -> tuple[list[str], list[dict[str, Any]], Path, dict[str, Any]]:
    if max_window_attempts <= 0:
        raise ValueError("max_window_attempts must be a positive integer")
    start = resolved.report["time_window"]["start_time"]
    end = resolved.report["time_window"]["end_time"]
    windows = [(_beijing_local(start), _beijing_local(end))]
    raw_dir = root / RAW_ROOT_REF / run_id
    raw_dir.mkdir(parents=True, exist_ok=True)
    refs: list[str] = []
    attempts: list[dict[str, Any]] = []
    fallback = {
        "used": False,
        "reason": None,
        "source_refs": [],
        "staged_refs": [],
    }

    if raw_inputs is not None:
        if not raw_inputs:
            raise ValueError("offline raw inputs must not be empty")
        sensor_samples: list[dict[str, Any]] = []
        for index, value in enumerate(raw_inputs, start=1):
            window_start, window_end = windows[0]
            source = _safe_source(root, value)
            destination = raw_dir / f"manual-raw-{index:03d}-{window_end:%Y%m%d_%H%M%S}Z.json"
            shutil.copy2(source, destination)
            sensor_samples.extend(_crop_raw_to_window(destination, resolved))
            ref = _relative(root, destination)
            refs.append(ref)
            attempts.append(
                {
                    "window_index": index,
                    "start_time": window_start.isoformat(),
                    "end_time": window_end.isoformat(),
                    "status": "staged",
                    "attempts": 1,
                    "raw_ref": ref,
                    "errors": [],
                }
            )
        _coverage_for_sensor_samples(resolved, sensor_samples)
        return refs, attempts, raw_dir, fallback

    fetch_sensor_raw_data = anomaly_module("sensor_api").fetch_sensor_raw_data
    for index, (window_start, window_end) in enumerate(windows, start=1):
        destination = raw_dir / f"manual-raw-{index:03d}-{window_end:%Y%m%d_%H%M%S}Z.json"
        errors: list[str] = []
        success: dict[str, Any] | None = None
        for _ in range(max_window_attempts):
            try:
                success = fetch_sensor_raw_data(
                    root,
                    output_path=_relative(root, destination),
                    ship_id=resolved.source_ship_id,
                    collect_time_start=window_start,
                    collect_time_end=window_end,
                    device_data_ids=[int(resolved.device_data_id)],
                    minimum_coverage_ratio=0.5,
                )
                if not destination.is_file():
                    raise ManualContractError("在线取数未生成 raw 文件")
                data_coverage = _coverage_for_sensor_samples(
                    resolved, _crop_raw_to_window(destination, resolved),
                )
                break
            except Exception as exc:
                success = None
                errors.append(str(exc))
        ref = _relative(root, destination) if success and destination.is_file() else None
        if ref:
            refs.append(ref)
        attempts.append(
            {
                "window_index": index,
                "start_time": window_start.isoformat(),
                "end_time": window_end.isoformat(),
                "status": "fetched" if success else "failed",
                "attempts": len(errors) + (1 if success else 0),
                "raw_ref": ref,
                "errors": errors,
                "coverage": success.get("coverage") if success else None,
                "data_coverage": data_coverage if success else None,
            }
        )
    if not refs or any(attempt["status"] == "failed" for attempt in attempts):
        raise ManualContractError(
            "人工上报取数未通过原上报时间窗的数据门禁；未创建事件，不使用历史 raw 替代。取数诊断："
            + json.dumps(attempts, ensure_ascii=False, separators=(",", ":"))
        )
    return refs, attempts, raw_dir, fallback


def _canonical_group(group: str) -> str:
    value = str(group)
    for prefix, canonical in (
        ("exhaust_", "exhaust"),
        ("turbo_exhaust", "exhaust"),
        ("liner_", "liner"),
        ("big_end", "bearing"),
        ("main_bearing", "bearing"),
        ("ht_water", "ht_water"),
        ("lt_water", "lt_water"),
        ("turbo_lube", "lube_oil"),
    ):
        if value.startswith(prefix):
            return canonical
    return value


def _choose_related_event(detection_results: list[Any], resolved: ResolvedReport) -> Any | None:
    target_keys = {sensor["internal_key"] for sensor in resolved.sensors}
    target_groups = {_canonical_group(sensor["group"]) for sensor in resolved.sensors}
    candidates: list[tuple[float, Any]] = []
    for result in detection_results:
        if result.equipment_id != resolved.equipment_id:
            continue
        for event in result.events:
            exact = len(target_keys.intersection(event.sensors))
            group_match = len(target_groups.intersection(_canonical_group(group) for group in event.groups))
            if exact == 0 and group_match == 0:
                continue
            ratio = event.raw_score / event.threshold if event.threshold > 0 else 0.0
            score = exact * 100.0 + group_match * 10.0 + event.confidence_score * 5.0 + min(ratio, 5.0)
            candidates.append((score, event))
    return max(candidates, key=lambda item: item[0])[1] if candidates else None


def _dominant_regime(detection_results: list[Any], equipment_id: str) -> str:
    totals: dict[str, float] = {}
    for result in detection_results:
        if result.equipment_id != equipment_id:
            continue
        for segment in result.segments:
            totals[segment.type] = totals.get(segment.type, 0.0) + segment.duration_min
    return max(totals, key=totals.get) if totals else "unknown"


def _trend_stats(samples_by_equipment: dict[str, list[Any]], resolved: ResolvedReport) -> dict[str, dict[str, Any]]:
    samples = samples_by_equipment.get(resolved.equipment_id, [])
    stats: dict[str, dict[str, Any]] = {}
    for sensor in resolved.sensors:
        values = [sample.values[sensor["internal_key"]] for sample in samples if sensor["internal_key"] in sample.values]
        if not values:
            continue
        stats[sensor["pointDataId"]] = {
            "point_name": sensor["pointName"],
            "samples": len(values),
            "minimum": round(min(values), 6),
            "maximum": round(max(values), 6),
            "mean": round(statistics.fmean(values), 6),
            "stddev": round(statistics.pstdev(values), 6) if len(values) > 1 else 0.0,
            "first": round(values[0], 6),
            "last": round(values[-1], 6),
            "delta": round(values[-1] - values[0], 6),
        }
    return stats


def _manual_event(
    resolved: ResolvedReport,
    detection_results: list[Any],
    samples_by_equipment: dict[str, list[Any]],
) -> tuple[Any, dict[str, dict[str, Any]], bool]:
    types = anomaly_module("types")
    chosen = _choose_related_event(detection_results, resolved)
    target_keys = [sensor["internal_key"] for sensor in resolved.sensors]
    target_groups = [sensor["group"] for sensor in resolved.sensors]
    first = resolved.sensors[0]
    start = _beijing_local(resolved.report["time_window"]["start_time"])
    end = _beijing_local(resolved.report["time_window"]["end_time"])
    trends = _trend_stats(samples_by_equipment, resolved)
    if chosen is not None:
        event = copy.deepcopy(chosen)
    else:
        consistency_group = any(
            _canonical_group(group) in {"exhaust", "liner", "bearing"}
            for group in target_groups
        )
        channel = types.Channel.INTER_CYL if consistency_group else types.Channel.ABS_AR
        event = types.DetectionEvent(
            channel=channel,
            event_type="inter_cylinder_consistency" if consistency_group else "absolute_condition_residual",
            equipment_id=resolved.equipment_id,
            equipment_name=resolved.equipment_name,
            sensors=target_keys,
            groups=target_groups,
            time_start=start,
            time_end=end,
            duration_min=(end - start).total_seconds() / 60.0,
            n_points=sum(item["samples"] for item in trends.values()),
            raw_score=0.0,
            threshold=0.0,
            regime=_dominant_regime(detection_results, resolved.equipment_id),
            object_id=first.get("object_id") or first["internal_key"],
            bank=first.get("bank"),
            cylinder=first.get("cylinder"),
            details={},
        )

    algorithm_confidence = float(chosen.confidence_score) if chosen is not None else 0.0
    confidence = min(
        0.95,
        0.72
        + (0.12 if chosen is not None else 0.0)
        + min(algorithm_confidence, 1.0) * 0.08
        + (0.03 if trends else 0.0),
    )
    event.equipment_id = resolved.equipment_id
    event.equipment_name = resolved.equipment_name
    event.sensors = target_keys
    event.groups = target_groups
    event.time_start = start
    event.time_end = end
    event.duration_min = (end - start).total_seconds() / 60.0
    event.n_points = sum(item["samples"] for item in trends.values())
    event.object_id = first.get("object_id") or first["internal_key"]
    event.bank = first.get("bank")
    event.cylinder = first.get("cylinder")
    event.candidate_confirmed = True
    event.confirmed = True
    event.level = types.Level.CONFIRMED
    event.confidence_score = confidence
    evidence = dict(event.details.get("evidence") or {})
    channels = set(evidence.get("overlap_channels") or [event.channel.value])
    channels.add("manual_report")
    evidence["overlap_channels"] = sorted(channels)
    evidence["manual_report_prior"] = 1.0
    evidence["algorithm_candidate_used"] = chosen is not None
    event.details["evidence"] = evidence
    event.details["sourcePoints"] = [
        {
            "deviceDataId": sensor["deviceDataId"],
            "pointDataId": sensor["pointDataId"],
            "pointName": sensor["pointName"],
            "dataType": 1,
            "unit": sensor["unit"],
            "systemType": sensor.get("systemType"),
        }
        for sensor in resolved.query_sensors
    ]
    event.details["manualReport"] = {
        "sender": resolved.report.get("sender", "ship"),
        "description": resolved.report["description"],
        "system": resolved.system_name,
        **scope_fields(resolved),
        "imageIds": list(resolved.report["image_ids"]),
        "trendStats": trends,
    }
    return event, trends, chosen is not None


def _analysis(
    event: Any,
    resolved: ResolvedReport,
    *,
    event_id: str,
    ser_no: str,
    created_at: str,
    ship_id: str,
    ship_name: str,
    title: str,
    anomaly_type: str,
    api_config: dict[str, Any],
    trends: dict[str, dict[str, Any]],
    raw_count: int,
    algorithm_candidate_used: bool,
    fallback_used: bool,
    manual_event_type: str,
    root: Path,
    agent_content: dict[str, Any] | None = None,
    allow_fallback: bool = False,
) -> dict[str, Any]:
    workspace = anomaly_module("workspace")
    if fallback_used:
        raise ManualContractError("人工上报禁止用历史 raw 回放发布事件；请重新准备原上报窗口数据")
    payload = workspace._analysis_payload(
        event,
        event_id=event_id,
        ser_no=ser_no,
        created_at=created_at,
        ship_id=ship_id,
        source_ship_id=resolved.source_ship_id,
        ship_name=ship_name,
        title=title,
        anomaly_type=anomaly_type,
        api_config=api_config,
        workspace=root,
        agent_content=agent_content,
        allow_fallback=allow_fallback,
    )
    payload["deviceDataId"] = resolved.device_data_id
    payload["equipment_id"] = resolved.equipment_id
    payload["equipment_name"] = resolved.equipment_name
    payload["systemType"] = resolved.system_id
    payload.update(scope_fields(resolved))
    payload["image_ids"] = list(resolved.report["image_ids"])
    requested_point_ids = {sensor["pointDataId"] for sensor in resolved.sensors}
    query_point_ids = {
        point["pointDataId"]
        for request in payload["data_query_requests"]
        for point in request["points"]
    }
    if not requested_point_ids.issubset(query_point_ids):
        raise ManualContractError(
            "人工上报的关联传感器必须全部保留在 data_query_requests 中"
        )
    payload["event_type"] = manual_event_type
    if agent_content is not None:
        evidence_text = json.dumps(payload["analysis_basis"], ensure_ascii=False)
        if "人工上报" not in evidence_text:
            raise ManualContractError("人工分析依据必须说明事件为人工上报；人工建事件不等于已确认设备故障")
        payload["analysis_conclusion"]["judgement"] = "confirmed_anomaly"
        return payload
    raise ManualContractError("Agent analysis is required; deterministic task generation is disabled")


def _cleanup_raw_dir(root: Path, raw_dir: Path | None) -> dict[str, Any]:
    report = {"raw_dir": None, "deleted_raw_json": [], "remaining_json": []}
    if raw_dir is None:
        return report
    expected_parent = (root / RAW_ROOT_REF).resolve()
    resolved_dir = raw_dir.resolve()
    if resolved_dir.parent != expected_parent:
        raise ValueError(f"refusing to clean unexpected raw directory: {resolved_dir}")
    report["raw_dir"] = _relative(root, resolved_dir)
    if not resolved_dir.is_dir():
        return report
    for path in sorted(resolved_dir.glob("*.json")):
        if path.resolve().parent != resolved_dir:
            continue
        report["deleted_raw_json"].append(_relative(root, path))
        path.unlink()
    report["remaining_json"] = [_relative(root, path) for path in resolved_dir.glob("*.json")]
    if not any(resolved_dir.iterdir()):
        resolved_dir.rmdir()
    return report


def _event_path_for_ser_no(event_root: Path, ship_id: str, ser_no: str) -> Path | None:
    """Find this order's event in the current or legacy directory layout."""
    folder = f"ai-{ship_id}-{ser_no}"
    directories = [event_root / folder, *sorted(event_root.glob(f"{folder}-????????_??????"))]
    event_paths = [
        path
        for directory in directories if directory.is_dir()
        for path in sorted(directory.glob("*__event.json"))
    ]
    if len(event_paths) > 1:
        raise ManualContractError(f"ser_no={ser_no} 对应多个既有事件；停止发布以免覆盖")
    return event_paths[0] if event_paths else None


def run_manual_anomaly(
    workspace: str | Path,
    report: dict[str, Any],
    *,
    raw_inputs: list[str] | None = None,
    max_window_attempts: int = 3,
    dry_run: bool = False,
    created_at: datetime | None = None,
    prepare_only: bool = False,
    agent_content: dict[str, Any] | None = None,
    allow_fallback: bool = False,
    prepared_evidence: dict[str, Any] | None = None,
    expected_event_id: str | None = None,
) -> dict[str, Any]:
    root = Path(workspace).resolve()
    report = dict(report)
    report.setdefault("sender", "ship")
    validate_report(report)
    if allow_fallback:
        raise ManualContractError("Deterministic analysis fallback is disabled; keep preparation and regenerate the Agent candidate")
    if not prepare_only and agent_content is None:
        raise ManualContractError("Agent analysis is required; prepare evidence and knowledge first, then publish a validated candidate")
    requested_ser_no = str(report["ser_no"])
    manual_event_type, _ = _manual_source(report)
    resolved = resolve_report(root, report)
    periodic_boundary_before = _snapshot_periodic_boundary(root)
    now = _beijing_local(
        created_at
        or datetime.now(BEIJING_TZ).replace(tzinfo=None, microsecond=0)
    )
    run_id = now.strftime("%Y%m%d_%H%M%S")
    output_ref = f"{OUTPUT_ROOT_REF}/manual-run-{run_id}__result.json"
    raw_dir: Path | None = None
    outcome: dict[str, Any] | None = None
    try:
        if prepared_evidence is None:
            raw_dir = root / RAW_ROOT_REF / run_id
            raw_refs, fetch_attempts, raw_dir, raw_fallback = _prepare_raw_data(
                root,
                resolved,
                run_id=run_id,
                raw_inputs=raw_inputs,
                max_window_attempts=max_window_attempts,
            )
            samples_by_equipment: dict[str, list[Any]] = {}
            detection_results: list[Any] = []
            data_error: str | None = None
            if raw_refs:
                try:
                    loader = anomaly_module("loader")
                    samples_by_equipment, _, _ = loader.load_sensor_raw_data(
                        root,
                        paths=raw_refs,
                        lookback_hours=max(
                            (
                                _beijing_local(report["time_window"]["end_time"])
                                - _beijing_local(report["time_window"]["start_time"])
                            ).total_seconds()
                            / 3600.0
                            + 1.0,
                            1.0,
                        ),
                        max_files=None,
                    )
                    samples_by_equipment = {
                        resolved.equipment_id: [
                            sample for sample in samples_by_equipment.get(resolved.equipment_id, [])
                            if _beijing_local(report["time_window"]["start_time"])
                            <= _beijing_local(sample.timestamp)
                            <= _beijing_local(report["time_window"]["end_time"])
                        ]
                    }
                    model_samples = [
                        {"time": sample.timestamp.isoformat(), "values": {
                            str(sensor["pointDataId"]): sample.values[sensor["internal_key"]]
                            for sensor in resolved.sensors if sensor["internal_key"] in sample.values
                        }} for sample in samples_by_equipment[resolved.equipment_id]
                    ]
                    data_coverage = _coverage_for_sensor_samples(resolved, model_samples)
                    detection_results = anomaly_module("detector").detect_all(samples_by_equipment)
                except ManualContractError:
                    raise
                except Exception as exc:
                    raise ManualContractError(f"人工上报原窗口数据无法完成分析；未创建事件：{exc}") from exc
            else:
                raise ManualContractError("人工上报没有有效 raw；未创建事件")

            event, trends, algorithm_candidate_used = _manual_event(
                resolved,
                detection_results,
                samples_by_equipment,
            )
            detection_payloads = [item.to_dict() for item in detection_results]
            related_trends = _trend_stats(samples_by_equipment, replace(resolved, sensors=resolved.query_sensors))
            sensor_samples = [
                {"time": sample.timestamp.isoformat(), "values": {
                    sensor["pointDataId"]: sample.values[sensor["internal_key"]]
                    for sensor in resolved.query_sensors if sensor["internal_key"] in sample.values
                }}
                for sample in samples_by_equipment.get(resolved.equipment_id, [])
            ]
        else:
            data_coverage = _validate_prepared_evidence(resolved, prepared_evidence)
            types = anomaly_module("types")
            event_fields = copy.deepcopy(prepared_evidence["detector_event"])
            event_fields["channel"] = types.Channel(event_fields["channel"])
            event_fields["level"] = types.Level(event_fields["level"])
            for field in ("time_start", "time_end"):
                event_fields[field] = _beijing_local(event_fields[field])
            event = types.DetectionEvent(**event_fields)
            raw_refs = prepared_evidence["raw_refs"]
            fetch_attempts = prepared_evidence["fetch_attempts"]
            raw_fallback = prepared_evidence["raw_fallback"]
            data_error = prepared_evidence["data_error"]
            trends = prepared_evidence["trends"]
            algorithm_candidate_used = prepared_evidence["algorithm_candidate_used"]
            detection_payloads = prepared_evidence["detections"]
            related_trends = prepared_evidence["related_trends"]
            sensor_samples = prepared_evidence["sensor_samples"]
        workspace_engine = anomaly_module("workspace")
        registry = anomaly_module("registry").load_registry()
        profile_module = anomaly_module("ship_profile")
        profile, _ = profile_module.load_ship_profile(root)
        profile_module.validate_profile_registry(profile, registry)
        anomaly_type = workspace_engine._display_anomaly_type(event)
        candidate_event_id = (
            f"ai-{profile['shipId']}-{requested_ser_no}-"
            f"{event.time_start:%Y%m%d_%H%M%S}"
        )
        active_path = root / "result" / "ai-anomaly" / "active-events.json"
        active_payload = workspace_engine._load_json(
            active_path,
            {"updated_at": now.isoformat(), "events": []},
        )
        active_events = active_payload.setdefault("events", [])
        workspace_engine._normalize_active_anomaly_types(active_events)
        event_root = root / "result" / "ai-anomaly" / "events"
        candidate_dir = workspace_engine._event_directory(event_root, candidate_event_id)
        candidate_event_path = candidate_dir / f"{candidate_event_id}__event.json"
        existing_event_path = _event_path_for_ser_no(event_root, str(profile["shipId"]), requested_ser_no)
        existing_event_id = (
            existing_event_path.name.removesuffix("__event.json") if existing_event_path else None
        )
        if existing_event_path is None and any(
            str(item.get("ser_no") or "") == requested_ser_no for item in active_events
        ):
            raise ManualContractError(
                f"ser_no={requested_ser_no} 已在活动索引中，但事件文件缺失；停止发布以免重复创建"
            )

        pending_writes: list[tuple[Path, dict[str, Any], str]] = []
        created_ids: list[str] = []
        updated_ids: list[str] = []
        api_config_ref = profile["dataSource"]["configPath"]
        api_config = workspace_engine._load_json(root / api_config_ref, {})
        api_config["_configRef"] = api_config_ref
        if expected_event_id and expected_event_id != candidate_event_id:
            raise ManualContractError("prepared event identity changed; prepare again before publishing")
        if expected_event_id and existing_event_id and existing_event_id != expected_event_id:
            raise ManualContractError("manual event identity changed after preparation; prepare again")
        if prepare_only and existing_event_path is None:
            from .preparation import write_preparation
            evidence = {
                "detector_event": event.to_dict(), "raw_refs": raw_refs,
                "fetch_attempts": fetch_attempts, "raw_fallback": raw_fallback,
                "data_error": data_error, "trends": trends,
                "algorithm_candidate_used": algorithm_candidate_used,
                "detections": detection_payloads, "related_trends": related_trends,
                "sensor_samples": sensor_samples, "data_coverage": data_coverage,
            }
            guard = _require_periodic_boundary(
                periodic_boundary_before, _snapshot_periodic_boundary(root), phase="after_manual_prepare",
            )
            outcome = write_preparation(
                root, report, event, evidence, profile, api_config,
                event_id=candidate_event_id, now=now, anomaly_type=anomaly_type, guard=guard,
            )
            return outcome
        if existing_event_path is not None:
            event_id = str(existing_event_id)
            event_path = existing_event_path
            event_dir = event_path.parent
            analysis_path = event_dir / f"{event_id}__anomaly-analysis-result.json"
            event_master = workspace_engine._load_json(event_path, {})
            analysis = workspace_engine._load_json(analysis_path, {})
            if not matches_exact_retry(
                event_master, analysis, resolved,
                event_id=event_id, ser_no=requested_ser_no,
                event_type=manual_event_type, ship_id=str(profile["shipId"]),
            ):
                raise ManualContractError(
                    "既有事件身份、系统或上报测点集合与本次不一致，或旧事件缺少可复用的完整集合；"
                    "不能复用该事件，请使用新的 ser_no 重新提交"
                )
            validate_write_set([
                (event_master, "event.schema.json"),
                (analysis, "event-analysis-result.schema.json"),
            ])
            if (
                event_master.get("event_type") != manual_event_type
                or analysis.get("event_type") != manual_event_type
            ):
                raise ManualContractError(
                    f"existing manual event does not use event_type={manual_event_type}"
                )
            ser_no = str(event_master["ser_no"])
            updated_ids.append(event_id)
            event_action = "updated"
            title = str(event_master["event_title"])
            anomaly_type = str(analysis["anomaly_type"])
        else:
            event_id = candidate_event_id
            event_dir = candidate_dir
            event_path = candidate_event_path
            analysis_path = event_dir / f"{event_id}__anomaly-analysis-result.json"
            ser_no = requested_ser_no
            display_point = re.sub(r"^\d+--[12]#主机", "", resolved.sensors[0]["pointName"])
            title = f"{resolved.equipment_name}{display_point}人工上报异常事件"
            analysis = _analysis(
                event,
                resolved,
                event_id=event_id,
                ser_no=ser_no,
                created_at=now.isoformat(),
                ship_id=str(profile["shipId"]),
                ship_name=str(profile["shipName"]),
                title=title,
                anomaly_type=anomaly_type,
                api_config=api_config,
                trends=trends,
                raw_count=len(raw_refs),
                algorithm_candidate_used=algorithm_candidate_used,
                fallback_used=bool(raw_fallback["used"]),
                manual_event_type=manual_event_type,
                root=root,
                agent_content=agent_content,
                allow_fallback=allow_fallback,
            )
            actual = data_coverage["actual_window"]
            requested = data_coverage["requested_window"]
            for basis in analysis["analysis_basis"]:
                if basis["basis_type"] == "sensor_trend":
                    basis["time_window"] = dict(actual)
            analysis["analysis_basis"] = [
                basis for basis in analysis["analysis_basis"]
                if basis["basis_id"] not in {"basis_online_data_coverage", "basis_manual_data_coverage"}
            ]
            point_coverage = "；".join(
                f"{item['pointName']}：{item['ratio']:.2%}，"
                f"{item['actual_window']['start_time']}～{item['actual_window']['end_time']}"
                for item in data_coverage["sensors"]
            )
            analysis["analysis_basis"].append({
                "basis_id": "basis_manual_data_coverage", "basis_type": "sensor_trend",
                "title": "人工上报逐点数据覆盖范围", "time_window": dict(actual),
                "point_refs": [sensor["pointDataId"] for sensor in resolved.sensors],
                "description": (
                    f"原上报窗口 {requested['start_time']}～{requested['end_time']}；"
                    f"每个上报传感器均达到 50% 时间跨度门槛，最低覆盖率 {data_coverage['ratio']:.2%}。"
                    f"逐点实际覆盖：{point_coverage}。"
                    "统计结论仅适用于窗口内实际取得的样本；时间跨度覆盖率不代表连续完整采样。"
                ),
            })
            event_ref = _relative(root, event_path)
            title = analysis["event_title"]
            analysis_ref = _relative(root, analysis_path)
            event_master = {
                "ser_no": ser_no,
                "event_id": event_id,
                "event_type": manual_event_type,
                "ship_id": str(profile["shipId"]),
                "deviceDataId": resolved.device_data_id,
                "equipment_id": resolved.equipment_id,
                "equipment_name": resolved.equipment_name,
                "event_title": title,
                "status": "active",
                "status_suggestion": "inspection_required",
                "analysis_refs": [analysis_ref],
                "feedback_refs": [],
                "maintenance_feedback_refs": [],
                "maintenance_refs": [],
                "history": [
                    {
                        "time": now.isoformat(),
                        "action": "manual_anomaly_event_created",
                        "type": "event_created",
                        "title": "人工上报异常事件已创建",
                        "detail": f"{analysis['event_title']}已按人工上报进入事件排查流程。",
                        "timeline_label": "已建事件",
                        "source_label": "船端反馈" if manual_event_type == "ship-manual" else "岸端跟进",
                        "actor": {
                            "side": "ship" if manual_event_type == "ship-manual" else "shore",
                            "name": "轮机长" if manual_event_type == "ship-manual" else "岸端值班人员",
                            "role": "船端" if manual_event_type == "ship-manual" else "岸端",
                            "display_name": "轮机长（船端）" if manual_event_type == "ship-manual" else "岸端值班人员（岸端）",
                        },
                        "stage_result": f"{analysis['event_title']}已建立并进入排查流程。",
                        "next_action": "由船端接收事件并按诊断方案开始排查。",
                        "ref": output_ref,
                    }
                ],
            }
            active_events.append(
                {
                    "ser_no": ser_no,
                    "event_id": event_id,
                    "event_source": manual_event_type,
                    "event_dir": _relative(root, event_dir),
                    "status": "active",
                    "status_suggestion": "inspection_required",
                    "deviceDataId": resolved.device_data_id,
                    "systemType": analysis.get("systemType"),
                    **scope_fields(resolved),
                    "equipment_id": resolved.equipment_id,
                    "equipment_name": resolved.equipment_name,
                    "event_title": title,
                    "anomaly_type": anomaly_type,
                    "time_start": event.time_start.isoformat(),
                    "time_end": event.time_end.isoformat(),
                }
            )
            pending_writes.extend(
                [
                    (event_path, event_master, "event.schema.json"),
                    (analysis_path, analysis, "event-analysis-result.schema.json"),
                ]
            )
            created_ids.append(event_id)
            event_action = "created"

        event_ref = _relative(root, event_dir / f"{event_id}__event.json")
        analysis_ref = _relative(root, event_dir / f"{event_id}__anomaly-analysis-result.json")
        result_event = {
            "ser_no": ser_no,
            "event_id": event_id,
            "event_action": event_action,
            "status": event_master.get("status") if event_master.get("status") in {"active", "confirmed"} else "confirmed",
            "severity": analysis["severity"],
            "deviceDataId": resolved.device_data_id,
            "equipment_id": resolved.equipment_id,
            "equipment_name": resolved.equipment_name,
            "anomaly_type": anomaly_type,
            "event_title": title,
            "time_range": {
                "start_time": event.time_start.isoformat(),
                "end_time": event.time_end.isoformat(),
            },
            "summary": analysis["analysis_conclusion"]["summary"],
            "event_ref": event_ref,
            "analysis_result_ref": analysis_ref,
        }
        requested_success_count = sum(
            item["status"] in {"fetched", "staged"} for item in fetch_attempts
        )
        result_payload = {
            "run_id": f"manual-{run_id}",
            "source": "ai_anomaly",
            "created_at": now.isoformat(),
            "ship_id": str(profile["shipId"]),
            "ship_name": str(profile["shipName"]),
            "analysis_window": {
                "start_time": event.time_start.isoformat(),
                "end_time": event.time_end.isoformat(),
            },
            "input_refs": raw_refs,
            "summary": {
                "result_status": "anomalyDetected",
                "new_events": len(created_ids),
                "updated_events": len(updated_ids),
                "suppressed_events": 0,
                "message": (
                    f"人工异常上报固定评级为 anomalyDetected；取数请求 {len(fetch_attempts)} 个，"
                    f"指定窗口成功 raw {requested_success_count} 份，"
                    f"创建事件 {len(created_ids)} 个，复用事件 {len(updated_ids)} 个。"
                    "该事件来源为人工上报。"
                ),
            },
            "created_event_ids": created_ids,
            "updated_event_ids": updated_ids,
            "events": [result_event],
        }
        active_payload["updated_at"] = now.isoformat()
        write_items = [
            *((payload, schema) for _, payload, schema in pending_writes),
            (active_payload, "active-events.schema.json"),
            (result_payload, "manual-result"),
        ]
        validated = validate_write_set(write_items)
        pre_publish_guard = _require_periodic_boundary(
            periodic_boundary_before,
            _snapshot_periodic_boundary(root),
            phase="before_manual_publish",
        )
        if not dry_run and not prepare_only:
            for path, payload, _ in pending_writes:
                workspace_engine._save_json(path, payload)
            workspace_engine._save_json(active_path, active_payload)
            workspace_engine._save_json(root / output_ref, result_payload)
        outcome = {
            "stage": "existing_event" if prepare_only else "published" if not dry_run else "validated",
            "analysis_content_source": analysis.get("content_source"),
            "result": result_payload,
            "result_ref": output_ref,
            "event_ref": event_ref,
            "analysis_result_ref": analysis_ref,
            "dry_run": dry_run,
            "sender": report["sender"],
            "event_type": manual_event_type,
            "mapping": {
                "equipment_id": resolved.equipment_id,
                "equipment_name": resolved.equipment_name,
                "deviceDataId": resolved.device_data_id,
                "system_id": resolved.system_id,
                "system_name": resolved.system_name,
                "system_ids": list(resolved.system_ids),
                "system_names": list(resolved.system_names),
                "sensors": list(resolved.sensors),
            },
            "fetch": {
                "window_count": len(fetch_attempts),
                "successful_raw_count": requested_success_count,
                "analysis_raw_count": len(raw_refs),
                "attempts": fetch_attempts,
                "existing_raw_fallback": raw_fallback,
                "data_error": data_error,
                "data_coverage": data_coverage,
            },
            "manual_aggregation": {
                "forced_anomaly_detected": True,
                "algorithm_candidate_used": algorithm_candidate_used,
                "confidence": round(event.confidence_score, 4),
                "trend_stats": trends,
            },
            "detections": detection_payloads,
            "contract_validation": {
                "ok": True,
                "validated_schemas": validated,
                "write_set_size": len(pending_writes) + 2,
            },
        }
    finally:
        cleanup = _cleanup_raw_dir(root, raw_dir)
        if outcome is not None:
            outcome["cleanup"] = cleanup
    if outcome is None:
        raise RuntimeError("manual anomaly workflow ended without an outcome")
    outcome["cleanup"] = cleanup
    manual_event_id = str(outcome["result"]["events"][0]["event_id"])
    post_publish_guard = _require_periodic_boundary(
        periodic_boundary_before,
        _snapshot_periodic_boundary(root),
        phase="after_manual_publish",
        allowed_event_ids={manual_event_id} if not dry_run and not prepare_only else set(),
        allow_active_index_change=not dry_run and not prepare_only,
    )
    outcome["periodic_detection_guard"] = {
        "ok": pre_publish_guard["ok"] and post_publish_guard["ok"],
        "periodic_entrypoints_allowed": False,
        "reused_modules": ["loader", "detector", "types", "workspace_contract_helpers"],
        "pre_publish": pre_publish_guard,
        "post_publish": post_publish_guard,
    }
    return outcome

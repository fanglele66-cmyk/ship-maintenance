from __future__ import annotations

import json
import math
import re
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

from longhang_engine import registry as longhang_registry
from longhang_engine.detector import detect as run_longhang_detection

from .ship_profile import analyzer_profile, load_ship_profile, primary_analyzer
from .types import Channel, ChannelStatus, DetectionEvent, DetectionResult, Level, Sample, Segment


_CHANNEL_MAP = {
    "ch1_inter_cyl": Channel.INTER_CYL,
    "ch2_abs_ar": Channel.ABS_AR,
    "ch3_dt_ar": Channel.DT_AR,
    "ch_mid_inter_cyl": Channel.MID_INTER_CYL,
    "ch_stopped_phys": Channel.STOPPED,
    "ch_iqr": Channel.IQR,
}


def _parse_time(value: Any, fallback: datetime) -> datetime:
    text = str(value or "").strip()
    if not text:
        return fallback
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return fallback
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone().replace(tzinfo=None)
    return parsed


def _channel(source_channel: str, event_type: str) -> Channel:
    if source_channel in _CHANNEL_MAP:
        return _CHANNEL_MAP[source_channel]
    lowered = event_type.lower()
    if "midlow" in lowered:
        return Channel.NF_MIDLOW
    return Channel.NF


def _level(value: Any, confirmed: bool) -> Level:
    if confirmed:
        return Level.CONFIRMED
    text = str(value or "").lower()
    if text == "high":
        return Level.HIGH
    if text == "comod al":
        return Level.COMODAL
    if text == "comodal":
        return Level.COMODAL
    return Level.LOW


def _confidence(level: Level, confirmed: bool, low_confidence: bool) -> float:
    value = {
        Level.LOW: 0.25,
        Level.COMODAL: 0.5,
        Level.HIGH: 0.72,
        Level.CONFIRMED: 0.92,
    }[level]
    if confirmed:
        value = max(value, 0.9)
    if low_confidence:
        value = min(value, 0.55)
    return value


def _stats(values: list[float]) -> dict[str, float]:
    finite = [value for value in values if math.isfinite(value)]
    if not finite:
        return {"mean": 0.0, "std": 0.0, "min": 0.0, "max": 0.0}
    mean = sum(finite) / len(finite)
    variance = sum((value - mean) ** 2 for value in finite) / len(finite)
    return {
        "mean": round(mean, 4),
        "std": round(math.sqrt(variance), 4),
        "min": round(min(finite), 4),
        "max": round(max(finite), 4),
    }


def _regime(rpm: float) -> str:
    if not math.isfinite(rpm) or rpm < 5:
        return "stopped"
    if rpm < 30:
        return "low_speed"
    if rpm < 90:
        return "mid"
    return "cruise"


def _segments(samples: list[Sample]) -> list[Segment]:
    if not samples:
        return []
    types = [_regime(float(sample.values.get("rpm", 0.0))) for sample in samples]
    bounds: list[tuple[str, int, int]] = []
    start = 0
    current = types[0]
    for index in range(1, len(types)):
        if types[index] != current:
            bounds.append((current, start, index))
            current = types[index]
            start = index
    bounds.append((current, start, len(types)))
    output: list[Segment] = []
    for segment_type, start_idx, end_idx in bounds:
        chunk = samples[start_idx:end_idx]
        output.append(
            Segment(
                type=segment_type,
                start_idx=start_idx,
                end_idx=end_idx,
                start_time=chunk[0].timestamp,
                end_time=chunk[-1].timestamp,
                rpm_stats=_stats(
                    [float(item.values.get("rpm", 0.0)) for item in chunk]
                ),
                load_stats=_stats(
                    [float(item.values.get("fo_command", 0.0)) for item in chunk]
                ),
            )
        )
    return output


def _event_regime(event_start: datetime, event_end: datetime, segments: list[Segment]) -> str:
    matches = [
        item
        for item in segments
        if item.start_time <= event_end and event_start <= item.end_time
    ]
    if not matches:
        return "unknown"
    return max(
        matches,
        key=lambda item: min(event_end, item.end_time)
        - max(event_start, item.start_time),
    ).type


def _source_points(
    event_sensors: list[str],
    event_groups: list[str],
    samples: list[Sample],
    start: datetime,
    end: datetime,
) -> list[dict[str, Any]]:
    refs: dict[str, dict[str, Any]] = {}
    for sample in samples:
        if start <= sample.timestamp <= end:
            refs.update(sample.point_refs)
    preferred = [sensor for sensor in event_sensors if sensor in refs]
    if not preferred:
        for key in ("rpm", "fo_command", "scav_air_press"):
            if key in refs:
                preferred.append(key)
    group_tokens = {str(value) for value in event_groups}
    if len(preferred) < 6:
        for key, ref in refs.items():
            if key in preferred:
                continue
            point_name = str(ref.get("pointName") or "")
            if group_tokens and not any(token in key or token in point_name for token in group_tokens):
                continue
            preferred.append(key)
            if len(preferred) >= 6:
                break
    if len(preferred) < 2:
        for key in refs:
            if key not in preferred:
                preferred.append(key)
            if len(preferred) >= 2:
                break
    points: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for key in preferred[:6]:
        ref = refs[key]
        identity = (str(ref.get("deviceDataId") or ""), str(ref.get("pointDataId") or ""))
        if not all(identity) or identity in seen:
            continue
        seen.add(identity)
        points.append(dict(ref))
    return points


def _cylinder(sensors: list[str]) -> int | None:
    cylinders = {
        int(match.group(1))
        for sensor in sensors
        for match in [re.search(r"cyl(?:inder)?[_-]?(\d+)", sensor, re.IGNORECASE)]
        if match
    }
    return next(iter(cylinders)) if len(cylinders) == 1 else None


def _analyzer_payload(
    samples: list[Sample], workspace: Path
) -> tuple[dict[str, Any], dict[str, Any]]:
    profile, _ = load_ship_profile(workspace)
    analyzer = primary_analyzer(profile, samples[0].equipment_id)
    config = analyzer_profile(profile, analyzer)
    mapping_path = workspace / config["mappingPath"]
    mapping = json.loads(mapping_path.read_text(encoding="utf-8-sig"))
    if not isinstance(mapping.get("mappings"), list) or not mapping["mappings"]:
        raise ValueError(f"analyzer mapping must contain mappings[]: {mapping_path}")
    longhang_registry.build_registry(mapping_path)
    dc_by_internal: dict[str, str] = {}
    for item in mapping["mappings"]:
        dc_key = next(
            (
                str(value)
                for value in item.get("external_keys", [])
                if str(value).startswith("DC") and str(value)[2:].isdigit()
            ),
            "",
        )
        if dc_key:
            dc_by_internal[str(item["internal_name"])] = dc_key
    canonical = config["canonicalInput"]
    data = []
    for index, sample in enumerate(samples):
        sensors = [
            {"key": dc_by_internal[key], "value": str(sample.values[key])}
            for key in dc_by_internal
            if key in sample.values
        ]
        data.append(
            {
                "imoNumber": canonical["shipIdentifier"],
                "terminalTime": sample.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "transId": f"canonical-{index}",
                "sensorList": [
                    {
                        "serialNumber": canonical["deviceSerialNumber"],
                        "sensorList": sensors,
                    }
                ],
                "asi": {},
            }
        )
    return {"serialNumber": canonical["serialNumber"], "data": data}, config


def _convert_events(
    raw_events: list[dict[str, Any]],
    samples: list[Sample],
    segments: list[Segment],
    *,
    detector_profile: str,
) -> list[DetectionEvent]:
    output: list[DetectionEvent] = []
    fallback_start = samples[0].timestamp
    fallback_end = samples[-1].timestamp
    for raw in raw_events:
        start = _parse_time(raw.get("time_start"), fallback_start)
        end = _parse_time(raw.get("time_end"), start)
        if end < start:
            end = start
        sensors = [str(value) for value in raw.get("sensors", [])]
        groups = [str(value) for value in raw.get("groups", [])]
        event_type = str(raw.get("type") or "changhang_detection")
        confirmed = bool(raw.get("confirmed"))
        low_confidence = bool(raw.get("low_confidence"))
        level = _level(raw.get("level"), confirmed)
        max_z = float(raw.get("max_z") or 0.0)
        severity = float(raw.get("severity") or max_z)
        threshold = severity / max_z if max_z > 0 and severity > 0 else 1.0
        cylinder = _cylinder(sensors)
        details = {
            "detectorProfile": detector_profile,
            "sourceEventId": str(raw.get("event_id") or ""),
            "sourceChannel": str(raw.get("channel") or ""),
            "sourceEventType": event_type,
            "sourceSeverity": severity,
            "sourcePoints": _source_points(sensors, groups, samples, start, end),
        }
        output.append(
            DetectionEvent(
                channel=_channel(str(raw.get("channel") or ""), event_type),
                event_type=event_type,
                equipment_id=samples[0].equipment_id,
                equipment_name=samples[0].equipment_name,
                sensors=sensors,
                groups=groups,
                time_start=start,
                time_end=end,
                duration_min=max(
                    float(raw.get("duration_min") or 0.0),
                    (end - start).total_seconds() / 60.0,
                ),
                n_points=sum(1 for item in samples if start <= item.timestamp <= end),
                raw_score=severity,
                threshold=threshold,
                regime=_event_regime(start, end, segments),
                level=level,
                object_id=f"cylinder_{cylinder}" if cylinder is not None else None,
                cylinder=cylinder,
                candidate_confirmed=confirmed or level == Level.CONFIRMED,
                confirmed=confirmed,
                confidence_score=_confidence(level, confirmed, low_confidence),
                low_confidence=low_confidence,
                low_confidence_reason=str(raw.get("low_confidence_reason") or ""),
                details=details,
            )
        )
    output.sort(key=lambda item: (item.time_start, item.channel.value, item.event_type))
    return output


def detect_equipment(
    samples: list[Sample],
    baselines: dict | None = None,
    *,
    workspace: str | Path = ".",
) -> DetectionResult:
    del baselines
    if not samples:
        raise ValueError("detect_equipment requires at least one sample")
    ordered = sorted(samples, key=lambda item: item.timestamp)
    if len({item.equipment_id for item in ordered}) != 1:
        raise ValueError("detect_equipment accepts one equipment_id at a time")
    root = Path(workspace).resolve()
    payload, analyzer_config = _analyzer_payload(ordered, root)
    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".json",
            prefix="changhang-detect-",
            encoding="utf-8",
            delete=False,
        ) as handle:
            json.dump(payload, handle, ensure_ascii=False)
            temp_path = Path(handle.name)
        result = run_longhang_detection(temp_path, sensitivity="strict")
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
    segments = _segments(ordered)
    events = _convert_events(
        result.get("events", []),
        ordered,
        segments,
        detector_profile=analyzer_config["detectorProfile"],
    )
    statuses = [
        ChannelStatus(
            channel=str(item.get("channel") or ""),
            active=bool(item.get("active")),
            reason=str(item.get("reason") or ""),
            n_samples=int(item.get("n_samples") or 0),
            n_events=int(item.get("n_events") or 0),
        )
        for item in result.get("channel_status", [])
        if isinstance(item, dict)
    ]
    iqr_status = next((item for item in statuses if item.channel == "ch_iqr"), None)
    iqr_total = iqr_status.n_samples if iqr_status else 0
    iqr_anomaly = 0
    if iqr_status:
        match = re.search(r"point_rate=([0-9.]+)%", iqr_status.reason)
        if match:
            iqr_anomaly = round(iqr_total * float(match.group(1)) / 100.0)
    return DetectionResult(
        equipment_id=ordered[0].equipment_id,
        equipment_name=ordered[0].equipment_name,
        samples=len(ordered),
        segments=segments,
        events=events,
        channel_status=statuses,
        iqr_total_points=iqr_total,
        iqr_anomaly_points=iqr_anomaly,
    )


def detect_all(
    samples_by_equipment: dict[str, list[Sample]],
    baselines: dict | None = None,
    *,
    workspace: str | Path = ".",
) -> list[DetectionResult]:
    return [
        detect_equipment(samples, baselines, workspace=workspace)
        for _, samples in sorted(samples_by_equipment.items())
        if samples
    ]

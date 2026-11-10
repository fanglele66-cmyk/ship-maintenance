from __future__ import annotations

from .baseline import load_baselines
from .channels import detect_ch1, detect_ch2, detect_ch3, detect_iqr, detect_mid, detect_stopped
from .nf import detect_nf_cruise, detect_nf_midlow
from .regime import segment_by_regime
from .registry import load_registry
from .scoring import score_events
from .ship_profile import analyzer_profile, import_entrypoint, load_ship_profile, primary_analyzer
from .types import DetectionResult, Sample


def _canonical_group(value: str) -> str:
    group = str(value or "")
    for prefix, canonical in (
        ("exhaust_", "exhaust"),
        ("turbo_exhaust", "exhaust"),
        ("liner_", "liner"),
        ("big_end", "bearing"),
        ("main_bearing", "bearing"),
        ("ht_water", "ht_water"),
        ("lt_water", "lt_water"),
        ("turbo_lube", "lube_oil"),
        ("lube_oil", "lube_oil"),
    ):
        if group.startswith(prefix):
            return canonical
    return group


def _related_sensor_keys(event, available: dict[str, dict], registry: dict) -> list[str]:
    """Choose 2-6 deterministic event-related points for trend queries."""
    primary = list(dict.fromkeys(key for key in event.sensors if key in available))
    specs = registry["points_by_key"]
    target_groups = {str(item) for item in event.groups}
    canonical_groups = {_canonical_group(item) for item in target_groups}
    operating_context = {"rpm", "load", "fuel_index", "scav_air_pressure"}

    def rank(key: str) -> tuple[int, int, str]:
        if key in primary:
            return (0, primary.index(key), key)
        spec = specs.get(key)
        if spec is None:
            return (6, 0, key)
        if event.object_id and spec.object_id == event.object_id:
            return (1, spec.index, key)
        if spec.group in target_groups:
            return (2, spec.index, key)
        if _canonical_group(spec.group) in canonical_groups:
            return (3, spec.index, key)
        if key in operating_context:
            return (4, spec.index, key)
        return (5, spec.index, key)

    ordered = sorted(available, key=rank)
    return ordered[:6]


def _attach_source_points(events: list, samples: list[Sample]) -> None:
    """Carry API point identities from input samples into detected events."""
    registry = load_registry()
    for event in events:
        available: dict[str, dict] = {}
        for sample in samples:
            if event.time_start <= sample.timestamp <= event.time_end:
                available.update(
                    {
                        key: value
                        for key, value in sample.point_refs.items()
                        if isinstance(value, dict)
                    }
                )
        related_keys = _related_sensor_keys(event, available, registry)
        source_points: dict[tuple[str, str], dict] = {}
        for sensor in related_keys:
            point = available[sensor]
            device_data_id = str(point.get("deviceDataId") or "")
            point_data_id = str(point.get("pointDataId") or "")
            if not device_data_id or not point_data_id:
                continue
            source_points[(device_data_id, point_data_id)] = {
                "deviceDataId": device_data_id,
                "pointDataId": point_data_id,
                "pointName": str(point.get("pointName") or sensor),
                "dataType": int(point.get("dataType") or 1),
                "unit": str(point.get("unit") or ""),
                "systemType": point.get("systemType"),
            }
        event.details["sourcePoints"] = list(source_points.values())


def _attach_operating_context(events: list, segments: list) -> None:
    """Keep the measured regime statistics that explain why an event was routed."""
    for event in events:
        matches = [
            segment
            for segment in segments
            if segment.type == event.regime
            and segment.start_time <= event.time_end
            and event.time_start <= segment.end_time
        ]
        if not matches:
            continue
        segment = max(
            matches,
            key=lambda item: min(event.time_end, item.end_time)
            - max(event.time_start, item.start_time),
        )
        event.details["operatingContext"] = {
            "regime": segment.type,
            "segment_start": segment.start_time.isoformat(),
            "segment_end": segment.end_time.isoformat(),
            "n_samples": segment.n_samples,
            "rpm_stats": dict(segment.rpm_stats),
            "load_stats": dict(segment.load_stats),
        }


def detect_equipment(samples: list[Sample], baselines: dict | None = None) -> DetectionResult:
    if not samples:
        raise ValueError("detect_equipment requires at least one sample")
    ordered = sorted(samples, key=lambda item: item.timestamp)
    equipment_ids = {sample.equipment_id for sample in ordered}
    if len(equipment_ids) != 1:
        raise ValueError("detect_equipment accepts one equipment_id at a time")
    registry = load_registry()
    baseline = baselines or load_baselines()
    equipment_id = ordered[0].equipment_id
    if equipment_id not in baseline["devices"]:
        raise KeyError(f"Missing baseline for {equipment_id}")
    device = baseline["devices"][equipment_id]
    segments = segment_by_regime(ordered, registry["regime"])
    events = []
    statuses = []
    for detector in (detect_ch1, detect_ch2, detect_ch3, detect_mid, detect_stopped):
        channel_events, status = detector(ordered, segments, device, registry)
        events.extend(channel_events)
        statuses.append(status)
    nf_events, nf_status = detect_nf_cruise(ordered, segments, registry)
    events.extend(nf_events)
    statuses.append(nf_status)
    nf_midlow_events, nf_midlow_status = detect_nf_midlow(ordered, segments, registry)
    events.extend(nf_midlow_events)
    statuses.append(nf_midlow_status)
    iqr_events, iqr_status, iqr_total, iqr_anomaly = detect_iqr(
        ordered, segments, device, registry
    )
    events.extend(iqr_events)
    statuses.append(iqr_status)
    score_events(events, device, registry)
    _attach_source_points(events, ordered)
    _attach_operating_context(events, segments)
    events.sort(key=lambda item: (item.time_start, item.channel.value, item.sensors))
    return DetectionResult(
        equipment_id=equipment_id,
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
    workspace: str = ".",
) -> list[DetectionResult]:
    profile, _ = load_ship_profile(workspace)
    grouped: dict[str, dict[str, list[Sample]]] = {}
    for equipment_id, samples in samples_by_equipment.items():
        if not samples:
            continue
        analyzer = primary_analyzer(profile, equipment_id)
        grouped.setdefault(analyzer, {})[equipment_id] = samples

    results: list[DetectionResult] = []
    for analyzer, equipment_samples in sorted(grouped.items()):
        config = analyzer_profile(profile, analyzer)
        entrypoint = import_entrypoint(
            config["detectionEntrypoint"],
            package=__package__,
        )
        if entrypoint is detect_all:
            raise ValueError(f"analyzer {analyzer!r} resolves recursively to engine.detector")
        analyzer_results = entrypoint(
            equipment_samples,
            baselines,
            workspace=workspace,
        )
        if not isinstance(analyzer_results, list):
            raise ValueError(f"analyzer {analyzer!r} must return a list of DetectionResult")
        results.extend(analyzer_results)
    return results

from __future__ import annotations

from collections import defaultdict, deque
from typing import Any

from .baseline import predict_model
from .events import extract_scored_events
from .math_utils import finite, median, quantile, robust_sigma, stdev
from .registry import group_members, load_registry, point_by_key, point_specs
from .types import Channel, ChannelStatus, DetectionEvent, Sample, Segment


def _stat_event_rules(registry: dict[str, Any]) -> tuple[float, float, float]:
    rules = registry["event_rules"]
    return (
        float(rules["stat_min_duration_sec"]),
        float(rules["stat_confirmed_duration_sec"]),
        float(rules["merge_gap_sec"]),
    )


def detect_ch1(
    samples: list[Sample], segments: list[Segment], device: dict[str, Any], registry: dict[str, Any]
) -> tuple[list[DetectionEvent], ChannelStatus]:
    events: list[DetectionEvent] = []
    feature_spec = device["feature_spec"]
    min_duration, confirmed_duration, merge_gap = _stat_event_rules(registry)
    eligible = 0
    for segment in segments:
        if segment.type != "cruise" or segment.n_samples < registry["regime"]["min_cruise_samples"]:
            continue
        eligible += segment.n_samples
        for group_id, group in device["ch1"]["groups"].items():
            if not group.get("active"):
                continue
            models = group.get("models", {})
            scored_by_key: dict[str, list[tuple[int, float, dict[str, Any]]]] = defaultdict(list)
            for index in range(segment.start_idx, segment.end_idx):
                sample = samples[index]
                residuals: dict[str, float] = {}
                for key, model in models.items():
                    value = sample.values.get(key)
                    prediction = predict_model(sample.values, feature_spec, model)
                    if finite(value) and prediction is not None:
                        residuals[key] = float(value) - prediction
                if len(residuals) < 4:
                    continue
                row_center = median(list(residuals.values()))
                for key, residual in residuals.items():
                    model = models[key]
                    sigma = max(float(model["deviation_sigma"]), 1e-9)
                    deviation = residual - row_center
                    z_score = abs(deviation - float(model["deviation_center"])) / sigma
                    threshold = float(group["z_threshold"])
                    if z_score >= threshold:
                        scored_by_key[key].append(
                            (index, z_score, {"deviation": round(deviation, 6), "z_score": round(z_score, 6)})
                        )
            for key, scored in scored_by_key.items():
                point = point_by_key(key)
                events.extend(
                    extract_scored_events(
                        samples=samples,
                        scored=scored,
                        channel=Channel.INTER_CYL,
                        event_type="inter_cylinder_consistency",
                        sensors=[key],
                        groups=[group["group"]],
                        threshold=float(group["z_threshold"]),
                        regime="cruise",
                        min_duration_sec=min_duration,
                        merge_gap_sec=merge_gap,
                        object_id=point.object_id if point else None,
                        bank=point.bank if point else group.get("bank"),
                        cylinder=point.cylinder if point else None,
                        allow_candidate_confirmed=True,
                        confirmed_duration_sec=confirmed_duration,
                        min_points=max(int(min_duration / registry["regime"]["sample_interval_sec"] * 0.5), 2),
                    )
                )
    reason = "ok" if eligible else "no_stable_cruise_segment"
    return events, ChannelStatus(Channel.INTER_CYL.value, bool(eligible), reason, eligible, len(events))


def detect_ch2(
    samples: list[Sample], segments: list[Segment], device: dict[str, Any], registry: dict[str, Any]
) -> tuple[list[DetectionEvent], ChannelStatus]:
    events: list[DetectionEvent] = []
    feature_spec = device["feature_spec"]
    min_duration, confirmed_duration, merge_gap = _stat_event_rules(registry)
    eligible = 0
    for segment in segments:
        if segment.type != "cruise" or segment.n_samples < registry["regime"]["min_cruise_samples"]:
            continue
        eligible += segment.n_samples
        for key, model in device["ch2"]["models"].items():
            scored: list[tuple[int, float, dict[str, Any]]] = []
            threshold = float(model["z_threshold"])
            for index in range(segment.start_idx, segment.end_idx):
                sample = samples[index]
                value = sample.values.get(key)
                prediction = predict_model(sample.values, feature_spec, model)
                if not finite(value) or prediction is None:
                    continue
                residual = float(value) - prediction
                z_score = abs(residual - float(model["residual_center"])) / max(
                    float(model["residual_sigma"]), 1e-9
                )
                if z_score >= threshold:
                    scored.append(
                        (index, z_score, {"actual": value, "predicted": round(prediction, 6), "z_score": round(z_score, 6)})
                    )
            events.extend(
                extract_scored_events(
                    samples=samples,
                    scored=scored,
                    channel=Channel.ABS_AR,
                    event_type="absolute_condition_residual",
                    sensors=[key],
                    groups=[model["group"]],
                    threshold=threshold,
                    regime="cruise",
                    min_duration_sec=min_duration,
                    merge_gap_sec=merge_gap,
                    object_id=model.get("object_id"),
                    bank=model.get("bank"),
                    cylinder=model.get("cylinder"),
                    allow_candidate_confirmed=True,
                    confirmed_duration_sec=confirmed_duration,
                    min_points=max(int(min_duration / registry["regime"]["sample_interval_sec"] * 0.5), 2),
                )
            )
    reason = "ok" if eligible else "no_stable_cruise_segment"
    return events, ChannelStatus(Channel.ABS_AR.value, bool(eligible), reason, eligible, len(events))


def detect_ch3(
    samples: list[Sample], segments: list[Segment], device: dict[str, Any], registry: dict[str, Any]
) -> tuple[list[DetectionEvent], ChannelStatus]:
    events: list[DetectionEvent] = []
    feature_spec = device["feature_spec"]
    min_duration, confirmed_duration, merge_gap = _stat_event_rules(registry)
    eligible = 0
    for segment in segments:
        if segment.type != "cruise" or segment.n_samples < registry["regime"]["min_cruise_samples"]:
            continue
        eligible += segment.n_samples
        for pair_id, model in device["ch3"]["models"].items():
            scored: list[tuple[int, float, dict[str, Any]]] = []
            threshold = float(model["z_threshold"])
            for index in range(segment.start_idx, segment.end_idx):
                sample = samples[index]
                a, b = sample.values.get(model["a"]), sample.values.get(model["b"])
                if not finite(a) or not finite(b):
                    continue
                derived_values = dict(sample.values)
                derived_values[pair_id] = float(a) - float(b)
                prediction = predict_model(derived_values, feature_spec, model)
                if prediction is None:
                    continue
                delta = derived_values[pair_id]
                residual = delta - prediction
                z_score = abs(residual - float(model["residual_center"])) / max(
                    float(model["residual_sigma"]), 1e-9
                )
                if z_score >= threshold:
                    scored.append(
                        (index, z_score, {"delta": round(delta, 6), "predicted_delta": round(prediction, 6), "meaning": model.get("meaning", ""), "z_score": round(z_score, 6)})
                    )
            events.extend(
                extract_scored_events(
                    samples=samples,
                    scored=scored,
                    channel=Channel.DT_AR,
                    event_type="topology_temperature_delta_residual",
                    sensors=[model["a"], model["b"]],
                    groups=[model["group"]],
                    threshold=threshold,
                    regime="cruise",
                    min_duration_sec=min_duration,
                    merge_gap_sec=merge_gap,
                    object_id=model.get("object_id"),
                    bank=model.get("bank"),
                    cylinder=model.get("cylinder"),
                    allow_candidate_confirmed=True,
                    confirmed_duration_sec=confirmed_duration,
                    min_points=max(int(min_duration / registry["regime"]["sample_interval_sec"] * 0.5), 2),
                )
            )
    reason = "ok" if eligible else "no_stable_cruise_segment"
    return events, ChannelStatus(Channel.DT_AR.value, bool(eligible), reason, eligible, len(events))


def detect_mid(
    samples: list[Sample], segments: list[Segment], device: dict[str, Any], registry: dict[str, Any]
) -> tuple[list[DetectionEvent], ChannelStatus]:
    events: list[DetectionEvent] = []
    merge_gap = float(registry["event_rules"]["merge_gap_sec"])
    min_duration = float(registry["event_rules"]["mid_min_duration_sec"])
    eligible = 0
    for segment in segments:
        if segment.type not in {"low_speed", "mid"}:
            continue
        eligible += segment.n_samples
        for group_id, group in device["mid"]["groups"].items():
            if not group.get("active"):
                continue
            scored_by_key: dict[str, list[tuple[int, float, dict[str, Any]]]] = defaultdict(list)
            threshold = float(group["high_threshold"])
            for index in range(segment.start_idx, segment.end_idx):
                sample = samples[index]
                available = {
                    key: float(sample.values[key])
                    for key in group["members"]
                    if finite(sample.values.get(key))
                }
                if len(available) < 4:
                    continue
                for key, value in available.items():
                    peer_center = median([other for other_key, other in available.items() if other_key != key])
                    deviation = abs(value - peer_center)
                    if deviation >= threshold:
                        scored_by_key[key].append(
                            (index, deviation, {"deviation": round(deviation, 6), "peer_median": round(peer_center, 6)})
                        )
            for key, scored in scored_by_key.items():
                point = point_by_key(key)
                events.extend(
                    extract_scored_events(
                        samples=samples,
                        scored=scored,
                        channel=Channel.MID_INTER_CYL,
                        event_type="low_mid_speed_physical_consistency",
                        sensors=[key],
                        groups=[group["group"]],
                        threshold=threshold,
                        regime=segment.type,
                        min_duration_sec=min_duration,
                        merge_gap_sec=merge_gap,
                        object_id=point.object_id if point else None,
                        bank=point.bank if point else group.get("bank"),
                        cylinder=point.cylinder if point else None,
                        low_confidence=True,
                        low_confidence_reason="低速/中速物理一致性通道不单独确认",
                        min_points=max(int(min_duration / registry["regime"]["sample_interval_sec"] * 0.5), 2),
                    )
                )
    reason = "ok" if eligible else "no_low_or_mid_segment"
    return events, ChannelStatus(Channel.MID_INTER_CYL.value, bool(eligible), reason, eligible, len(events))


def detect_stopped(
    samples: list[Sample], segments: list[Segment], device: dict[str, Any], registry: dict[str, Any]
) -> tuple[list[DetectionEvent], ChannelStatus]:
    events: list[DetectionEvent] = []
    groups_by_id = {item["id"]: item for item in registry["ch1_groups"]}
    merge_gap = float(registry["event_rules"]["merge_gap_sec"])
    min_duration = float(registry["event_rules"]["stopped_min_duration_sec"])
    eligible = 0
    for segment in segments:
        if segment.type != "stopped" or segment.n_samples < 2:
            continue
        eligible += segment.n_samples
        stopped = device["stopped"]
        for group_id, config in stopped["bearing_rise"].items():
            members = group_members(groups_by_id[group_id])
            for key in members:
                scored: list[tuple[int, float, dict[str, Any]]] = []
                threshold = float(config["rise_per_sample_high"])
                for index in range(segment.start_idx + 1, segment.end_idx):
                    now, before = samples[index].values.get(key), samples[index - 1].values.get(key)
                    if finite(now) and finite(before) and float(now) - float(before) >= threshold:
                        rise = float(now) - float(before)
                        scored.append((index, rise, {"rise_per_sample": round(rise, 6)}))
                point = point_by_key(key)
                events.extend(
                    extract_scored_events(
                        samples=samples, scored=scored, channel=Channel.STOPPED,
                        event_type="stopped_bearing_temperature_rise", sensors=[key],
                        groups=[groups_by_id[group_id]["group"]], threshold=threshold,
                        regime="stopped", min_duration_sec=min_duration, merge_gap_sec=merge_gap,
                        object_id=point.object_id if point else None, bank=point.bank if point else None,
                        cylinder=point.cylinder if point else None,
                        low_confidence=True, low_confidence_reason="停机单通道候选需运行态证据或人工复核",
                    )
                )
        for group_id, config in stopped["exhaust_cooling"].items():
            members = group_members(groups_by_id[group_id])
            scored_by_key: dict[str, list[tuple[int, float, dict[str, Any]]]] = defaultdict(list)
            threshold = float(config["high_threshold"])
            for index in range(segment.start_idx, segment.end_idx):
                available = {
                    key: float(samples[index].values[key]) for key in members
                    if finite(samples[index].values.get(key))
                }
                if len(available) < 4 or median(list(available.values())) >= float(config["activation_median_below"]):
                    continue
                center = median(list(available.values()))
                for key, value in available.items():
                    deviation = abs(value - center)
                    if deviation >= threshold:
                        scored_by_key[key].append((index, deviation, {"deviation": round(deviation, 6), "group_median": round(center, 6)}))
            for key, scored in scored_by_key.items():
                point = point_by_key(key)
                events.extend(
                    extract_scored_events(
                        samples=samples, scored=scored, channel=Channel.STOPPED,
                        event_type="stopped_exhaust_cooling_inconsistency", sensors=[key],
                        groups=[groups_by_id[group_id]["group"]], threshold=threshold,
                        regime="stopped", min_duration_sec=min_duration, merge_gap_sec=merge_gap,
                        object_id=point.object_id if point else None, bank=point.bank if point else None,
                        cylinder=point.cylinder if point else None,
                        low_confidence=True, low_confidence_reason="停机冷却偏差候选需人工复核",
                    )
                )
        history: deque[int] = deque()
        scored_by_group: dict[tuple[str, str], list[tuple[int, float, dict[str, Any]]]] = defaultdict(list)
        for index in range(segment.start_idx, segment.end_idx):
            history.append(index)
            while history and (samples[index].timestamp - samples[history[0]].timestamp).total_seconds() > 70:
                history.popleft()
            comparison = next((old for old in history if 50 <= (samples[index].timestamp - samples[old].timestamp).total_seconds() <= 70), None)
            if comparison is None:
                continue
            for group_id, config in stopped["reheat"].items():
                threshold = float(config["rise_60s_high"])
                for key in group_members(groups_by_id[group_id]):
                    now, before = samples[index].values.get(key), samples[comparison].values.get(key)
                    if finite(now) and finite(before) and float(now) - float(before) >= threshold:
                        rise = float(now) - float(before)
                        scored_by_group[(group_id, key)].append((index, rise, {"rise_60s": round(rise, 6)}))
        for (group_id, key), scored in scored_by_group.items():
            threshold = float(stopped["reheat"][group_id]["rise_60s_high"])
            point = point_by_key(key)
            events.extend(
                extract_scored_events(
                    samples=samples, scored=scored, channel=Channel.STOPPED,
                    event_type="stopped_temperature_reheat", sensors=[key],
                    groups=[groups_by_id[group_id]["group"]], threshold=threshold,
                    regime="stopped", min_duration_sec=min_duration, merge_gap_sec=merge_gap,
                    object_id=point.object_id if point else None, bank=point.bank if point else None,
                    cylinder=point.cylinder if point else None,
                    low_confidence=True, low_confidence_reason="停机复热候选需人工复核",
                )
            )
    reason = "ok" if eligible else "no_stopped_segment"
    return events, ChannelStatus(Channel.STOPPED.value, bool(eligible), reason, eligible, len(events))


def detect_iqr(
    samples: list[Sample], segments: list[Segment], device: dict[str, Any], registry: dict[str, Any]
) -> tuple[list[DetectionEvent], ChannelStatus, int, int]:
    events: list[DetectionEvent] = []
    total_points = 0
    anomaly_points = 0
    min_samples = int(registry["iqr"]["min_samples"])
    sigma_factor = float(registry["iqr"]["sigma_factor"])
    merge_gap = float(registry["event_rules"]["merge_gap_sec"])
    for segment in segments:
        if segment.n_samples < min_samples or segment.type == "unknown":
            continue
        factor = float(device.get("iqr_factor_by_regime", registry["iqr"]["factor_by_regime"])[segment.type])
        for point in point_specs():
            if not point.iqr or point.kind != "continuous":
                continue
            rows = [(index, float(samples[index].values[point.key])) for index in range(segment.start_idx, segment.end_idx) if finite(samples[index].values.get(point.key))]
            if len(rows) < min_samples:
                continue
            values = [value for _, value in rows]
            q1, q3 = quantile(values, 0.25), quantile(values, 0.75)
            spread = q3 - q1
            center = median(values)
            sigma = robust_sigma(values, floor=max(stdev(values) * 0.1, 1e-6))
            lower, upper = q1 - factor * spread, q3 + factor * spread
            total_points += len(rows)
            scored: list[tuple[int, float, dict[str, Any]]] = []
            for index, value in rows:
                z_score = abs(value - center) / sigma
                if (value < lower or value > upper) and z_score > sigma_factor:
                    anomaly_points += 1
                    scored.append((index, z_score, {"value": value, "q1": round(q1, 6), "q3": round(q3, 6), "iqr_factor": factor, "z_score": round(z_score, 6)}))
            events.extend(
                extract_scored_events(
                    samples=samples, scored=scored, channel=Channel.IQR,
                    event_type="iqr_outlier_candidate", sensors=[point.key], groups=[point.group],
                    threshold=sigma_factor, regime=segment.type, min_duration_sec=0.0,
                    merge_gap_sec=merge_gap, object_id=point.object_id, bank=point.bank,
                    cylinder=point.cylinder, low_confidence=True,
                    low_confidence_reason="IQR通道仅生成候选，不独立确认",
                )
            )
    active = total_points > 0
    reason = "ok" if active else "no_segment_with_enough_samples"
    return events, ChannelStatus(Channel.IQR.value, active, reason, total_points, len(events)), total_points, anomaly_points

from __future__ import annotations

from collections import defaultdict
from typing import Any

from .types import Channel, DetectionEvent, Level


def _overlap(left: DetectionEvent, right: DetectionEvent) -> bool:
    return left.time_start <= right.time_end and right.time_start <= left.time_end


def _severity(event: DetectionEvent, scale: float) -> float:
    excess = max(event.raw_score - event.threshold, 0.0)
    return min(excess / max(scale, 1e-9), 1.0)


def _physical_group(group: str) -> str:
    if group.startswith("exhaust_") or group == "exhaust_temp":
        return "exhaust_temp"
    if group.startswith("liner_") or group == "liner_temp":
        return "liner_temp"
    if group.startswith("big_end"):
        return "big_end_bearing"
    if group.startswith("main_bearing"):
        return "main_bearing"
    if group.startswith("turbo_exhaust"):
        return "turbo_exhaust"
    if group.startswith("ht_water"):
        return "ht_water"
    if group.startswith("lt_water"):
        return "lt_water"
    return group


def score_events(events: list[DetectionEvent], device: dict[str, Any], registry: dict[str, Any]) -> list[DetectionEvent]:
    """Apply channel 08 evidence scoring without allowing IQR-only confirmation."""
    scoring = registry["scoring"]
    weights = scoring["weights"]
    scales = device["normalization_scales"]
    by_object: dict[str, list[DetectionEvent]] = defaultdict(list)
    for event in events:
        by_object[event.object_id or f"sensor:{event.sensors[0]}"] .append(event)

    for object_events in by_object.values():
        for event in object_events:
            peers = [peer for peer in object_events if peer is not event and _overlap(event, peer)]
            physical_groups = {_physical_group(group) for group in event.groups}
            physical_groups.update(_physical_group(group) for peer in peers for group in peer.groups)
            channels = {event.channel.value, *(peer.channel.value for peer in peers)}
            supporting_channels = {Channel.IQR.value, Channel.NF.value, Channel.NF_MIDLOW.value}
            non_supporting_channels = {channel for channel in channels if channel not in supporting_channels}
            cross_group = min(max(len(physical_groups) - 1, 0) / 2.0, 1.0)
            severity = max(
                [_severity(candidate, float(scales.get(candidate.channel.value, 1.0))) for candidate in [event, *peers]],
                default=0.0,
            )
            outlier = 1.0 if event.cylinder is not None else 0.5
            duration = min(max([event.duration_min, *(peer.duration_min for peer in peers)], default=0.0) / 30.0, 1.0)
            raw_score = (
                float(weights["cross_group"]) * cross_group
                + float(weights["severity"]) * severity
                + float(weights["outlier"]) * outlier
                + float(weights["duration"]) * duration
            )
            modifier = float(scoring["regime_modifiers"].get(event.regime, 0.5))
            confidence = max(0.0, min(raw_score * modifier, 1.0))
            event.confidence_score = confidence
            independent_candidate = event.candidate_confirmed and event.channel in {
                Channel.INTER_CYL, Channel.ABS_AR, Channel.DT_AR
            }
            cross_confirmed = (
                len(non_supporting_channels) >= 2
                and len(physical_groups) >= 2
                and confidence >= float(scoring["confirmed"])
            )
            event.confirmed = bool(
                event.regime == "cruise"
                and event.channel not in {Channel.IQR, Channel.NF, Channel.NF_MIDLOW}
                and (independent_candidate or cross_confirmed)
            )
            if event.confirmed:
                event.level = Level.CONFIRMED
            elif confidence >= float(scoring["high"]):
                event.level = Level.HIGH
            elif confidence >= float(scoring["comodal"]):
                event.level = Level.COMODAL
            else:
                event.level = Level.LOW
            event.details["evidence"] = {
                "overlap_channels": sorted(channels),
                "overlap_groups": sorted(physical_groups),
                "cross_group": round(cross_group, 6),
                "severity": round(severity, 6),
                "outlier": round(outlier, 6),
                "duration": round(duration, 6),
                "regime_modifier": modifier,
            }
    return events

from __future__ import annotations

from typing import Any

from .types import Channel, DetectionEvent, Level, Sample


def extract_scored_events(
    *,
    samples: list[Sample],
    scored: list[tuple[int, float, dict[str, Any]]],
    channel: Channel,
    event_type: str,
    sensors: list[str],
    groups: list[str],
    threshold: float,
    regime: str,
    min_duration_sec: float,
    merge_gap_sec: float,
    object_id: str | None = None,
    bank: str | None = None,
    cylinder: int | None = None,
    allow_candidate_confirmed: bool = False,
    confirmed_duration_sec: float = 0.0,
    low_confidence: bool = False,
    low_confidence_reason: str = "",
    min_points: int = 1,
) -> list[DetectionEvent]:
    """Turn anomalous sample scores into time-contiguous candidate events."""
    if not scored:
        return []
    ordered = sorted(scored, key=lambda item: item[0])
    runs: list[list[tuple[int, float, dict[str, Any]]]] = []
    current: list[tuple[int, float, dict[str, Any]]] = []
    for item in ordered:
        index = item[0]
        if current:
            previous_index = current[-1][0]
            gap = (samples[index].timestamp - samples[previous_index].timestamp).total_seconds()
            if gap > merge_gap_sec:
                runs.append(current)
                current = []
        current.append(item)
    if current:
        runs.append(current)

    events: list[DetectionEvent] = []
    for run in runs:
        if len(run) < min_points:
            continue
        first_idx, last_idx = run[0][0], run[-1][0]
        elapsed = max((samples[last_idx].timestamp - samples[first_idx].timestamp).total_seconds(), 0.0)
        if elapsed < min_duration_sec:
            continue
        peak = max(score for _, score, _ in run)
        details = max(run, key=lambda item: item[1])[2]
        candidate_confirmed = bool(
            allow_candidate_confirmed
            and elapsed >= confirmed_duration_sec
            and peak >= threshold + 1.0
        )
        events.append(
            DetectionEvent(
                channel=channel,
                event_type=event_type,
                equipment_id=samples[first_idx].equipment_id,
                equipment_name=samples[first_idx].equipment_name,
                sensors=list(sensors),
                groups=list(groups),
                time_start=samples[first_idx].timestamp,
                time_end=samples[last_idx].timestamp,
                duration_min=elapsed / 60.0,
                n_points=len(run),
                raw_score=peak,
                threshold=threshold,
                regime=regime,
                level=Level.HIGH,
                object_id=object_id,
                bank=bank,
                cylinder=cylinder,
                candidate_confirmed=candidate_confirmed,
                low_confidence=low_confidence,
                low_confidence_reason=low_confidence_reason,
                details=details,
            )
        )
    return events

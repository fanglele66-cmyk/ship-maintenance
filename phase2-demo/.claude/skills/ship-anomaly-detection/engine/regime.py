from __future__ import annotations

from collections import deque
from datetime import datetime
from typing import Iterable

from .math_utils import mean, stdev
from .registry import load_registry
from .types import Sample, Segment


def _stats(values: list[float]) -> dict[str, float]:
    if not values:
        return {"mean": 0.0, "std": 0.0, "min": 0.0, "max": 0.0}
    return {
        "mean": round(mean(values), 4),
        "std": round(stdev(values), 4),
        "min": round(min(values), 4),
        "max": round(max(values), 4),
    }


def classify_samples(samples: list[Sample], config: dict | None = None) -> tuple[list[str], list[bool]]:
    regime = config or load_registry()["regime"]
    window_seconds = float(regime["stability_window_sec"])
    gap_reset = float(regime["gap_reset_sec"])
    rolling: deque[tuple[datetime, float, float]] = deque()
    labels: list[str] = []
    gap_before: list[bool] = []
    previous_time: datetime | None = None
    previous_running = False
    start_time: datetime | None = None

    for sample in samples:
        rpm = sample.values.get("rpm", 0.0)
        load = sample.values.get("load", 0.0)
        gap = previous_time is not None and (sample.timestamp - previous_time).total_seconds() > gap_reset
        gap_before.append(bool(gap))
        if gap:
            rolling.clear()
            previous_running = False
            start_time = None

        running = rpm >= float(regime["stopped_rpm_max"])
        if running and not previous_running and previous_time is not None:
            start_time = sample.timestamp
        elif not running:
            start_time = None

        rolling.append((sample.timestamp, rpm, load))
        while rolling and (sample.timestamp - rolling[0][0]).total_seconds() > window_seconds:
            rolling.popleft()

        if rpm < float(regime["stopped_rpm_max"]):
            label = "stopped"
        elif rpm < float(regime["low_speed_rpm_max"]):
            label = "low_speed"
        elif rpm < float(regime["mid_rpm_max"]):
            label = "mid"
        else:
            rpm_values = [row[1] for row in rolling]
            load_values = [row[2] for row in rolling]
            stable = (
                len(rolling) >= int(regime["min_stability_samples"])
                and stdev(rpm_values) <= float(regime["rpm_std_max"])
                and stdev(load_values) <= float(regime["load_std_max"])
            )
            label = "cruise" if stable else "maneuver"
        if running and start_time and (
            sample.timestamp - start_time
        ).total_seconds() < float(regime["warmup_sec"]):
            label = "warmup"

        labels.append(label)
        previous_time = sample.timestamp
        previous_running = running
    return labels, gap_before


def segment_by_regime(samples: list[Sample], config: dict | None = None) -> list[Segment]:
    if not samples:
        return []
    regime = config or load_registry()["regime"]
    labels, gap_before = classify_samples(samples, regime)
    boundaries: list[tuple[str, int, int, bool]] = []
    start = 0
    current = labels[0]
    current_gap = gap_before[0]
    for index in range(1, len(samples)):
        if labels[index] != current or gap_before[index]:
            boundaries.append((current, start, index, current_gap))
            start = index
            current = labels[index]
            current_gap = gap_before[index]
    boundaries.append((current, start, len(samples), current_gap))

    min_seconds = float(regime["min_segment_sec"])
    changed = True
    while changed and len(boundaries) > 1:
        changed = False
        for index, (_, start_idx, end_idx, gap) in enumerate(boundaries):
            duration = (samples[end_idx - 1].timestamp - samples[start_idx].timestamp).total_seconds()
            if duration >= min_seconds or gap:
                continue
            previous = boundaries[index - 1] if index > 0 else None
            following = boundaries[index + 1] if index + 1 < len(boundaries) else None
            if previous and not boundaries[index][3]:
                merged = (previous[0], previous[1], end_idx, previous[3])
                boundaries[index - 1:index + 1] = [merged]
                changed = True
                break
            if following and not following[3]:
                merged = (following[0], start_idx, following[2], gap)
                boundaries[index:index + 2] = [merged]
                changed = True
                break

    segments: list[Segment] = []
    for label, start_idx, end_idx, gap in boundaries:
        rpm_values = [sample.values.get("rpm", 0.0) for sample in samples[start_idx:end_idx]]
        load_values = [sample.values.get("load", 0.0) for sample in samples[start_idx:end_idx]]
        segments.append(
            Segment(
                type=label,
                start_idx=start_idx,
                end_idx=end_idx,
                start_time=samples[start_idx].timestamp,
                end_time=samples[end_idx - 1].timestamp,
                rpm_stats=_stats(rpm_values),
                load_stats=_stats(load_values),
                gap_before=gap,
            )
        )
    return segments


def labels_from_segments(length: int, segments: Iterable[Segment]) -> list[str]:
    labels = ["unknown"] * length
    for segment in segments:
        labels[segment.start_idx:segment.end_idx] = [segment.type] * segment.n_samples
    return labels

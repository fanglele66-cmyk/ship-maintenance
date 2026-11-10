"""Deterministic mapping from detector events to the platform three-state result."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

import pandas as pd

from .types import Channel, Event, Level
from .utils import extract_cylinder


def _value(obj: Any, name: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _enum_value(value: Any) -> str:
    return value.value if hasattr(value, "value") else str(value)


def _cylinder(obj: Event | dict) -> int | None:
    return extract_cylinder(_value(obj, "sensors", []) or [])


def _event_id(obj: Event | dict) -> str:
    return _value(obj, "id", _value(obj, "event_id", "")) or ""


def _parse_timestamp(value: Any) -> pd.Timestamp | None:
    ts = pd.to_datetime(value, errors="coerce")
    if pd.isna(ts):
        return None
    return ts


def _overlaps_event(
    event: Event | dict,
    start: pd.Timestamp,
    end: pd.Timestamp,
    tolerance_min: float = 5.0,
) -> bool:
    event_start = _parse_timestamp(_value(event, "time_start"))
    event_end = _parse_timestamp(_value(event, "time_end"))
    if event_start is None or event_end is None:
        return False
    if event_end < event_start:
        event_start, event_end = event_end, event_start

    tolerance = pd.Timedelta(minutes=tolerance_min)
    return event_start <= end + tolerance and event_end >= start - tolerance


def _find_redundant_control_air_low_support(
    events: list[Event | dict],
    sensor_data: Any | None,
) -> dict[str, Any] | None:
    """Find dual control-air low pressure supported by an existing event.

    This is result-policy evidence, not a new detector channel. It only
    upgrades when an already detected non-low-confidence High/Confirmed event
    overlaps a sustained redundant physical limit breach in the raw data.
    """
    if sensor_data is None or not hasattr(sensor_data, "columns"):
        return None

    required = {"timestamp", "rpm", "ctrl_air_press", "ctrl_air_press_safety"}
    if not required.issubset(set(sensor_data.columns)):
        return None

    sub = sensor_data.loc[:, list(required)].copy()
    for col in ("rpm", "ctrl_air_press", "ctrl_air_press_safety"):
        sub[col] = pd.to_numeric(sub[col], errors="coerce")
    sub["timestamp"] = pd.to_datetime(sub["timestamp"], errors="coerce")
    sub = sub.dropna().sort_values("timestamp")
    if len(sub) < 3:
        return None

    low_mask = (
        (sub["rpm"] >= 93)
        & (sub["ctrl_air_press"] < 0.60)
        & (sub["ctrl_air_press_safety"] < 0.60)
    )
    if not bool(low_mask.any()):
        return None

    segment_break = low_mask.ne(low_mask.shift(fill_value=False))
    segment_break |= sub["timestamp"].diff().dt.total_seconds().fillna(0).gt(120)
    segment_ids = segment_break.cumsum()

    for _, segment in sub.loc[low_mask].groupby(segment_ids[low_mask]):
        duration_min = (
            segment["timestamp"].iloc[-1] - segment["timestamp"].iloc[0]
        ).total_seconds() / 60.0
        if duration_min < 5.0:
            continue

        supporting_events = [
            e for e in events
            if _enum_value(_value(e, "level")) in {
                Level.HIGH.value,
                Level.CONFIRMED.value,
            }
            and _enum_value(_value(e, "channel")) != Channel.STOPPED.value
            and not bool(_value(e, "low_confidence", False))
            and _overlaps_event(
                e,
                segment["timestamp"].iloc[0],
                segment["timestamp"].iloc[-1],
            )
        ]
        if supporting_events:
            return {
                "event_ids": [_event_id(e) for e in supporting_events],
                "time_start": str(segment["timestamp"].iloc[0]),
                "time_end": str(segment["timestamp"].iloc[-1]),
                "duration_min": round(duration_min, 1),
                "min_ctrl_air_press": float(segment["ctrl_air_press"].min()),
                "min_ctrl_air_press_safety": float(
                    segment["ctrl_air_press_safety"].min()
                ),
            }
    return None


def decide_platform_result(
    events: Iterable[Event | dict],
    sensor_data: Any | None = None,
) -> dict[str, Any]:
    """Return the minimum platform result justified by detector evidence.

    The policy deliberately does not upgrade to ``confirmed`` because that
    still requires Wiki/case matching. Any valid single-sensor Confirmed event
    is nevertheless protected as ``anomalyDetected`` at minimum.
    """
    event_list = list(events)
    if not event_list:
        return {
            "result": "abnormalFlag",
            "reason": "no_events",
            "evidence_event_ids": [],
        }

    valid_confirmed = [
        e for e in event_list
        if _enum_value(_value(e, "level")) == Level.CONFIRMED.value
        and bool(_value(e, "confirmed", False))
        and not bool(_value(e, "low_confidence", False))
    ]
    # Protect real cylinder faults: at least two independent sensor groups
    # point to the same cylinder, with at least one valid Confirmed event.
    cylinder_groups: dict[int, set[str]] = {}
    cylinder_event_ids: dict[int, list[str]] = {}
    for e in event_list:
        if bool(_value(e, "low_confidence", False)):
            continue
        cyl = _cylinder(e)
        if cyl is None:
            continue
        cylinder_groups.setdefault(cyl, set()).update(_value(e, "groups", []) or [])
        cylinder_event_ids.setdefault(cyl, []).append(
            _value(e, "id", _value(e, "event_id", ""))
        )
    confirmed_cylinders = {_cylinder(e) for e in valid_confirmed}
    cross_confirmed_cylinders = [
        cyl for cyl, groups in cylinder_groups.items()
        if cyl in confirmed_cylinders and len(groups) >= 2
    ]
    if cross_confirmed_cylinders:
        ids = [
            event_id
            for cyl in cross_confirmed_cylinders
            for event_id in cylinder_event_ids.get(cyl, [])
        ]
        return {
            "result": "anomalyDetected",
            "reason": "same_cylinder_cross_group_confirmed_evidence",
            "evidence_event_ids": ids,
        }

    if valid_confirmed:
        return {
            "result": "anomalyDetected",
            "reason": "valid_single_or_global_confirmed_requires_manual_confirmation",
            "evidence_event_ids": [_event_id(e) for e in valid_confirmed],
        }

    control_air_support = _find_redundant_control_air_low_support(
        event_list, sensor_data
    )
    if control_air_support:
        return {
            "result": "anomalyDetected",
            "reason": "existing_event_with_redundant_control_air_low_context",
            "evidence_event_ids": control_air_support["event_ids"],
            "physical_context": control_air_support,
        }

    return {
        "result": "abnormalFlag",
        "reason": "model_residual_without_physical_or_cross_group_confirmation",
        "evidence_event_ids": [],
    }

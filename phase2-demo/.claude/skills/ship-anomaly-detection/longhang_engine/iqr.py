"""Single-sensor IQR + 3-sigma candidate channel."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import numpy as np
import pandas as pd

from .loader import get_monitor_params
from .registry import get_group
from .types import Channel, Event, Level


SIGMA_FACTOR = 3.0
MIN_VALID_SAMPLES = 30

# Tukey's usual IQR factor is 1.5. These factors are intentionally more
# conservative because this channel is meant to stay under roughly 3% point
# hits on broad normal cruise replay data.
IQR_FACTOR_BY_REGIME = {
    "cruise": 3.5,
    "transition": 4.0,
    "maneuver": 5.0,
    "low_speed": 5.5,
    "warmup": 5.5,
    "stopped": 6.0,
}

SENSITIVITY_MULT = {
    "strict": 1.0,
    "normal": 0.9,
    "relaxed": 0.8,
}

EXCLUDED_COLUMNS = {
    "rpm",
}


@dataclass
class IqrStats:
    total_points: int = 0
    anomaly_points: int = 0
    events: int = 0

    @property
    def point_rate(self) -> float:
        if self.total_points <= 0:
            return 0.0
        return self.anomaly_points / self.total_points


def detect_iqr(
    df: pd.DataFrame,
    segments: Iterable | None = None,
    sensitivity: str = "strict",
) -> list[Event]:
    """Detect single-sensor candidate anomalies with IQR and 3-sigma.

    A point is anomalous only when it is outside the regime-specific IQR fence
    and also beyond 3 standard deviations for the same sensor/regime slice.
    The channel never emits standalone confirmed events.
    """
    events, _ = detect_iqr_with_stats(df, segments, sensitivity)
    return events


def profile_iqr(
    df: pd.DataFrame,
    segments: Iterable | None = None,
    sensitivity: str = "strict",
) -> IqrStats:
    """Return point-hit statistics for ch_iqr without changing semantics."""
    _, stats = detect_iqr_with_stats(df, segments, sensitivity)
    return stats


def detect_iqr_with_stats(
    df: pd.DataFrame,
    segments: Iterable | None,
    sensitivity: str,
) -> tuple[list[Event], IqrStats]:
    if df.empty or "timestamp" not in df.columns:
        return [], IqrStats()

    sensor_cols = _sensor_columns(df)
    if not sensor_cols:
        return [], IqrStats()

    events: list[Event] = []
    stats = IqrStats()
    sens_mult = SENSITIVITY_MULT.get(sensitivity, 1.0)

    for regime, seg_df in _iter_regime_frames(df, segments):
        if len(seg_df) < MIN_VALID_SAMPLES:
            continue
        factor = IQR_FACTOR_BY_REGIME.get(regime, 4.5) * sens_mult

        for sensor in sensor_cols:
            if sensor not in seg_df.columns:
                continue
            series = pd.to_numeric(seg_df[sensor], errors="coerce")
            valid = series.dropna()
            if len(valid) < MIN_VALID_SAMPLES:
                continue

            q1 = float(valid.quantile(0.25))
            q3 = float(valid.quantile(0.75))
            iqr = q3 - q1
            sigma = float(valid.std(ddof=0))
            if not np.isfinite(iqr) or not np.isfinite(sigma):
                continue
            if iqr <= 1e-9 or sigma <= 1e-9:
                continue

            mean = float(valid.mean())
            lower = q1 - factor * iqr
            upper = q3 + factor * iqr
            values = series.loc[valid.index]

            iqr_mask = (values < lower) | (values > upper)
            sigma_z = (values - mean).abs() / sigma
            sigma_mask = sigma_z > SIGMA_FACTOR
            mask = (iqr_mask & sigma_mask).reindex(seg_df.index, fill_value=False)

            stats.total_points += len(valid)
            stats.anomaly_points += int(mask.sum())

            if not bool(mask.any()):
                continue

            events.extend(
                _events_from_mask(
                    seg_df,
                    sensor,
                    regime,
                    mask,
                    sigma_z.reindex(seg_df.index),
                    values.reindex(seg_df.index),
                    q1,
                    q3,
                    iqr,
                    factor,
                )
            )

    stats.events = len(events)
    return events, stats


def _sensor_columns(df: pd.DataFrame) -> list[str]:
    return [
        c for c in get_monitor_params(df)
        if c not in EXCLUDED_COLUMNS
    ]


def _iter_regime_frames(df: pd.DataFrame, segments: Iterable | None):
    if segments is None:
        yield "cruise", df
        return

    yielded = False
    for seg in segments:
        start = int(getattr(seg, "start_idx", 0))
        end = int(getattr(seg, "end_idx", 0))
        if end <= start:
            continue
        yielded = True
        yield str(getattr(seg, "type", "unknown")), df.iloc[start:end].copy()

    if not yielded:
        yield "cruise", df


def _events_from_mask(
    seg_df: pd.DataFrame,
    sensor: str,
    regime: str,
    mask: pd.Series,
    sigma_z: pd.Series,
    values: pd.Series,
    q1: float,
    q3: float,
    iqr: float,
    factor: float,
) -> list[Event]:
    group_ids = mask.ne(mask.shift(fill_value=False)).cumsum()
    events: list[Event] = []

    for _, idx in mask[mask].groupby(group_ids[mask]):
        rows = list(idx.index)
        if not rows:
            continue

        z_slice = sigma_z.loc[rows].dropna()
        value_slice = values.loc[rows].dropna()
        if z_slice.empty or value_slice.empty:
            continue

        start_idx = rows[0]
        end_idx = rows[-1]
        t_start = pd.Timestamp(seg_df.loc[start_idx, "timestamp"])
        t_end = pd.Timestamp(seg_df.loc[end_idx, "timestamp"])
        if t_end <= t_start:
            pos = seg_df.index.get_indexer([end_idx])[0]
            if 0 <= pos + 1 < len(seg_df):
                t_end = pd.Timestamp(seg_df.iloc[pos + 1]["timestamp"])
            else:
                t_end = t_start + pd.Timedelta(seconds=12)
        duration_min = max((t_end - t_start).total_seconds() / 60.0, 0.0)
        max_sigma = float(z_slice.max())
        robust_distance = _max_iqr_distance(value_slice, q1, q3, iqr)
        severity_value = max(max_sigma, robust_distance)
        level = _candidate_level(severity_value, duration_min, len(rows))

        events.append(Event(
            id="",
            level=level,
            channel=Channel.IQR,
            type="iqr_sigma_spike",
            sensors=[sensor],
            groups=[get_group(sensor)],
            time_start=t_start.isoformat(),
            time_end=t_end.isoformat(),
            duration_min=round(duration_min, 1),
            max_z=round(max_sigma, 2),
            severity=round(severity_value, 3),
            confirmed=False,
            low_confidence=True,
            low_confidence_reason=(
                f"ch_iqr_candidate: regime={regime}, "
                f"iqr_factor={factor:.2f}, sigma>{SIGMA_FACTOR:.1f}"
            ),
        ))

    return events


def _max_iqr_distance(values: pd.Series, q1: float, q3: float, iqr: float) -> float:
    if iqr <= 0:
        return 0.0
    above = ((values - q3) / iqr).clip(lower=0.0)
    below = ((q1 - values) / iqr).clip(lower=0.0)
    return float(pd.concat([above, below], axis=1).max(axis=1).max())


def _candidate_level(severity: float, duration_min: float, n_points: int) -> Level:
    if severity >= 8.0 or duration_min >= 1.0 or n_points >= 5:
        return Level.HIGH
    return Level.COMODAL

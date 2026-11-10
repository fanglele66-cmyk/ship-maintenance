from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class Level(str, Enum):
    LOW = "Low"
    COMODAL = "CoModal"
    HIGH = "High"
    CONFIRMED = "Confirmed"


class Channel(str, Enum):
    INTER_CYL = "ch1_inter_cyl"
    ABS_AR = "ch2_abs_ar"
    DT_AR = "ch3_dt_ar"
    MID_INTER_CYL = "ch_mid_inter_cyl"
    STOPPED = "ch_stopped_phys"
    IQR = "ch_iqr"
    NF = "dl_nf_cruise"
    NF_MIDLOW = "dl_nf_midlow"


@dataclass(frozen=True)
class PointSpec:
    index: int
    key: str
    group: str
    unit: str
    kind: str = "continuous"
    object_id: str | None = None
    bank: str | None = None
    cylinder: int | None = None
    signed_16: bool = False
    ch2: bool = True
    iqr: bool = True
    stopped: bool = False


@dataclass
class Sample:
    timestamp: datetime
    equipment_id: str
    equipment_name: str
    values: dict[str, float]
    point_refs: dict[str, dict[str, Any]] = field(default_factory=dict)
    source_ref: str = ""


@dataclass
class Segment:
    type: str
    start_idx: int
    end_idx: int
    start_time: datetime
    end_time: datetime
    rpm_stats: dict[str, float] = field(default_factory=dict)
    load_stats: dict[str, float] = field(default_factory=dict)
    gap_before: bool = False

    @property
    def n_samples(self) -> int:
        return self.end_idx - self.start_idx

    @property
    def duration_min(self) -> float:
        return max((self.end_time - self.start_time).total_seconds() / 60.0, 0.0)


@dataclass
class DetectionEvent:
    channel: Channel
    event_type: str
    equipment_id: str
    equipment_name: str
    sensors: list[str]
    groups: list[str]
    time_start: datetime
    time_end: datetime
    duration_min: float
    n_points: int
    raw_score: float
    threshold: float
    regime: str
    level: Level = Level.HIGH
    object_id: str | None = None
    bank: str | None = None
    cylinder: int | None = None
    candidate_confirmed: bool = False
    confirmed: bool = False
    confidence_score: float = 0.0
    low_confidence: bool = False
    low_confidence_reason: str = ""
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "channel": self.channel.value,
            "event_type": self.event_type,
            "equipment_id": self.equipment_id,
            "equipment_name": self.equipment_name,
            "sensors": self.sensors,
            "groups": self.groups,
            "time_start": self.time_start.isoformat(),
            "time_end": self.time_end.isoformat(),
            "duration_min": round(self.duration_min, 3),
            "n_points": self.n_points,
            "raw_score": round(self.raw_score, 6),
            "threshold": round(self.threshold, 6),
            "regime": self.regime,
            "level": self.level.value,
            "object_id": self.object_id,
            "bank": self.bank,
            "cylinder": self.cylinder,
            "candidate_confirmed": self.candidate_confirmed,
            "confirmed": self.confirmed,
            "confidence_score": round(self.confidence_score, 6),
            "low_confidence": self.low_confidence,
            "low_confidence_reason": self.low_confidence_reason,
            "details": self.details,
        }


@dataclass
class ChannelStatus:
    channel: str
    active: bool
    reason: str
    n_samples: int = 0
    n_events: int = 0


@dataclass
class Evidence:
    object_id: str
    events: list[DetectionEvent]
    groups: set[str]
    channels: set[str]
    max_conf: float
    duration_min: float
    regime: str
    score: float = 0.0


@dataclass
class DetectionResult:
    equipment_id: str
    equipment_name: str
    samples: int
    segments: list[Segment]
    events: list[DetectionEvent]
    channel_status: list[ChannelStatus]
    iqr_total_points: int = 0
    iqr_anomaly_points: int = 0

    @property
    def confirmed_events(self) -> list[DetectionEvent]:
        return [event for event in self.events if event.confirmed]

    def to_dict(self) -> dict[str, Any]:
        return {
            "equipment_id": self.equipment_id,
            "equipment_name": self.equipment_name,
            "samples": self.samples,
            "segments": [
                {
                    "type": segment.type,
                    "start_idx": segment.start_idx,
                    "end_idx": segment.end_idx,
                    "start_time": segment.start_time.isoformat(),
                    "end_time": segment.end_time.isoformat(),
                    "n_samples": segment.n_samples,
                    "duration_min": round(segment.duration_min, 3),
                    "rpm_stats": segment.rpm_stats,
                    "load_stats": segment.load_stats,
                }
                for segment in self.segments
            ],
            "events": [event.to_dict() for event in self.events],
            "confirmed_events": len(self.confirmed_events),
            "channel_status": [status.__dict__ for status in self.channel_status],
            "iqr": {
                "total_points": self.iqr_total_points,
                "anomaly_points": self.iqr_anomaly_points,
                "point_rate": (
                    self.iqr_anomaly_points / self.iqr_total_points
                    if self.iqr_total_points
                    else 0.0
                ),
            },
        }

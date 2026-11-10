"""ship-anomaly-detection V7.0 — all engine data types."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class Level(str, Enum):
    CONFIRMED = "Confirmed"
    HIGH = "High"
    COMODAL = "CoModal"
    LOW = "Low"


class Channel(str, Enum):
    INTER_CYL = "ch1_inter_cyl"
    ABS_AR = "ch2_abs_ar"
    DT_AR = "ch3_dt_ar"
    LOW_SPEED = "ch_low_speed"
    MID_INTER_CYL = "ch_mid_inter_cyl"
    STOPPED = "ch_stopped_phys"
    IQR = "ch_iqr"
    DL = "dl"


@dataclass
class Event:
    id: str
    level: Level
    channel: Channel
    type: str
    sensors: list[str]
    groups: list[str]
    time_start: str
    time_end: str
    duration_min: float
    max_z: float
    severity: float
    confirmed: bool
    low_confidence: bool = False
    low_confidence_reason: str = ""


@dataclass
class ChannelStatus:
    """通道激活状态，记录每个通道是否运行及原因。"""
    channel: str
    active: bool
    reason: str
    n_samples: int = 0
    n_events: int = 0


@dataclass
class DetectResult:
    task_id: str
    version: str = "7.0.0"
    n_events: int = 0
    n_confirmed: int = 0
    n_alarm: int = 0
    n_info: int = 0
    events: list[Event] = field(default_factory=list)
    elapsed_sec: float = 0.0
    total_rows: int = 0
    valid_rows: int = 0
    rpm_min: float = 0.0
    rpm_max: float = 0.0
    duration_hours: float = 0.0
    sensitivity: str = "strict"
    z_offset: float = 0.0
    stat_status: str = "ok"
    dl_status: str = "ok"
    n_stat_only: int = 0
    n_dl_only: int = 0
    n_both: int = 0
    patches: list[str] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        ev_list = [
            {
                "event_id": e.id,
                "level": e.level.value,
                "type": e.type,
                "confirmed": e.confirmed,
                "severity": round(e.severity, 4),
                "time_start": e.time_start,
                "time_end": e.time_end,
                "duration_min": round(e.duration_min, 2),
                "max_z": round(e.max_z, 4),
                "sensors": e.sensors,
                "groups": e.groups,
                "channels": [e.channel.value],
                "low_confidence": e.low_confidence,
                "low_confidence_reason": e.low_confidence_reason,
                "charts": [],
            }
            for e in self.events
        ]
        return {
            "task_info": {
                "task_id": self.task_id,
                "version": self.version,
                "sensitivity": self.sensitivity,
                "z_offset": self.z_offset,
                "elapsed_sec": self.elapsed_sec,
                "total_rows": self.total_rows,
                "valid_rows": self.valid_rows,
                "rpm_min": self.rpm_min,
                "rpm_max": self.rpm_max,
                "duration_hours": self.duration_hours,
                "stat_status": self.stat_status,
                "dl_status": self.dl_status,
                "n_stat_only": self.n_stat_only,
                "n_dl_only": self.n_dl_only,
                "n_both": self.n_both,
                "patches": self.patches,
            },
            "summary": {
                "n_events": self.n_events,
                "n_confirmed": self.n_confirmed,
                "n_alarm": self.n_alarm,
                "n_info": self.n_info,
            },
            "events": ev_list,
        }


class EventEncoder(json.JSONEncoder):
    """JSON encoder for Event / DetectResult serialization."""
    def default(self, obj):
        if isinstance(obj, (Event, DetectResult)):
            return obj.to_json() if hasattr(obj, "to_json") else str(obj)
        if isinstance(obj, (Level, Channel)):
            return obj.value
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

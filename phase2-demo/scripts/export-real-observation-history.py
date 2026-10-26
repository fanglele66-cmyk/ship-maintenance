#!/usr/bin/env python3
"""Export exact, bounded ship.db samples for the event observation charts.

The database is opened read-only. No interpolation, decimation, rounding or
synthetic end point is applied. Run with --check to verify the committed fixture.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "src/mock/realObservationHistory.json"
CASE_CHANNELS = {
    "real-alarm-0430": ("0430", ["DC0009", "DC0008", "DC0032", "DC0047", "DC0001"]),
    "real-warning-0523": ("0523", ["DC0006", "DC0007", "DC0001", "DC0058"]),
    "real-tracking-exhaust-baseline": ("0804", ["DC0008", "DC0011", "DC0001", "DC0058"]),
    "real-maintenance-c4-baseline": ("0807", ["DC0011", "DC0001", "DC0058"]),
}
CUTOFFS = {
    "0430": "2026-04-30 23:33:00",
    "0523": "2026-05-23 21:28:40",
    "0804": "2026-08-04 23:00:00",
    "0807": "2026-08-07 14:20:00",
}
# Source indices are zero-based positions in sensor_readings.data, verified
# against ship_sop's sensor-mapping.md and collector sensor_map configuration.
CHANNEL_DEFINITIONS = {
    "DC0001": (0, "主机转速", "M/E RPM", "RPM"),
    "DC0002": (1, "主机增压器转速", "M/E turbocharger tachometer", "RPM"),
    "DC0006": (5, "主机控制空气进口压力", "Control air inlet pressure", "MPa"),
    "DC0007": (6, "主机控制空气进口压力（安全）", "Control air inlet pressure（safety）", "MPa"),
    "DC0008": (7, "主机1缸排气温度", "ME NO.1 Exhaust gas temp.after cylinder", "°C"),
    "DC0009": (8, "主机2缸排气温度", "ME NO.2 Exhaust gas temp.after cylinder", "°C"),
    "DC0011": (10, "主机4缸排气温度", "ME NO.4 Exhaust gas temp.after cylinder", "°C"),
    "DC0032": (31, "主机2缸活塞冷却油出口温度", "ME NO.2 CYLINDER PISTON COOL OIL OUT TEMP", "°C"),
    "DC0047": (46, "主机2缸冷却淡水出口温度", "M/E NO.2 cylinder C.F.W.outlet temp.", "°C"),
    "DC0058": (57, "燃油指令", "FUEL QUANTITY", "%"),
}


def numeric_or_null(value):
    """Missing/non-numeric data must never become a zero or a normal reading."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return value if math.isfinite(value) else None


def summary(times, start, end):
    selected = [time for time in times if start <= time <= end]
    intervals = [
        int((datetime.fromisoformat(b) - datetime.fromisoformat(a)).total_seconds())
        for a, b in zip(selected, selected[1:])
    ]
    return {
        "requestedStart": start,
        "requestedEnd": end,
        "sampleCount": len(selected),
        "firstSampleAt": selected[0] if selected else None,
        "lastSampleAt": selected[-1] if selected else None,
        "maxGapSeconds": max(intervals, default=0),
    }


def channel_metadata():
    records = json.loads((ROOT / "src/mock/realCases.json").read_text(encoding="utf-8"))["cases"]
    by_id = {record["id"]: record for record in records}
    channels = {}
    # Guard against an unnoticed change to the current observation series/order.
    for case_id, (_, ids) in CASE_CHANNELS.items():
        series = by_id[case_id]["series"]
        if len(series) != len(ids):
            raise ValueError(f"Unexpected series count for {case_id}")
        for signal_id, entry in zip(ids, series):
            index, cn, en, unit = CHANNEL_DEFINITIONS[signal_id]
            if cn not in entry["name"] or entry["unit"] != unit:
                raise ValueError(f"Review series mapping for {case_id}: {signal_id}")
            channels[signal_id] = {
                "name": entry["name"], "nameCn": cn, "nameEn": en,
                "unit": unit, "sourceIndex": index,
            }
    return channels


def export(database: Path):
    channels = channel_metadata()
    result = {
        "schemaVersion": 1,
        "source": {
            "kind": "historical-sensor-samples", "database": "ship.db",
            "table": "sensor_readings", "shipCode": "CHBY", "deviceCode": "DEVICE1",
            "timestampFormat": "YYYY-MM-DD HH:mm:ss",
            "timestampBasis": "Source timestamp text retained verbatim; no timezone conversion.",
            "valuePolicy": "Original numeric samples; missing or non-numeric values are null.",
            "samplingPolicy": "All available rows in inclusive windows; no interpolation or downsampling.",
            "gapMetadataThresholdSeconds": 60,
        },
        "channels": channels, "windows": {}, "cases": {},
    }
    uri = database.resolve().as_uri() + "?mode=ro"
    with sqlite3.connect(uri, uri=True) as connection:
        connection.execute("PRAGMA query_only = ON")
        connection.execute("BEGIN")
        for window_id, end in CUTOFFS.items():
            start = (datetime.fromisoformat(end) - timedelta(hours=24)).isoformat(" ")
            rows = connection.execute(
                "SELECT id,timestamp,data FROM sensor_readings "
                "WHERE ship_code=? AND device_code=? AND timestamp>=? AND timestamp<=? "
                "ORDER BY timestamp,id", ("CHBY", "DEVICE1", start, end),
            ).fetchall()
            ids = next(ids for key, ids in CASE_CHANNELS.values() if key == window_id)
            times = [row[1] for row in rows]
            if any(a >= b for a, b in zip(times, times[1:])):
                raise ValueError(f"Duplicate or unordered timestamps in {window_id}")
            columns = {signal_id: [] for signal_id in ids}
            invalid = {signal_id: 0 for signal_id in ids}
            for _, at, raw in rows:
                values = json.loads(raw)
                if not isinstance(values, list):
                    raise ValueError(f"Expected a sensor array at {at}")
                for signal_id in ids:
                    index = channels[signal_id]["sourceIndex"]
                    value = values[index] if index < len(values) else None
                    parsed = numeric_or_null(value)
                    if value is not None and parsed is None:
                        invalid[signal_id] += 1
                    columns[signal_id].append(parsed)
            coverage = summary(times, start, end)
            coverage["gaps"] = [
                {"after": a, "before": b, "seconds": int((datetime.fromisoformat(b) - datetime.fromisoformat(a)).total_seconds())}
                for a, b in zip(times, times[1:])
                if (datetime.fromisoformat(b) - datetime.fromisoformat(a)).total_seconds() > 60
            ]
            coverage["channels"] = {
                signal_id: {"numericCount": sum(v is not None for v in values),
                            "missingCount": sum(v is None for v in values),
                            "invalidSourceCount": invalid[signal_id]}
                for signal_id, values in columns.items()
            }
            coverage["ranges"] = {
                f"{hours}H": summary(times, (datetime.fromisoformat(end) - timedelta(hours=hours)).isoformat(" "), end)
                for hours in (1, 6, 24)
            }
            result["windows"][window_id] = {
                "requestedStart": start, "requestedEnd": end, "times": times,
                "rowIds": [row[0] for row in rows], "columns": columns, "coverage": coverage,
            }
    for case_id, (window_id, ids) in CASE_CHANNELS.items():
        maintenance = case_id == "real-maintenance-c4-baseline"
        result["cases"][case_id] = {
            "windowId": window_id, "channelIds": ids,
            "dataRole": "baseline-source-history" if maintenance else "initial-evidence",
            "evidenceCutoff": CUTOFFS[window_id],
            **({"sourceCaseId": "real-health-c4-baseline", "isPostRepairEvidence": False} if maintenance else {}),
        }
    result["cases"]["real-health-c4-baseline"] = dict(result["cases"]["real-maintenance-c4-baseline"])
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, required=True, help="Path to ship.db (opened read-only)")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true", help="Compare without writing the output")
    args = parser.parse_args()
    if not args.database.is_file():
        parser.error("Database must already exist")
    data = export(args.database)
    payload = (json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")
    if args.check:
        if not args.output.is_file() or args.output.read_bytes() != payload:
            raise SystemExit("Fixture differs from the read-only export")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes(payload)
    print(json.dumps({"mode": "check" if args.check else "export", "bytes": len(payload),
                      "sha256": hashlib.sha256(payload).hexdigest(),
                      "ranges": {key: value["coverage"]["ranges"] for key, value in data["windows"].items()}}, ensure_ascii=False))


if __name__ == "__main__":
    main()

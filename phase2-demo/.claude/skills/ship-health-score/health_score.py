#!/usr/bin/env python
from __future__ import annotations

import argparse
import csv
import json
import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from PIL import Image, ImageDraw, ImageFont


WIDTH = 2048
HEIGHT = 800
PLOT = (160, 92, 1900, 690)
COLORS = {
    "blue": "#1D4ED8",
    "green": "#059669",
    "orange": "#EA580C",
    "red": "#DC2626",
    "red_light": "#FB7185",
    "purple": "#7C3AED",
    "cyan": "#0891B2",
    "amber": "#D97706",
    "magenta": "#C026D3",
    "reference": "#F97316",
    "trend": "#DC2626",
    "baseline": "#64748B",
    "grid": "#CBD5E1",
    "axis": "#111827",
    "text": "#111827",
    "muted": "#4B5563",
    "soft_blue": "#60A5FA",
    "soft_green": "#34D399",
    "soft_orange": "#F59E0B",
    "soft_purple": "#A78BFA",
}
FONT_REGULAR = Path(r"C:\Windows\Fonts\msyh.ttc")
FONT_BOLD = Path(r"C:\Windows\Fonts\msyhbd.ttc")
ROOT = Path(__file__).resolve().parent
DEFAULT_BASELINE_PATH = ROOT / "baselines" / "health_baseline_median_mad.json"
RESULT_SCHEMA_PATH = ROOT / "schemas" / "result.schema.json"
DEFAULT_BASELINE_MONTHS = "2026-03,2026-04,2026-05"
DEFAULT_EXCLUDE_DATES = "2026-04-30"
DEFAULT_CUSUM_WINDOWS_DAYS = (7, 30)
POINT_RISK_WEIGHTS = {
    "instant_abs_z": 0.15,
    "ewma_abs_z": 0.25,
    "cusum_7d_area": 0.30,
    "cusum_30d_area": 0.30,
}
POINT_RISK_THRESHOLD_POLICY = {
    "instant_abs_z": {"low_quantile": 0.90, "high_quantile": 0.995, "low_floor": 2.8, "min_width": 1.7},
    "ewma_abs_z": {"low_quantile": 0.88, "high_quantile": 0.995, "low_floor": 1.8, "min_width": 1.6},
    "cusum_7d_area": {"low_quantile": 0.88, "high_quantile": 0.995, "low_floor": 2.0, "min_width": 2.0},
    "cusum_30d_area": {"low_quantile": 0.88, "high_quantile": 0.995, "low_floor": 6.0, "min_width": 4.0},
}
LEVEL_RISK_WEIGHTS = {"max": 0.25, "mean": 0.75}
HEALTH_SCORE_BANDS = [
    {"state": "excellent", "state_cn": "优秀", "min_score": 90.0, "max_score": 100.0},
    {"state": "good", "state_cn": "良好", "min_score": 80.0, "max_score": 90.0},
    {"state": "watch", "state_cn": "关注", "min_score": 65.0, "max_score": 80.0},
    {"state": "warning", "state_cn": "预警", "min_score": 45.0, "max_score": 65.0},
    {"state": "critical", "state_cn": "严重", "min_score": 0.0, "max_score": 45.0},
]


@dataclass(frozen=True)
class SensorDef:
    key: str
    name: str
    local_group: str
    system: str
    unit: str = ""


@dataclass(frozen=True)
class TrendInfo:
    per_30d: float
    total_delta: float
    start_value: float
    end_value: float


SENSORS: list[SensorDef] = [
    SensorDef("DC0001", "main_engine_rpm", "operating_condition", "operating_context", "RPM"),
    SensorDef("DC0002", "turbocharger_rpm", "turbocharger", "air_exhaust_system", "RPM"),
    SensorDef("DC0003", "aft_shaft_bearing_temp", "shaft_bearings", "shafting_system", "degC"),
    SensorDef("DC0004", "intermediate_bearing_temp", "shaft_bearings", "shafting_system", "degC"),
    SensorDef("DC0005", "starting_air_pressure", "control_air", "air_control_system", "bar"),
    SensorDef("DC0006", "control_air_pressure", "control_air", "air_control_system", "bar"),
    SensorDef("DC0007", "control_air_safety_pressure", "control_air", "air_control_system", "bar"),
    SensorDef("DC0008", "cyl1_exhaust_temp", "exhaust_cylinders", "air_exhaust_system", "degC"),
    SensorDef("DC0009", "cyl2_exhaust_temp", "exhaust_cylinders", "air_exhaust_system", "degC"),
    SensorDef("DC0010", "cyl3_exhaust_temp", "exhaust_cylinders", "air_exhaust_system", "degC"),
    SensorDef("DC0011", "cyl4_exhaust_temp", "exhaust_cylinders", "air_exhaust_system", "degC"),
    SensorDef("DC0012", "cyl5_exhaust_temp", "exhaust_cylinders", "air_exhaust_system", "degC"),
    SensorDef("DC0013", "cyl6_exhaust_temp", "exhaust_cylinders", "air_exhaust_system", "degC"),
    SensorDef("DC0020", "exhaust_before_turbo", "turbocharger_exhaust", "air_exhaust_system", "degC"),
    SensorDef("DC0021", "exhaust_after_turbo", "turbocharger_exhaust", "air_exhaust_system", "degC"),
    SensorDef("DC0022", "cyl1_scavenge_temp", "scavenge_cylinders", "air_exhaust_system", "degC"),
    SensorDef("DC0023", "cyl2_scavenge_temp", "scavenge_cylinders", "air_exhaust_system", "degC"),
    SensorDef("DC0024", "cyl3_scavenge_temp", "scavenge_cylinders", "air_exhaust_system", "degC"),
    SensorDef("DC0025", "cyl4_scavenge_temp", "scavenge_cylinders", "air_exhaust_system", "degC"),
    SensorDef("DC0026", "cyl5_scavenge_temp", "scavenge_cylinders", "air_exhaust_system", "degC"),
    SensorDef("DC0027", "cyl6_scavenge_temp", "scavenge_cylinders", "air_exhaust_system", "degC"),
    SensorDef("DC0028", "main_lube_oil_pressure", "main_lube_oil", "lubrication_system", "bar"),
    SensorDef("DC0029", "main_lube_oil_temp", "main_lube_oil", "lubrication_system", "degC"),
    SensorDef("DC0030", "thrust_bearing_oil_temp", "shaft_bearings", "shafting_system", "degC"),
    SensorDef("DC0031", "cyl1_piston_oil_temp", "piston_cooling_oil", "cooling_system", "degC"),
    SensorDef("DC0032", "cyl2_piston_oil_temp", "piston_cooling_oil", "cooling_system", "degC"),
    SensorDef("DC0033", "cyl3_piston_oil_temp", "piston_cooling_oil", "cooling_system", "degC"),
    SensorDef("DC0034", "cyl4_piston_oil_temp", "piston_cooling_oil", "cooling_system", "degC"),
    SensorDef("DC0035", "cyl5_piston_oil_temp", "piston_cooling_oil", "cooling_system", "degC"),
    SensorDef("DC0036", "cyl6_piston_oil_temp", "piston_cooling_oil", "cooling_system", "degC"),
    SensorDef("DC0037", "turbocharger_oil_pressure", "turbocharger_lube_oil", "lubrication_system", "bar"),
    SensorDef("DC0038", "turbocharger_oil_temp", "turbocharger_lube_oil", "lubrication_system", "degC"),
    SensorDef("DC0039", "front_damper_oil_pressure", "damper_oil", "lubrication_system", "bar"),
    SensorDef("DC0040", "rear_damper_oil_pressure", "damper_oil", "lubrication_system", "bar"),
    SensorDef("DC0041", "fuel_inlet_pressure", "fuel_system", "fuel_system", "bar"),
    SensorDef("DC0042", "fuel_inlet_temp", "fuel_system", "fuel_system", "degC"),
    SensorDef("DC0044", "jacket_water_inlet_pressure", "jacket_water", "cooling_system", "bar"),
    SensorDef("DC0045", "jacket_water_inlet_temp", "jacket_water", "cooling_system", "degC"),
    SensorDef("DC0046", "cyl1_jacket_water_out_temp", "jacket_water_cylinders", "cooling_system", "degC"),
    SensorDef("DC0047", "cyl2_jacket_water_out_temp", "jacket_water_cylinders", "cooling_system", "degC"),
    SensorDef("DC0048", "cyl3_jacket_water_out_temp", "jacket_water_cylinders", "cooling_system", "degC"),
    SensorDef("DC0049", "cyl4_jacket_water_out_temp", "jacket_water_cylinders", "cooling_system", "degC"),
    SensorDef("DC0050", "cyl5_jacket_water_out_temp", "jacket_water_cylinders", "cooling_system", "degC"),
    SensorDef("DC0051", "cyl6_jacket_water_out_temp", "jacket_water_cylinders", "cooling_system", "degC"),
    SensorDef("DC0052", "air_cooler_water_in_temp", "air_cooler", "cooling_system", "degC"),
    SensorDef("DC0053", "air_cooler_water_out_temp", "air_cooler", "cooling_system", "degC"),
    SensorDef("DC0054", "servo_oil_pressure_1", "servo_oil", "fuel_control_system", "bar"),
    SensorDef("DC0055", "servo_oil_pressure_2", "servo_oil", "fuel_control_system", "bar"),
    SensorDef("DC0056", "fuel_rail_pressure_1", "fuel_rail", "fuel_system", "bar"),
    SensorDef("DC0057", "fuel_rail_pressure_2", "fuel_rail", "fuel_system", "bar"),
    SensorDef("DC0058", "fuel_index", "fuel_command", "fuel_system", "%"),
    SensorDef("DC0059", "scavenge_air_pressure", "scavenge_air", "air_exhaust_system", "bar"),
]
KEY_TO_SENSOR = {s.key: s for s in SENSORS}
KEYS = [s.key for s in SENSORS]
RPM_KEY = "DC0001"

STATE_CN = {
    "excellent": "优秀",
    "good": "良好",
    "watch": "关注",
    "warning": "预警",
    "critical": "严重",
}

SYSTEM_CN = {
    "operating_context": "运行工况",
    "air_exhaust_system": "进排气系统",
    "shafting_system": "轴系系统",
    "air_control_system": "空气控制系统",
    "lubrication_system": "润滑系统",
    "cooling_system": "冷却系统",
    "fuel_system": "燃油系统",
    "fuel_control_system": "燃油控制系统",
}

LOCAL_GROUP_CN = {
    "operating_condition": "运行工况",
    "turbocharger": "增压器",
    "shaft_bearings": "轴承组",
    "control_air": "控制空气",
    "exhaust_cylinders": "各缸排气",
    "turbocharger_exhaust": "增压器前后排气",
    "scavenge_cylinders": "各缸扫气",
    "main_lube_oil": "主滑油",
    "piston_cooling_oil": "活塞冷却油",
    "turbocharger_lube_oil": "增压器滑油",
    "damper_oil": "减振器油",
    "fuel_system": "燃油供给",
    "jacket_water": "缸套水入口",
    "jacket_water_cylinders": "各缸缸套水出口",
    "air_cooler": "空冷器冷却水",
    "servo_oil": "伺服油",
    "fuel_rail": "燃油共轨",
    "fuel_command": "燃油指令",
    "scavenge_air": "扫气空气",
}

SENSOR_CN = {
    "DC0001": "主机转速",
    "DC0002": "增压器转速",
    "DC0003": "尾轴承温度",
    "DC0004": "中间轴承温度",
    "DC0005": "启动空气压力",
    "DC0006": "控制空气压力",
    "DC0007": "控制空气安全压力",
    "DC0008": "1缸排气温度",
    "DC0009": "2缸排气温度",
    "DC0010": "3缸排气温度",
    "DC0011": "4缸排气温度",
    "DC0012": "5缸排气温度",
    "DC0013": "6缸排气温度",
    "DC0020": "增压器前排气温度",
    "DC0021": "增压器后排气温度",
    "DC0022": "1缸扫气温度",
    "DC0023": "2缸扫气温度",
    "DC0024": "3缸扫气温度",
    "DC0025": "4缸扫气温度",
    "DC0026": "5缸扫气温度",
    "DC0027": "6缸扫气温度",
    "DC0028": "主滑油压力",
    "DC0029": "主滑油温度",
    "DC0030": "推力轴承油温",
    "DC0031": "1缸活塞冷却油温",
    "DC0032": "2缸活塞冷却油温",
    "DC0033": "3缸活塞冷却油温",
    "DC0034": "4缸活塞冷却油温",
    "DC0035": "5缸活塞冷却油温",
    "DC0036": "6缸活塞冷却油温",
    "DC0037": "增压器滑油压力",
    "DC0038": "增压器滑油温度",
    "DC0039": "前减振器油压",
    "DC0040": "后减振器油压",
    "DC0041": "燃油进口压力",
    "DC0042": "燃油进口温度",
    "DC0044": "缸套水进口压力",
    "DC0045": "缸套水进口温度",
    "DC0046": "1缸缸套水出口温度",
    "DC0047": "2缸缸套水出口温度",
    "DC0048": "3缸缸套水出口温度",
    "DC0049": "4缸缸套水出口温度",
    "DC0050": "5缸缸套水出口温度",
    "DC0051": "6缸缸套水出口温度",
    "DC0052": "空冷器冷却水进口温度",
    "DC0053": "空冷器冷却水出口温度",
    "DC0054": "伺服油压力1",
    "DC0055": "伺服油压力2",
    "DC0056": "燃油共轨压力1",
    "DC0057": "燃油共轨压力2",
    "DC0058": "燃油指令",
    "DC0059": "扫气压力",
}


def parse_time(value: str) -> datetime | None:
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y/%m/%d %H:%M:%S"):
        try:
            return datetime.strptime(value[:19], fmt)
        except ValueError:
            continue
    return None


def read_raw_json_window(path: Path) -> dict[str, Any] | None:
    with path.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    values: dict[str, list[float]] = {key: [] for key in KEYS}
    times: list[datetime] = []
    for entry in raw.get("data", []):
        ts = parse_time(str(entry.get("terminalTime", "")))
        if ts is not None:
            times.append(ts)
        for wrapper in entry.get("sensorList", []):
            for sensor in wrapper.get("sensorList", []):
                key = sensor.get("key")
                if key not in values:
                    continue
                raw_value = sensor.get("value")
                try:
                    values[key].append(float(raw_value))
                except (TypeError, ValueError):
                    continue

    if not times:
        return None

    row: dict[str, Any] = {
        "timestamp": max(times),
        "time_start": min(times),
        "time_end": max(times),
        "source_file": path.name,
        "n_samples": len(times),
    }
    for key, vals in values.items():
        if vals:
            row[key] = float(np.mean(vals))
        else:
            row[key] = np.nan
    return row


def load_raw_json_dir(input_path: Path, pattern: str, max_files: int | None = None) -> pd.DataFrame:
    # Ship 2.0 adapter: streaming SQLite aggregation exports measured 30-minute
    # means, with the actual first/last sample times and sample count per window.
    if input_path.is_file() and input_path.suffix.lower() == '.csv':
        df = pd.read_csv(input_path)
        for name in ('timestamp', 'time_start', 'time_end'):
            df[name] = pd.to_datetime(df[name], errors='raise')
        for key in KEYS:
            df[key] = pd.to_numeric(df[key], errors='coerce') if key in df else np.nan
        if len(df) < 5 or df['timestamp'].duplicated().any() or df['timestamp'].isna().any():
            raise ValueError('Need at least five unique measured windows')
        return df.sort_values('timestamp').reset_index(drop=True)
    if input_path.is_file():
        files = [input_path]
    else:
        files = sorted(input_path.glob(pattern))
    files = [p for p in files if p.name != "manifest.json" and p.suffix.lower() == ".json"]
    if max_files:
        files = files[:max_files]
    if not files:
        raise RuntimeError(f"No JSON files matched {input_path} / {pattern}")

    rows = []
    for idx, path in enumerate(files, 1):
        row = read_raw_json_window(path)
        if row:
            rows.append(row)
        if idx % 25 == 0:
            print(f"loaded {idx}/{len(files)} files", flush=True)

    if len(rows) < 5:
        raise RuntimeError("Too few valid windows for health scoring.")
    df = pd.DataFrame(rows).sort_values("timestamp").reset_index(drop=True)
    return df


def rpm_zone(rpm: float) -> str:
    if not np.isfinite(rpm):
        return "unknown"
    if rpm >= 93:
        return "cruise"
    if rpm >= 78:
        return "maneuver_high"
    if rpm >= 30:
        return "midlow"
    if rpm >= 5:
        return "low_speed"
    return "stopped"


def rpm_zone_cn(zone: str) -> str:
    return {
        "cruise": "巡航",
        "maneuver_high": "中高负荷",
        "midlow": "中低负荷",
        "low_speed": "低速",
        "stopped": "停机",
        "unknown": "未知",
    }.get(zone, zone)


def state_cn(state: str) -> str:
    return STATE_CN.get(state, state)


def sensor_label(key: str, include_id: bool = True) -> str:
    label = SENSOR_CN.get(key, KEY_TO_SENSOR.get(key, SensorDef(key, key, "", "")).name)
    return f"{label}（{key}）" if include_id else label


def system_label(system: str) -> str:
    return SYSTEM_CN.get(system, system)


def local_group_label(group: str) -> str:
    return LOCAL_GROUP_CN.get(group, group)


def scope_label(target_type: str, target: str) -> str:
    if target_type == "system":
        return system_label(target)
    if target_type == "local_group":
        return local_group_label(target)
    if target_type == "sensor":
        return sensor_label(target)
    if target_type == "cylinder":
        return f"{target}缸"
    return target


def robust_scale(values: pd.Series, floor: float = 1e-6) -> float:
    vals = values.dropna().astype(float)
    if len(vals) < 3:
        return 1.0
    med = float(vals.median())
    mad = float((vals - med).abs().median()) * 1.4826
    q75 = float(vals.quantile(0.75))
    q25 = float(vals.quantile(0.25))
    iqr_scale = (q75 - q25) / 1.349 if q75 > q25 else 0.0
    std = float(vals.std(ddof=1)) if len(vals) > 1 else 0.0
    return max(mad, iqr_scale, std * 0.35, floor)


def baseline_stats(values: pd.Series, floor: float) -> dict[str, float | int]:
    vals = values.dropna().astype(float)
    if len(vals) == 0:
        return {
            "median": float("nan"),
            "scale": max(floor, 1e-6),
            "mad": 0.0,
            "std": 0.0,
            "iqr": 0.0,
            "n": 0,
        }
    med = float(vals.median())
    mad_raw = float((vals - med).abs().median())
    mad_sigma = mad_raw * 1.4826
    q75 = float(vals.quantile(0.75))
    q25 = float(vals.quantile(0.25))
    iqr = q75 - q25
    iqr_sigma = iqr / 1.349 if iqr > 0 else 0.0
    std = float(vals.std(ddof=1)) if len(vals) > 1 else 0.0
    scale = max(mad_sigma, iqr_sigma * 0.50, std * 0.20, floor, 1e-6)
    return {
        "median": med,
        "scale": scale,
        "mad": mad_sigma,
        "std": std,
        "iqr": iqr,
        "n": int(len(vals)),
    }


def parse_csv_set(raw: str | None) -> set[str]:
    if not raw:
        return set()
    return {item.strip() for item in raw.split(",") if item.strip()}


def filter_baseline_source(
    df: pd.DataFrame,
    months: str | None,
    exclude_dates: str | None,
    min_baseline: int,
) -> pd.DataFrame:
    base = df.copy()
    month_set = parse_csv_set(months)
    if month_set:
        month_labels = base["timestamp"].dt.strftime("%Y-%m")
        base = base.loc[month_labels.isin(month_set)].copy()
    exclude_set = parse_csv_set(exclude_dates)
    if exclude_set:
        date_labels = base["timestamp"].dt.strftime("%Y-%m-%d")
        base = base.loc[~date_labels.isin(exclude_set)].copy()
    if len(base) < min_baseline:
        raise RuntimeError(
            f"Too few baseline windows after filtering: {len(base)} < {min_baseline}. "
            "Adjust --baseline-months/--baseline-exclude-dates or --min-baseline."
        )
    return base.reset_index(drop=True)


def build_condition_baselines(
    df: pd.DataFrame,
    baseline_fraction: float,
    min_baseline: int,
    baseline_months: str | None = None,
    baseline_exclude_dates: str | None = None,
) -> dict[str, dict[str, Any]]:
    n_base = max(min_baseline, int(len(df) * baseline_fraction))
    n_base = min(n_base, max(5, len(df) - 1))
    if baseline_months or baseline_exclude_dates:
        base = filter_baseline_source(df, baseline_months, baseline_exclude_dates, min_baseline)
    else:
        base = df.iloc[:n_base].copy().reset_index(drop=True)
    base["rpm_zone"] = base[RPM_KEY].apply(rpm_zone)

    baselines: dict[str, dict[str, Any]] = {}
    for sensor in SENSORS:
        key = sensor.key
        if key == RPM_KEY or key not in df.columns:
            continue
        global_vals = base[key]
        global_median = float(global_vals.median())
        scale_floor = max(abs(global_median) * 0.02, 0.05)
        global_info = baseline_stats(global_vals, floor=scale_floor)
        zones: dict[str, dict[str, float]] = {}
        for zone, zone_df in base.groupby("rpm_zone"):
            if len(zone_df[key].dropna()) >= 5:
                zones[zone] = baseline_stats(zone_df[key], floor=max(float(global_info["scale"]) * 0.50, scale_floor))
        baselines[key] = {
            "global": global_info,
            "zones": zones,
        }
    baselines["_meta"] = {
        "kind": "fixed_health_baseline",
        "mode": "rpm_zone_median_mad",
        "baseline_months": sorted(parse_csv_set(baseline_months)),
        "baseline_exclude_dates": sorted(parse_csv_set(baseline_exclude_dates)),
        "baseline_windows": int(len(base)),
        "time_start": base["timestamp"].iloc[0].strftime("%Y-%m-%d %H:%M:%S"),
        "time_end": base["timestamp"].iloc[-1].strftime("%Y-%m-%d %H:%M:%S"),
        "rpm_zone_counts": {str(zone): int(count) for zone, count in base["rpm_zone"].value_counts().sort_index().items()},
        "note": "Health baseline is fixed and reused by score mode. Median is the healthy baseline; MAD is the preferred industrial fluctuation scale.",
    }
    return baselines


def save_baselines(path: Path, baselines: dict[str, dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(baselines, f, ensure_ascii=False, indent=2)


def load_baselines(path: Path) -> dict[str, dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        raw = json.load(f)
    return raw


def baseline_meta(baselines: dict[str, dict[str, Any]], path: Path | None = None) -> dict[str, Any]:
    meta = dict(baselines.get("_meta", {}))
    if path is not None:
        meta["path"] = str(path)
    meta.setdefault("kind", "fixed_health_baseline")
    return meta


def calculate_deviation_frames(
    df: pd.DataFrame,
    baselines: dict[str, dict[str, Any]],
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    z = pd.DataFrame({"timestamp": df["timestamp"]})
    baseline_values = pd.DataFrame({"timestamp": df["timestamp"]})
    residuals = pd.DataFrame({"timestamp": df["timestamp"]})
    scales = pd.DataFrame({"timestamp": df["timestamp"]})
    mad_values = pd.DataFrame({"timestamp": df["timestamp"]})
    std_values = pd.DataFrame({"timestamp": df["timestamp"]})
    iqr_values = pd.DataFrame({"timestamp": df["timestamp"]})
    n_values = pd.DataFrame({"timestamp": df["timestamp"]})
    zones = df[RPM_KEY].apply(rpm_zone)
    for sensor in SENSORS:
        key = sensor.key
        if key == RPM_KEY or key not in baselines:
            continue
        z_out = []
        baseline_out = []
        residual_out = []
        scale_out = []
        mad_out = []
        std_out = []
        iqr_out = []
        n_out = []
        for idx, value in df[key].items():
            if not np.isfinite(value):
                z_out.append(np.nan)
                baseline_out.append(np.nan)
                residual_out.append(np.nan)
                scale_out.append(np.nan)
                mad_out.append(np.nan)
                std_out.append(np.nan)
                iqr_out.append(np.nan)
                n_out.append(np.nan)
                continue
            zone = zones.iloc[idx]
            info = baselines[key]["zones"].get(zone, baselines[key]["global"])
            baseline = float(info["median"])
            scale = max(float(info["scale"]), 1e-6)
            residual = float(value) - baseline
            baseline_out.append(baseline)
            residual_out.append(residual)
            scale_out.append(scale)
            mad_out.append(float(info.get("mad", scale)))
            std_out.append(float(info.get("std", np.nan)))
            iqr_out.append(float(info.get("iqr", np.nan)))
            n_out.append(float(info.get("n", np.nan)))
            z_out.append(residual / scale)
        z[key] = z_out
        baseline_values[key] = baseline_out
        residuals[key] = residual_out
        scales[key] = scale_out
        mad_values[key] = mad_out
        std_values[key] = std_out
        iqr_values[key] = iqr_out
        n_values[key] = n_out
    return z, baseline_values, residuals, scales, mad_values, std_values, iqr_values, n_values


def calculate_z_scores(df: pd.DataFrame, baselines: dict[str, dict[str, Any]]) -> pd.DataFrame:
    z, _, _, _, _, _, _, _ = calculate_deviation_frames(df, baselines)
    return z


def ewma(values: list[float], alpha: float) -> list[float]:
    result = []
    prev = 0.0
    for value in values:
        x = 0.0 if not np.isfinite(value) else float(value)
        prev = alpha * x + (1 - alpha) * prev
        result.append(prev)
    return result


def cusum(values: list[float], reference: float, cap: float, decay: float) -> list[float]:
    result = []
    state = 0.0
    for value in values:
        x = 0.0 if not np.isfinite(value) else float(value)
        state = max(0.0, min(cap, state * decay + x - reference))
        result.append(state)
    return result


def median_sample_step_days(timestamps: pd.Series) -> float:
    if len(timestamps) < 2:
        return 1.0
    ordered = pd.to_datetime(timestamps).sort_values()
    diffs = ordered.diff().dropna().dt.total_seconds() / 86400.0
    diffs = diffs[(diffs > 0) & np.isfinite(diffs)]
    if len(diffs) == 0:
        return 1.0
    return float(np.clip(diffs.median(), 1.0 / 24.0, 1.0))


def cumulative_deviation_area(
    timestamps: pd.Series,
    abs_z: list[float],
    tolerance: float,
    days: int,
) -> list[float]:
    times = pd.to_datetime(timestamps).tolist()
    if not times:
        return []
    default_step = median_sample_step_days(timestamps)
    weights: list[float] = []
    for idx, current in enumerate(times):
        if idx == 0:
            weights.append(default_step)
            continue
        delta_days = (current - times[idx - 1]).total_seconds() / 86400.0
        weights.append(float(np.clip(delta_days, 1.0 / 24.0, 1.0)))

    contributions = []
    for value, weight in zip(abs_z, weights):
        x = 0.0 if not np.isfinite(value) else max(0.0, float(value) - tolerance)
        contributions.append(x * weight)

    result = []
    left = 0
    running = 0.0
    horizon = timedelta(days=days)
    for right, current in enumerate(times):
        running += contributions[right]
        while left <= right and current - times[left] > horizon:
            running -= contributions[left]
            left += 1
        result.append(max(0.0, running))
    return result


def smooth_risk(value: float, low: float, high: float) -> float:
    if value <= low:
        return 0.0
    if value >= high:
        return 1.0
    t = (value - low) / (high - low)
    return float(t * t * (3 - 2 * t))


def quantile_bounds(values: list[float], low_q: float, high_q: float, low_floor: float, min_width: float) -> tuple[float, float]:
    arr = np.array([v for v in values if np.isfinite(v)], dtype=float)
    if len(arr) < 5:
        return low_floor, low_floor + min_width
    low = max(float(np.quantile(arr, low_q)), low_floor)
    high = max(float(np.quantile(arr, high_q)), low + min_width)
    return low, high


def score_points(
    z_df: pd.DataFrame,
    alpha: float,
    cusum_tolerance: float,
    cusum_windows_days: tuple[int, int],
) -> tuple[pd.DataFrame, dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    risk_df = pd.DataFrame({"timestamp": z_df["timestamp"]})
    details: dict[str, dict[str, Any]] = {}
    metrics: dict[str, dict[str, Any]] = {}
    short_days, long_days = cusum_windows_days
    for sensor in SENSORS:
        key = sensor.key
        if key == RPM_KEY or key not in z_df.columns:
            continue
        signed_z = z_df[key].astype(float).replace([np.inf, -np.inf], np.nan).fillna(0.0).tolist()
        abs_z = z_df[key].abs().astype(float).replace([np.inf, -np.inf], np.nan).fillna(0.0).tolist()
        ew = ewma(abs_z, alpha)
        cu_short = cumulative_deviation_area(z_df["timestamp"], abs_z, cusum_tolerance, short_days)
        cu_long = cumulative_deviation_area(z_df["timestamp"], abs_z, cusum_tolerance, long_days)
        z_policy = POINT_RISK_THRESHOLD_POLICY["instant_abs_z"]
        ew_policy = POINT_RISK_THRESHOLD_POLICY["ewma_abs_z"]
        cu_short_policy = POINT_RISK_THRESHOLD_POLICY["cusum_7d_area"]
        cu_long_policy = POINT_RISK_THRESHOLD_POLICY["cusum_30d_area"]
        z_low, z_high = quantile_bounds(abs_z, z_policy["low_quantile"], z_policy["high_quantile"], z_policy["low_floor"], z_policy["min_width"])
        ew_low, ew_high = quantile_bounds(ew, ew_policy["low_quantile"], ew_policy["high_quantile"], ew_policy["low_floor"], ew_policy["min_width"])
        cu_short_low, cu_short_high = quantile_bounds(cu_short, cu_short_policy["low_quantile"], cu_short_policy["high_quantile"], cu_short_policy["low_floor"], cu_short_policy["min_width"])
        cu_long_low, cu_long_high = quantile_bounds(cu_long, cu_long_policy["low_quantile"], cu_long_policy["high_quantile"], cu_long_policy["low_floor"], cu_long_policy["min_width"])
        risk = []
        cusum_short_risk_series = []
        cusum_long_risk_series = []
        for z_val, ew_val, cu_short_val, cu_long_val in zip(abs_z, ew, cu_short, cu_long):
            z_risk = smooth_risk(z_val, z_low, z_high)
            ewma_risk = smooth_risk(ew_val, ew_low, ew_high)
            cusum_short_risk = smooth_risk(cu_short_val, cu_short_low, cu_short_high)
            cusum_long_risk = smooth_risk(cu_long_val, cu_long_low, cu_long_high)
            cusum_short_risk_series.append(cusum_short_risk)
            cusum_long_risk_series.append(cusum_long_risk)
            risk.append(min(
                1.0,
                POINT_RISK_WEIGHTS["instant_abs_z"] * z_risk
                + POINT_RISK_WEIGHTS["ewma_abs_z"] * ewma_risk
                + POINT_RISK_WEIGHTS["cusum_7d_area"] * cusum_short_risk
                + POINT_RISK_WEIGHTS["cusum_30d_area"] * cusum_long_risk,
            ))
        risk_df[key] = risk
        details[key] = {
            "latest_abs_z": round(abs_z[-1], 3),
            "latest_ewma": round(ew[-1], 3),
            f"latest_cusum_{short_days}d_area": round(cu_short[-1], 3),
            f"latest_cusum_{long_days}d_area": round(cu_long[-1], 3),
            "latest_risk": round(risk[-1], 3),
            "latest_health": round(100 * (1 - risk[-1]), 1),
        }
        metrics[key] = {
            "z": signed_z,
            "abs_z": abs_z,
            "ewma": ew,
            "cusum": cu_long,
            f"cusum_{short_days}d_area": cu_short,
            f"cusum_{long_days}d_area": cu_long,
            "cusum_short_area": cu_short,
            "cusum_long_area": cu_long,
            "cusum_short_risk": cusum_short_risk_series,
            "cusum_long_risk": cusum_long_risk_series,
            "risk": risk,
            "health": [health_from_risk(v) for v in risk],
            "thresholds": {
                "abs_z_low": round(z_low, 3),
                "abs_z_high": round(z_high, 3),
                "ewma_low": round(ew_low, 3),
                "ewma_high": round(ew_high, 3),
                f"cusum_{short_days}d_low": round(cu_short_low, 3),
                f"cusum_{short_days}d_high": round(cu_short_high, 3),
                f"cusum_{long_days}d_low": round(cu_long_low, 3),
                f"cusum_{long_days}d_high": round(cu_long_high, 3),
                "cusum_tolerance": round(cusum_tolerance, 3),
            },
        }
    return risk_df, details, metrics


def aggregate_risks(values: list[float]) -> float:
    arr = np.array([v for v in values if np.isfinite(v)], dtype=float)
    if len(arr) == 0:
        return np.nan
    return float(min(1.0, LEVEL_RISK_WEIGHTS["max"] * arr.max() + LEVEL_RISK_WEIGHTS["mean"] * arr.mean()))


def aggregate_level(risk_df: pd.DataFrame, groups: dict[str, list[str]]) -> pd.DataFrame:
    out = pd.DataFrame({"timestamp": risk_df["timestamp"]})
    for name, keys in groups.items():
        available = [k for k in keys if k in risk_df.columns]
        if not available:
            continue
        out[name] = [aggregate_risks(list(row)) for row in risk_df[available].to_numpy()]
    return out


def health_from_risk(risk: float) -> float:
    if not np.isfinite(risk):
        return float("nan")
    return round(100 * (1 - min(max(risk, 0.0), 1.0)), 1)


def health_state(score: float) -> str:
    if score >= 90:
        return "excellent"
    if score >= 80:
        return "good"
    if score >= 65:
        return "watch"
    if score >= 45:
        return "warning"
    return "critical"


def latest_ranked(df: pd.DataFrame, names: dict[str, str] | None = None, limit: int = 8) -> list[dict[str, Any]]:
    last = df.iloc[-1]
    return ranked_at(df, len(df) - 1, names, limit)


def ranked_at(df: pd.DataFrame, index: int, names: dict[str, str] | None = None, limit: int = 8) -> list[dict[str, Any]]:
    row = df.iloc[index]
    rows = []
    for col in df.columns:
        if col == "timestamp":
            continue
        risk = float(row[col])
        if not np.isfinite(risk):
            continue
        score = health_from_risk(risk)
        state = health_state(score)
        rows.append({
            "id": col,
            "name": names.get(col, col) if names else col,
            "name_cn": SENSOR_CN.get(col, SYSTEM_CN.get(col, LOCAL_GROUP_CN.get(col, col))),
            "risk": round(risk, 3),
            "health_score": score,
            "state": state,
            "state_cn": state_cn(state),
        })
    rows.sort(key=lambda x: x["risk"], reverse=True)
    return rows[:limit]


def all_ranked(df: pd.DataFrame, index: int, names: dict[str, str] | None = None) -> list[dict[str, Any]]:
    return ranked_at(df, index, names, limit=max(1, len([c for c in df.columns if c != "timestamp"])))


def build_groups() -> tuple[dict[str, list[str]], dict[str, list[str]], dict[str, str]]:
    local_groups: dict[str, list[str]] = {}
    system_sets: dict[str, set[str]] = {}
    names = {s.key: s.name for s in SENSORS}
    for sensor in SENSORS:
        if sensor.key == RPM_KEY:
            continue
        local_groups.setdefault(sensor.local_group, []).append(sensor.key)
        system_sets.setdefault(sensor.system, set()).add(sensor.local_group)
    systems = {name: sorted(groups) for name, groups in system_sets.items()}
    return local_groups, systems, names


def build_cylinder_groups() -> dict[str, list[str]]:
    cylinders: dict[str, list[str]] = {}
    for sensor in SENSORS:
        if sensor.key == RPM_KEY:
            continue
        name = sensor.name
        if not name.startswith("cyl"):
            continue
        digits = []
        for ch in name[3:]:
            if ch.isdigit():
                digits.append(ch)
            else:
                break
        if digits:
            cylinders.setdefault("".join(digits), []).append(sensor.key)
    return {key: values for key, values in sorted(cylinders.items(), key=lambda item: int(item[0]))}


def write_timeseries(
    path: Path,
    point_risks: pd.DataFrame,
    local_risks: pd.DataFrame,
    system_risks: pd.DataFrame,
    engine_risk: pd.Series,
) -> None:
    rows = []
    for i in range(len(point_risks)):
        row: dict[str, Any] = {"timestamp": point_risks["timestamp"].iloc[i].strftime("%Y-%m-%d %H:%M:%S")}
        row["engine_health"] = health_from_risk(float(engine_risk.iloc[i]))
        for col in local_risks.columns:
            if col != "timestamp":
                row[f"local_{col}"] = health_from_risk(float(local_risks[col].iloc[i]))
        for col in system_risks.columns:
            if col != "timestamp":
                row[f"system_{col}"] = health_from_risk(float(system_risks[col].iloc[i]))
        rows.append(row)

    fieldnames = list(rows[0].keys())
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_point_metrics(
    path: Path,
    df: pd.DataFrame,
    point_metrics: dict[str, dict[str, Any]],
) -> None:
    rows = []
    zones = df[RPM_KEY].apply(rpm_zone)
    for i in range(len(df)):
        timestamp = df["timestamp"].iloc[i].strftime("%Y-%m-%d %H:%M:%S")
        for sensor in SENSORS:
            key = sensor.key
            if key == RPM_KEY or key not in point_metrics:
                continue
            metric = point_metrics[key]
            risk = float(metric["risk"][i])
            state = health_state(health_from_risk(risk))
            rows.append({
                "timestamp": timestamp,
                "source_file": df["source_file"].iloc[i],
                "rpm": round(float(df[RPM_KEY].iloc[i]), 3),
                "rpm_zone": zones.iloc[i],
                "rpm_zone_cn": rpm_zone_cn(zones.iloc[i]),
                "sensor_key": key,
                "sensor_name": sensor.name,
                "sensor_name_cn": SENSOR_CN.get(key, sensor.name),
                "local_group": sensor.local_group,
                "local_group_cn": local_group_label(sensor.local_group),
                "system": sensor.system,
                "system_cn": system_label(sensor.system),
                "raw_value": round(float(metric.get("raw", [np.nan])[i]), 4),
                "baseline_median": round(float(metric.get("baseline_median", metric.get("fixed_baseline", [np.nan]))[i]), 4),
                "residual_raw": round(float(metric.get("residual", [np.nan])[i]), 4),
                "baseline_scale_mad": round(float(metric.get("scale", [np.nan])[i]), 4),
                "baseline_mad": round(float(metric.get("baseline_mad", [np.nan])[i]), 4),
                "baseline_std": round(float(metric.get("baseline_std", [np.nan])[i]), 4),
                "baseline_iqr": round(float(metric.get("baseline_iqr", [np.nan])[i]), 4),
                "baseline_n": round(float(metric.get("baseline_n", [np.nan])[i]), 0),
                "z": round(float(metric["z"][i]), 4),
                "abs_z": round(float(metric["abs_z"][i]), 4),
                "ewma": round(float(metric["ewma"][i]), 4),
                "cusum_7d_area": round(float(metric.get("cusum_7d_area", metric.get("cusum_short_area", [np.nan]))[i]), 4),
                "cusum_30d_area": round(float(metric.get("cusum_30d_area", metric.get("cusum_long_area", [np.nan]))[i]), 4),
                "risk": round(risk, 4),
                "health_score": health_from_risk(risk),
                "state": state,
                "state_cn": state_cn(state),
            })

    fieldnames = list(rows[0].keys())
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def resolve_sensor_key(target: str) -> str:
    wanted = target.strip().lower()
    for sensor in SENSORS:
        names = {sensor.key.lower(), sensor.name.lower(), SENSOR_CN.get(sensor.key, "").lower()}
        if wanted in names:
            return sensor.key
    raise ValueError(f"Unknown sensor target: {target}")


def resolve_named_key(target: str, candidates: list[str], labels: dict[str, str]) -> str:
    wanted = target.strip().lower()
    for item in candidates:
        names = {item.lower(), labels.get(item, item).lower()}
        if wanted in names:
            return item
    raise ValueError(f"Unknown target: {target}")


def select_target_sensors(
    target_type: str,
    target: str,
    local_groups: dict[str, list[str]],
    systems: dict[str, list[str]],
) -> tuple[str, list[str]]:
    kind = target_type.strip().lower()
    if kind == "sensor":
        key = resolve_sensor_key(target)
        return key, [key]
    if kind == "system":
        system = resolve_named_key(target, list(systems.keys()), SYSTEM_CN)
        keys: list[str] = []
        for group in systems[system]:
            keys.extend(local_groups.get(group, []))
        return system, sorted(set(keys), key=keys.index)
    if kind == "local_group":
        group = resolve_named_key(target, list(local_groups.keys()), LOCAL_GROUP_CN)
        return group, local_groups[group]
    if kind == "cylinder":
        number = "".join(ch for ch in target if ch.isdigit())
        if not number:
            raise ValueError(f"Cylinder target must contain a number: {target}")
        marker = f"cyl{number}_"
        keys = [sensor.key for sensor in SENSORS if marker in sensor.name]
        if not keys:
            raise ValueError(f"No sensors found for cylinder: {target}")
        return number, keys
    raise ValueError(f"Unsupported target type: {target_type}")


def rank_plot_sensors(
    keys: list[str],
    point_risks: pd.DataFrame,
    max_sensors: int,
) -> list[str]:
    scored = []
    for key in keys:
        if key not in point_risks.columns:
            continue
        series = point_risks[key].astype(float)
        scored.append((key, float(series.max()) + 0.35 * float(series.iloc[-1])))
    scored.sort(key=lambda item: item[1], reverse=True)
    return [key for key, _ in scored[:max_sensors]]


def draw_dashed_horizontal(
    draw: ImageDraw.ImageDraw,
    x0: float,
    x1: float,
    y: float,
    fill: str,
    width: int = 2,
    dash: int = 12,
    gap: int = 9,
) -> None:
    x = x0
    while x < x1:
        draw.line((x, y, min(x + dash, x1), y), fill=fill, width=width)
        x += dash + gap


def draw_dashed_line(
    draw: ImageDraw.ImageDraw,
    start: tuple[float, float],
    end: tuple[float, float],
    fill: str,
    width: int = 2,
    dash: int = 12,
    gap: int = 9,
) -> None:
    x0, y0 = start
    x1, y1 = end
    dx = x1 - x0
    dy = y1 - y0
    length = math.hypot(dx, dy)
    if length <= 0:
        return
    ux = dx / length
    uy = dy / length
    pos = 0.0
    while pos < length:
        seg_end = min(pos + dash, length)
        draw.line(
            (x0 + ux * pos, y0 + uy * pos, x0 + ux * seg_end, y0 + uy * seg_end),
            fill=fill,
            width=width,
        )
        pos += dash + gap


def draw_trend_line(
    draw: ImageDraw.ImageDraw,
    timestamps: list[datetime],
    values: list[float],
    xmap,
    ymap,
    color: str,
    width: int = 2,
) -> TrendInfo | None:
    points = [(idx, value) for idx, value in enumerate(values) if np.isfinite(value)]
    if len(points) < 2:
        return None
    # Fit against elapsed days, not sample ordinal, so irregular window spacing does not alter the trend.
    origin = pd.Timestamp(timestamps[points[0][0]])
    xs = np.array([
        (pd.Timestamp(timestamps[idx]) - origin).total_seconds() / 86400.0
        for idx, _value in points
    ], dtype=float)
    ys = np.array([p[1] for p in points], dtype=float)
    if np.ptp(xs) <= 0:
        return None
    slope, intercept = np.polyfit(xs, ys, 1)
    first_idx = points[0][0]
    last_idx = points[-1][0]
    y_start = float(slope * xs[0] + intercept)
    y_end = float(slope * xs[-1] + intercept)
    draw_dashed_line(
        draw,
        (xmap(timestamps[first_idx]), ymap(y_start)),
        (xmap(timestamps[last_idx]), ymap(y_end)),
        color,
        width=width,
        dash=14,
        gap=10,
    )
    if len(timestamps) > 1:
        span_days = max(float(xs[-1] - xs[0]), 1e-9)
        return TrendInfo(
            per_30d=float((y_end - y_start) / span_days * 30.0),
            total_delta=float(y_end - y_start),
            start_value=y_start,
            end_value=y_end,
        )
    return None


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_BOLD if bold and FONT_BOLD.exists() else FONT_REGULAR
    if path.exists():
        return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def x_mapper(times: list[datetime]):
    x0, _, x1, _ = PLOT
    start, end = times[0], times[-1]
    span = max(1.0, (end - start).total_seconds())
    return lambda t: x0 + (t - start).total_seconds() / span * (x1 - x0)


def y_mapper(y_min: float, y_max: float):
    _, y0, _, y1 = PLOT
    span = max(1e-9, y_max - y_min)
    return lambda y: y1 - (y - y_min) / span * (y1 - y0)


def draw_line(draw: ImageDraw.ImageDraw, times: list[datetime], values: list[float], xmap, ymap, color: str, width: int) -> None:
    points = [(xmap(t), ymap(v)) for t, v in zip(times, values) if np.isfinite(v)]
    if len(points) >= 2:
        draw.line(points, fill=color, width=width, joint="curve")


def draw_health_plot(
    output_path: Path,
    timestamps: list[datetime],
    engine_health: list[float],
    system_health: dict[str, list[float]],
    summary: dict[str, Any],
) -> None:
    image = Image.new("RGB", (WIDTH, HEIGHT), "white")
    draw = ImageDraw.Draw(image, "RGBA")
    f_title = font(31)
    f_axis = font(21)
    f_tick = font(18)
    f_note = font(19)

    title = f"设备健康度趋势（{timestamps[0].strftime('%Y-%m-%d')} ~ {timestamps[-1].strftime('%Y-%m-%d')}）"
    box = draw.textbbox((0, 0), title, font=f_title)
    draw.text(((WIDTH - (box[2] - box[0])) / 2, 20), title, fill=COLORS["text"], font=f_title)

    x0, y0, x1, y1 = PLOT
    xmap = x_mapper(timestamps)
    ymap = y_mapper(0, 100)

    bands = [
        (90, 100, (209, 250, 229, 90), "优秀"),
        (80, 90, (219, 234, 254, 80), "良好"),
        (65, 80, (254, 243, 199, 85), "关注"),
        (45, 65, (255, 237, 213, 90), "预警"),
        (0, 45, (254, 226, 226, 95), "严重"),
    ]
    for lo, hi, fill, label in bands:
        draw.rectangle((x0, ymap(hi), x1, ymap(lo)), fill=fill)
        draw.text((x1 + 18, (ymap(hi) + ymap(lo)) / 2 - 11), label, fill=COLORS["muted"], font=f_tick)

    for tick in range(0, 101, 20):
        y = ymap(tick)
        draw.line((x0, y, x1, y), fill=COLORS["grid"], width=1)
        draw.text((x0 - 58, y - 11), str(tick), fill=COLORS["text"], font=f_tick)
    n_ticks = min(8, len(timestamps))
    for idx in np.linspace(0, len(timestamps) - 1, n_ticks).astype(int):
        t = timestamps[idx]
        x = xmap(t)
        draw.line((x, y0, x, y1), fill=COLORS["grid"], width=1)
        label = t.strftime("%m-%d")
        b = draw.textbbox((0, 0), label, font=f_tick)
        draw.text((x - (b[2] - b[0]) / 2, y1 + 15), label, fill=COLORS["text"], font=f_tick)

    draw.rectangle(PLOT, outline=COLORS["axis"], width=2)
    draw.text((WIDTH / 2 - 22, y1 + 50), "时间", fill=COLORS["text"], font=f_axis)
    draw.text((24, y0 - 4), "健康分", fill=COLORS["text"], font=f_axis)

    palette = [COLORS["green"], COLORS["orange"], COLORS["purple"], COLORS["cyan"], COLORS["amber"], COLORS["magenta"]]
    legend_items = []
    for color, (name, values) in zip(palette, system_health.items()):
        draw_line(draw, timestamps, values, xmap, ymap, color, 4)
        legend_items.append((system_label(name), color))
    draw_line(draw, timestamps, engine_health, xmap, ymap, COLORS["blue"], 6)
    legend_items.insert(0, ("整机", COLORS["blue"]))

    lx = x0 + 18
    ly = y0 + 14
    for name, color in legend_items[:7]:
        draw.rectangle((lx, ly + 6, lx + 22, ly + 20), fill=color)
        draw.text((lx + 32, ly), name, fill=COLORS["text"], font=f_note)
        lx += 260
        if lx > x1 - 260:
            lx = x0 + 18
            ly += 28

    latest = summary.get("latest", {})
    if latest:
        note = f"最新窗口 {latest.get('timestamp', '')}：整机健康分 {latest.get('engine_health_score', '')}（{latest.get('state_cn', '')}）"
        draw.text((x0, y1 + 88), note, fill=COLORS["muted"], font=f_note)

    image.save(output_path)


def draw_health_series_plot(
    output_path: Path,
    timestamps: list[datetime],
    values: list[float],
    title: str,
    legend_label: str,
    color: str = COLORS["blue"],
) -> None:
    image = Image.new("RGB", (WIDTH, 660), "white")
    draw = ImageDraw.Draw(image, "RGBA")
    f_title = font(30)
    f_axis = font(20)
    f_tick = font(17)
    f_note = font(18)

    box = draw.textbbox((0, 0), title, font=f_title)
    draw.text(((WIDTH - (box[2] - box[0])) / 2, 22), title, fill=COLORS["text"], font=f_title)

    x0, y0, x1, y1 = 160, 92, 1900, 510
    start, end = timestamps[0], timestamps[-1]
    span = max(1.0, (end - start).total_seconds())

    def xmap(t: datetime) -> float:
        return x0 + (t - start).total_seconds() / span * (x1 - x0)

    def ymap(v: float) -> float:
        return y1 - (v / 100.0) * (y1 - y0)

    bands = [
        (90, 100, (209, 250, 229, 80), "优秀"),
        (80, 90, (219, 234, 254, 70), "良好"),
        (65, 80, (254, 243, 199, 80), "关注"),
        (45, 65, (255, 237, 213, 90), "预警"),
        (0, 45, (254, 226, 226, 90), "严重"),
    ]
    for lo, hi, fill, label in bands:
        draw.rectangle((x0, ymap(hi), x1, ymap(lo)), fill=fill)
        draw.text((x1 + 16, (ymap(hi) + ymap(lo)) / 2 - 10), label, fill=COLORS["muted"], font=f_tick)

    for tick in range(0, 101, 20):
        y = ymap(tick)
        draw.line((x0, y, x1, y), fill=COLORS["grid"], width=1)
        draw.text((x0 - 58, y - 10), str(tick), fill=COLORS["text"], font=f_tick)

    n_ticks = min(8, len(timestamps))
    for idx in np.linspace(0, len(timestamps) - 1, n_ticks).astype(int):
        x = xmap(timestamps[idx])
        draw.line((x, y0, x, y1), fill=COLORS["grid"], width=1)
        label = timestamps[idx].strftime("%m-%d")
        b = draw.textbbox((0, 0), label, font=f_tick)
        draw.text((x - (b[2] - b[0]) / 2, y1 + 15), label, fill=COLORS["text"], font=f_tick)

    draw.rectangle((x0, y0, x1, y1), outline=COLORS["axis"], width=2)
    draw_metric_line(draw, [(xmap(t), ymap(float(v))) for t, v in zip(timestamps, values)], color, 5, marker=2)
    draw.rectangle((x0 + 18, y0 + 18, x0 + 42, y0 + 32), fill=color)
    draw.text((x0 + 52, y0 + 12), legend_label, fill=COLORS["text"], font=f_note)
    draw.text((WIDTH / 2 - 22, y1 + 50), "时间", fill=COLORS["text"], font=f_axis)
    draw.text((24, y0 - 4), "健康分", fill=COLORS["text"], font=f_axis)

    latest = values[-1]
    latest_state = health_state(float(latest))
    note = f"最新健康分 {latest}（{state_cn(latest_state)}）；健康分 = 100 x (1 - 风险)，风险越高分数越低。"
    draw.rounded_rectangle((80, 566, 1968, 626), radius=8, outline=COLORS["grid"], width=2, fill=(249, 250, 251, 255))
    draw.text((108, 585), note, fill=COLORS["muted"], font=f_note)
    image.save(output_path)


def draw_metric_line(
    draw: ImageDraw.ImageDraw,
    points: list[tuple[float, float]],
    color: str,
    width: int,
    marker: int = 0,
) -> None:
    points = [(x, y) for x, y in points if np.isfinite(x) and np.isfinite(y)]
    if len(points) >= 2:
        draw.line(points, fill=color, width=width, joint="curve")
    if marker > 0:
        for x, y in points:
            draw.ellipse((x - marker, y - marker, x + marker, y + marker), fill=color)


def draw_metric_detail_plot(
    output_path: Path,
    timestamps: list[datetime],
    selected_keys: list[str],
    point_metrics: dict[str, dict[str, Any]],
    target_type: str,
    target: str,
) -> None:
    panel_h = 1500
    top = 230
    bottom = 180
    height = max(1500, top + panel_h * len(selected_keys) + bottom)
    image = Image.new("RGB", (WIDTH, height), "white")
    draw = ImageDraw.Draw(image, "RGBA")

    f_title = font(31)
    f_panel = font(23, bold=True)
    f_axis = font(18)
    f_tick = font(16)
    f_note = font(18)
    f_small = font(15)

    target_title = scope_label(target_type, target)
    title = f"{target_title}：残差 / EWMA / CUSUM 趋势"
    title_box = draw.textbbox((0, 0), title, font=f_title)
    draw.text(((WIDTH - (title_box[2] - title_box[0])) / 2, 22), title, fill=COLORS["text"], font=f_title)

    legend = [
        ("标准化残差 z (σ)", COLORS["blue"]),
        ("EWMA |z| (σ)", COLORS["green"]),
        ("7天累计偏离", COLORS["cyan"]),
        ("30天累计偏离", COLORS["magenta"]),
        ("参考线 |z|=2", COLORS["reference"]),
        ("原始残差", COLORS["purple"]),
        ("原始值", COLORS["amber"]),
        ("健康基线", COLORS["baseline"]),
        ("趋势虚线", COLORS["trend"]),
    ]
    lx = 120
    ly = 72
    for label, color in legend:
        if lx > 1660:
            lx = 120
            ly += 28
        if "虚线" in label or "参考线" in label:
            draw_dashed_horizontal(draw, lx, lx + 28, ly + 14, color, width=3, dash=10, gap=6)
        else:
            draw.rectangle((lx, ly + 6, lx + 24, ly + 20), fill=color)
        draw.text((lx + 34, ly), label, fill=COLORS["text"], font=f_note)
        lx += 245

    x0 = 220
    x1 = 1848
    start, end = timestamps[0], timestamps[-1]
    span = max(1.0, (end - start).total_seconds())

    def xmap(t: datetime) -> float:
        return x0 + (t - start).total_seconds() / span * (x1 - x0)

    def fmt_tick(value: float) -> str:
        abs_value = abs(value)
        if abs_value >= 100:
            return f"{value:.0f}"
        if abs_value >= 10:
            return f"{value:.1f}"
        return f"{value:.2f}"

    def clamp(value: float, lo: float, hi: float) -> float:
        return min(max(value, lo), hi)

    def draw_trend_label(x: float, y: float, text: str) -> None:
        bbox = draw.textbbox((0, 0), text, font=f_small)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        tx = min(max(x + 10, x0), x1 - tw - 8)
        ty = min(max(y - th - 8, 0), height - th - 12)
        draw.rounded_rectangle(
            (tx - 5, ty - 4, tx + tw + 5, ty + th + 4),
            radius=5,
            fill=(255, 255, 255, 220),
            outline=COLORS["trend"],
            width=1,
        )
        draw.text((tx, ty), text, fill=COLORS["trend"], font=f_small)

    def draw_axis_label(y: float, text: str) -> None:
        draw.multiline_text((24, y + 18), text, fill=COLORS["text"], font=f_axis, spacing=4)

    for panel_idx, key in enumerate(selected_keys):
        metric = point_metrics[key]
        y0 = top + panel_idx * panel_h
        y1 = y0 + 340
        cusum_y0 = y1 + 92
        cusum_y1 = cusum_y0 + 250
        residual_y0 = cusum_y1 + 100
        residual_y1 = residual_y0 + 280
        raw_y0 = residual_y1 + 90
        raw_y1 = raw_y0 + 280
        signed_z = [float(v) for v in metric["z"]]
        ew = [float(v) for v in metric["ewma"]]
        cu_short = [float(v) for v in metric.get("cusum_7d_area", metric.get("cusum_short_area", []))]
        cu_long = [float(v) for v in metric.get("cusum_30d_area", metric.get("cusum_long_area", []))]
        residual_values = [float(v) for v in metric.get("residual", [])]
        baseline_values = [float(v) for v in metric.get("baseline_median", metric.get("fixed_baseline", []))]
        raw_values = [float(v) for v in metric.get("raw", [])]
        scale_values = [float(v) for v in metric.get("scale", [])]
        latest_health = metric["health"][-1]
        latest_state = health_state(latest_health)

        unit = KEY_TO_SENSOR[key].unit if key in KEY_TO_SENSOR and KEY_TO_SENSOR[key].unit else "原始单位"
        finite_standard = [v for v in signed_z + ew if np.isfinite(v)]
        if finite_standard:
            robust_abs = float(np.nanpercentile([abs(v) for v in finite_standard], 98))
            y_abs = max(3.2, min(8.0, robust_abs * 1.18 + 0.25))
        else:
            y_abs = 3.2
        y_min = -y_abs
        y_max = y_abs

        def ymap(value: float) -> float:
            clipped = clamp(value, y_min, y_max)
            return y1 - (clipped - y_min) / max(1e-9, y_max - y_min) * (y1 - y0)

        residual_finite = [v for v in residual_values if np.isfinite(v)]
        if residual_finite:
            residual_min = min(min(residual_finite), 0.0)
            residual_max = max(max(residual_finite), 0.0)
            span_residual = max(residual_max - residual_min, 1e-6)
            pad = max(span_residual * 0.12, 0.05)
            residual_min -= pad
            residual_max += pad
        else:
            residual_min, residual_max = -1.0, 1.0

        def residual_ymap(value: float) -> float:
            clipped = clamp(value, residual_min, residual_max)
            return residual_y1 - (clipped - residual_min) / max(1e-9, residual_max - residual_min) * (residual_y1 - residual_y0)

        raw_finite = [v for v in raw_values + baseline_values if np.isfinite(v)]
        if raw_finite:
            raw_min = min(raw_finite)
            raw_max = max(raw_finite)
            raw_span = max(raw_max - raw_min, 1e-6)
            raw_pad = max(raw_span * 0.10, max(abs(raw_min), abs(raw_max), 1.0) * 0.002)
            raw_min -= raw_pad
            raw_max += raw_pad
        else:
            raw_min, raw_max = -1.0, 1.0

        def raw_ymap(value: float) -> float:
            clipped = clamp(value, raw_min, raw_max)
            return raw_y1 - (clipped - raw_min) / max(1e-9, raw_max - raw_min) * (raw_y1 - raw_y0)

        finite_cusum = [v for v in cu_short + cu_long if np.isfinite(v)]
        cusum_max = max(max(finite_cusum) * 1.12 if finite_cusum else 0.0, 1.0)

        def cusum_ymap(value: float) -> float:
            clipped = clamp(value, 0.0, cusum_max)
            return cusum_y1 - clipped / max(1e-9, cusum_max) * (cusum_y1 - cusum_y0)

        draw.text((x0, y0 - 36), sensor_label(key), fill=COLORS["text"], font=f_panel)
        if raw_values and baseline_values and residual_values:
            scale_text = f"  MAD尺度 {scale_values[-1]:.2f}{unit}" if scale_values else ""
            summary = (
                f"最新健康分 {latest_health}（{state_cn(latest_state)}）  "
                f"原始值 {raw_values[-1]:.2f}{unit}  健康基线 {baseline_values[-1]:.2f}{unit}  "
                f"原始残差 {residual_values[-1]:+.2f}{unit}{scale_text}"
            )
        else:
            summary = f"最新健康分 {latest_health}（{state_cn(latest_state)}）  风险 {metric['risk'][-1]:.3f}"
        draw.text((x0 + 520, y0 - 31), summary, fill=COLORS["muted"], font=f_note)

        ticks = np.linspace(y_min, y_max, 7)
        for tick in ticks:
            y = ymap(float(tick))
            draw.line((x0, y, x1, y), fill=COLORS["grid"], width=1)
            draw.text((x0 - 82, y - 9), f"{tick:.1f}", fill=COLORS["muted"], font=f_tick)
        zero_y = ymap(0.0)
        draw.line((x0, zero_y, x1, zero_y), fill="#9CA3AF", width=2)
        for ref in (-2.0, 2.0):
            if y_min <= ref <= y_max:
                draw_dashed_horizontal(draw, x0, x1, ymap(ref), COLORS["reference"], width=3, dash=18, gap=12)

        n_ticks = min(7, len(timestamps))
        for idx in np.linspace(0, len(timestamps) - 1, n_ticks).astype(int):
            x = xmap(timestamps[idx])
            draw.line((x, y0, x, y1), fill=COLORS["grid"], width=1)
            if panel_idx == len(selected_keys) - 1:
                label = timestamps[idx].strftime("%m-%d")
                box = draw.textbbox((0, 0), label, font=f_tick)
                draw.text((x - (box[2] - box[0]) / 2, raw_y1 + 14), label, fill=COLORS["text"], font=f_tick)

        draw.rectangle((x0, y0, x1, y1), outline=COLORS["axis"], width=2)
        draw_metric_line(draw, [(xmap(t), ymap(v)) for t, v in zip(timestamps, signed_z)], COLORS["blue"], 3, marker=2)
        draw_metric_line(draw, [(xmap(t), ymap(v)) for t, v in zip(timestamps, ew)], COLORS["green"], 3)
        z_trend = draw_trend_line(draw, timestamps, signed_z, xmap, ymap, COLORS["trend"], width=3)
        draw_axis_label(y0, "标准化值\n(σ)")
        if z_trend is not None:
            draw_trend_label(
                xmap(timestamps[-1]),
                ymap(z_trend.end_value),
                f"总偏移 {z_trend.total_delta:+.2f}σ",
            )

        for tick in np.linspace(0.0, cusum_max, 6):
            y = cusum_ymap(float(tick))
            draw.line((x0, y, x1, y), fill=COLORS["grid"], width=1)
            draw.text((x0 - 82, y - 9), fmt_tick(float(tick)), fill=COLORS["muted"], font=f_tick)
        zero_cusum_y = cusum_ymap(0.0)
        draw.line((x0, zero_cusum_y, x1, zero_cusum_y), fill="#9CA3AF", width=2)
        draw.rectangle((x0, cusum_y0, x1, cusum_y1), outline=COLORS["axis"], width=2)
        for idx in np.linspace(0, len(timestamps) - 1, n_ticks).astype(int):
            x = xmap(timestamps[idx])
            draw.line((x, cusum_y0, x, cusum_y1), fill=COLORS["grid"], width=1)
        draw_metric_line(draw, [(xmap(t), cusum_ymap(v)) for t, v in zip(timestamps, cu_short)], COLORS["cyan"], 3)
        draw_metric_line(draw, [(xmap(t), cusum_ymap(v)) for t, v in zip(timestamps, cu_long)], COLORS["magenta"], 3)
        draw_axis_label(cusum_y0, "累计偏离\n面积")
        draw.text((x0 + 12, cusum_y0 + 12), "7天", fill=COLORS["cyan"], font=f_small)
        draw.text((x0 + 74, cusum_y0 + 12), "30天", fill=COLORS["magenta"], font=f_small)

        for tick in np.linspace(residual_min, residual_max, 6):
            y = residual_ymap(float(tick))
            draw.line((x0, y, x1, y), fill=COLORS["grid"], width=1)
            draw.text((x0 - 96, y - 9), fmt_tick(float(tick)), fill=COLORS["muted"], font=f_tick)
        zero_residual_y = residual_ymap(0.0)
        draw.line((x0, zero_residual_y, x1, zero_residual_y), fill="#9CA3AF", width=2)
        draw.rectangle((x0, residual_y0, x1, residual_y1), outline=COLORS["axis"], width=2)
        for idx in np.linspace(0, len(timestamps) - 1, n_ticks).astype(int):
            x = xmap(timestamps[idx])
            draw.line((x, residual_y0, x, residual_y1), fill=COLORS["grid"], width=1)
        if residual_values:
            draw_metric_line(draw, [(xmap(t), residual_ymap(v)) for t, v in zip(timestamps, residual_values)], COLORS["purple"], 3, marker=2)
            residual_trend = draw_trend_line(draw, timestamps, residual_values, xmap, residual_ymap, COLORS["trend"], width=3)
            trend_parts = []
            if residual_trend is not None:
                trend_parts.append(f"原始残差趋势 {residual_trend.per_30d:+.2f}{unit}/30天")
            if z_trend is not None:
                trend_parts.append(f"z趋势 {z_trend.per_30d:+.2f}σ/30天")
            if trend_parts:
                draw.text((x0 + 12, residual_y1 + 42), "；".join(trend_parts), fill=COLORS["muted"], font=f_small)
            if residual_trend is not None:
                draw_trend_label(
                    xmap(timestamps[-1]),
                    residual_ymap(residual_trend.end_value),
                    f"总偏移 {residual_trend.total_delta:+.2f}{unit}",
                )
        draw_axis_label(residual_y0, f"原始残差\n({unit})")

        for tick in np.linspace(raw_min, raw_max, 6):
            y = raw_ymap(float(tick))
            draw.line((x0, y, x1, y), fill=COLORS["grid"], width=1)
            draw.text((x0 - 96, y - 9), fmt_tick(float(tick)), fill=COLORS["muted"], font=f_tick)
        draw.rectangle((x0, raw_y0, x1, raw_y1), outline=COLORS["axis"], width=2)
        for idx in np.linspace(0, len(timestamps) - 1, n_ticks).astype(int):
            x = xmap(timestamps[idx])
            draw.line((x, raw_y0, x, raw_y1), fill=COLORS["grid"], width=1)
        if raw_values:
            draw_metric_line(draw, [(xmap(t), raw_ymap(v)) for t, v in zip(timestamps, raw_values)], COLORS["amber"], 3, marker=2)
        if baseline_values:
            draw_metric_line(draw, [(xmap(t), raw_ymap(v)) for t, v in zip(timestamps, baseline_values)], COLORS["baseline"], 3)
        draw_axis_label(raw_y0, f"原始值\n({unit})")
        draw.text((x0 + 12, raw_y0 + 12), "原始值", fill=COLORS["amber"], font=f_small)
        if baseline_values:
            draw.text((x0 + 88, raw_y0 + 12), "健康基线", fill=COLORS["baseline"], font=f_small)

    footer_y = height - 88
    draw.rounded_rectangle((80, footer_y, 1968, height - 28), radius=8, outline=COLORS["grid"], width=2, fill=(249, 250, 251, 255))
    note = "说明：上图为标准化残差/EWMA，单位 σ；中图为 7/30 天累计偏离面积；第三图为 raw_value - baseline_median 的原始单位残差；第四图为原始传感器值和健康基线。"
    draw.text((108, footer_y + 20), note, fill=COLORS["muted"], font=f_small)
    image.save(output_path)


def make_summary(
    df: pd.DataFrame,
    point_risks: pd.DataFrame,
    local_risks: pd.DataFrame,
    system_risks: pd.DataFrame,
    cylinder_risks: pd.DataFrame,
    engine_risk: pd.Series,
    baselines: dict[str, dict[str, Any]],
    point_details: dict[str, dict[str, Any]],
    point_metrics: dict[str, dict[str, Any]],
    local_groups: dict[str, list[str]],
    systems: dict[str, list[str]],
    cylinders: dict[str, list[str]],
    sensor_names: dict[str, str],
    artifacts: dict[str, str],
    example_system: str | None,
    diagnostic_date: str | None,
) -> dict[str, Any]:
    engine_health = health_from_risk(float(engine_risk.iloc[-1]))
    point_rank = latest_ranked(point_risks, sensor_names, limit=10)
    local_rank = latest_ranked(local_risks, None, limit=10)
    system_rank = latest_ranked(system_risks, None, limit=10)
    cylinder_rank = latest_ranked(cylinder_risks, None, limit=10)

    example_index = len(df) - 1
    example_mode = "latest"
    example_system_id = None
    if example_system:
        try:
            example_system_id = resolve_named_key(example_system, [c for c in system_risks.columns if c != "timestamp"], SYSTEM_CN)
        except ValueError:
            example_system_id = None
    if example_system_id and example_system_id in system_risks.columns:
        example_index = int(system_risks[example_system_id].astype(float).idxmax())
        example_mode = "worst_window_in_example_system"

    if example_system_id and example_system_id in system_risks.columns:
        system_candidates = ranked_at(system_risks[["timestamp", example_system_id]], example_index, None, limit=1)
        top_system = system_candidates[0]
        local_keys = [g for g in systems.get(example_system_id, []) if g in local_risks.columns]
        local_source = local_risks[["timestamp"] + local_keys] if local_keys else local_risks
        top_local = ranked_at(local_source, example_index, None, limit=1)[0]
        point_keys = [k for k in local_groups.get(top_local["id"], []) if k in point_risks.columns]
        if not point_keys:
            point_keys = [
                key
                for group in systems.get(example_system_id, [])
                for key in local_groups.get(group, [])
                if key in point_risks.columns
            ]
        point_source = point_risks[["timestamp"] + point_keys] if point_keys else point_risks
        top_point = ranked_at(point_source, example_index, sensor_names, limit=1)[0]
    else:
        top_point = point_rank[0]
        top_local = local_rank[0]
        top_system = system_rank[0]

    if top_point["id"] in point_metrics:
        metric = point_metrics[top_point["id"]]
        top_point["metrics"] = {
            "z": round(float(metric["z"][example_index]), 3),
            "abs_z": round(float(metric["abs_z"][example_index]), 3),
            "ewma": round(float(metric["ewma"][example_index]), 3),
            "cusum": round(float(metric["cusum"][example_index]), 3),
            "risk": round(float(metric["risk"][example_index]), 3),
            "health": health_from_risk(float(metric["risk"][example_index])),
            "latest_snapshot": point_details[top_point["id"]],
            "residual_raw": round(float(metric.get("residual", [np.nan])[example_index]), 3),
            "baseline_median": round(float(metric.get("baseline_median", [np.nan])[example_index]), 3),
            "baseline_mad": round(float(metric.get("baseline_mad", [np.nan])[example_index]), 3),
            "cusum_7d_area": round(float(metric.get("cusum_7d_area", [np.nan])[example_index]), 3),
            "cusum_30d_area": round(float(metric.get("cusum_30d_area", [np.nan])[example_index]), 3),
        }
    example_engine_health = health_from_risk(float(engine_risk.iloc[example_index]))
    example_engine_state = health_state(example_engine_health)

    def metrics_at(rows: list[dict[str, Any]], index: int) -> list[dict[str, Any]]:
        enriched = []
        for row in rows:
            item = dict(row)
            key = item["id"]
            if key in point_metrics:
                metric = point_metrics[key]
                item["metrics"] = {
                    "z": round(float(metric["z"][index]), 3),
                    "abs_z": round(float(metric["abs_z"][index]), 3),
                    "ewma": round(float(metric["ewma"][index]), 3),
                    "cusum_7d_area": round(float(metric.get("cusum_7d_area", [np.nan])[index]), 3),
                    "cusum_30d_area": round(float(metric.get("cusum_30d_area", [np.nan])[index]), 3),
                    "residual_raw": round(float(metric.get("residual", [np.nan])[index]), 3),
                }
            enriched.append(item)
        return enriched

    def latest_snapshot_df(df_in: pd.DataFrame, names: dict[str, str] | None = None) -> list[dict[str, Any]]:
        return all_ranked(df_in, len(df) - 1, names)

    diagnostics: dict[str, Any] = {}
    engine_health_series = [health_from_risk(float(v)) for v in engine_risk]
    min_idx = int(np.nanargmin(engine_health_series))
    diagnostics["lowest_engine_window"] = {
        "timestamp": df["timestamp"].iloc[min_idx].strftime("%Y-%m-%d %H:%M:%S"),
        "engine_health_score": engine_health_series[min_idx],
        "state": health_state(engine_health_series[min_idx]),
        "state_cn": state_cn(health_state(engine_health_series[min_idx])),
        "rpm": round(float(df[RPM_KEY].iloc[min_idx]), 2),
        "rpm_zone": rpm_zone(float(df[RPM_KEY].iloc[min_idx])),
        "rpm_zone_cn": rpm_zone_cn(rpm_zone(float(df[RPM_KEY].iloc[min_idx]))),
        "top_systems": ranked_at(system_risks, min_idx, None, limit=5),
        "top_cylinders": ranked_at(cylinder_risks, min_idx, None, limit=6),
        "top_sensors": metrics_at(ranked_at(point_risks, min_idx, sensor_names, limit=8), min_idx),
    }
    if diagnostic_date:
        date_mask = df["timestamp"].dt.strftime("%Y-%m-%d").eq(diagnostic_date)
        diagnostics["date"] = diagnostic_date
        diagnostics["date_windows"] = []
        for idx in list(df.index[date_mask]):
            diagnostics["date_windows"].append({
                "timestamp": df["timestamp"].iloc[idx].strftime("%Y-%m-%d %H:%M:%S"),
                "engine_health_score": engine_health_series[idx],
                "state": health_state(engine_health_series[idx]),
                "state_cn": state_cn(health_state(engine_health_series[idx])),
                "rpm": round(float(df[RPM_KEY].iloc[idx]), 2),
                "rpm_zone": rpm_zone(float(df[RPM_KEY].iloc[idx])),
                "rpm_zone_cn": rpm_zone_cn(rpm_zone(float(df[RPM_KEY].iloc[idx]))),
                "top_systems": ranked_at(system_risks, idx, None, limit=5),
                "top_cylinders": ranked_at(cylinder_risks, idx, None, limit=6),
                "top_sensors": metrics_at(ranked_at(point_risks, idx, sensor_names, limit=8), idx),
            })

    latest_engine_state = health_state(engine_health)
    scoring_standard = {
        "point_risk_formula": "point_risk = 0.15*instant_abs_z_risk + 0.25*ewma_abs_z_risk + 0.30*cusum_7d_area_risk + 0.30*cusum_30d_area_risk, clipped to [0, 1].",
        "risk_to_health_score": "health_score = round(100 * (1 - clipped_risk), 1).",
        "risk_component_mapping": "Each component is mapped by smoothstep from its low threshold to high threshold; below low => 0 risk, above high => 1 risk.",
        "threshold_policy": POINT_RISK_THRESHOLD_POLICY,
        "point_risk_weights": POINT_RISK_WEIGHTS,
        "level_aggregation": {
            "formula": "aggregated_risk = min(1, 0.25 * max(child_risks) + 0.75 * mean(child_risks))",
            "weights": LEVEL_RISK_WEIGHTS,
        },
        "score_bands": HEALTH_SCORE_BANDS,
    }
    return {
        "schema_version": "ship-health-score.result.v1",
        "schema_path": str(RESULT_SCHEMA_PATH),
        "source": {
            "mode": "raw_json_window_mean",
            "windows": int(len(df)),
            "time_start": df["timestamp"].iloc[0].strftime("%Y-%m-%d %H:%M:%S"),
            "time_end": df["timestamp"].iloc[-1].strftime("%Y-%m-%d %H:%M:%S"),
            "baseline_sensor_count": len([k for k in baselines if not k.startswith("_")]),
            "baseline": baseline_meta(baselines, Path(artifacts["baseline_fixed_json"]) if "baseline_fixed_json" in artifacts else None),
            "rpm_zone_counts": {
                str(zone): int(count)
                for zone, count in df[RPM_KEY].apply(rpm_zone).value_counts().sort_index().items()
            },
            "rpm_zone_note": "Scoring uses actual DC0001 RPM zones in the input windows; the folder name 'cruise' does not guarantee every window is RPM>=93.",
        },
        "method": {
            "baseline": "Fixed health baseline by RPM zone. Healthy baseline = historical median; fluctuation fields include MAD, std and IQR; scoring scale prefers MAD.",
            "standardized_residual": "z = (raw_value - baseline_median) / baseline_scale_mad",
            "ewma": "EWMA is calculated from abs(z).",
            "cusum_health": "Cumulative deviation area uses D_t = max(0, abs(z_t) - tolerance), summed over recent 7 and 30 days.",
            "scoring_standard": scoring_standard,
            "rolling_baseline": "Not used for scoring or plotting in this result version.",
        },
        "latest": {
            "timestamp": df["timestamp"].iloc[-1].strftime("%Y-%m-%d %H:%M:%S"),
            "engine_health_score": engine_health,
            "state": latest_engine_state,
            "state_cn": state_cn(latest_engine_state),
            "top_sensor_risks": point_rank[:5],
            "top_local_group_risks": local_rank[:5],
            "top_system_risks": system_rank[:5],
            "top_cylinder_risks": cylinder_rank[:6],
        },
        "health": {
            "whole_engine": {
                "id": "whole_engine",
                "name_cn": "整机",
                "health_score": engine_health,
                "state": latest_engine_state,
                "state_cn": state_cn(latest_engine_state),
                "risk": round(float(engine_risk.iloc[-1]), 3),
            },
            "systems": latest_snapshot_df(system_risks),
            "local_groups": latest_snapshot_df(local_risks),
            "cylinders": latest_snapshot_df(cylinder_risks),
            "sensors": latest_snapshot_df(point_risks, sensor_names),
        },
        "four_levels": {
            "sensor_point": "Single sensor residual z-score tracked by EWMA/CUSUM.",
            "local_group": "Local physical group, aggregated by max-plus-average from sensors.",
            "system": "Major system, aggregated from local groups.",
            "whole_engine": "Whole engine, aggregated from major systems.",
            "cylinder": "Cylinder health aggregated from cylinder-related temperature sensors.",
        },
        "examples": {
            "mode": example_mode,
            "timestamp": df["timestamp"].iloc[example_index].strftime("%Y-%m-%d %H:%M:%S"),
            "sensor_point": top_point,
            "local_group": {
                **top_local,
                "member_sensors": [
                    {
                        "key": k,
                        "name": sensor_names.get(k, k),
                        "name_cn": SENSOR_CN.get(k, sensor_names.get(k, k)),
                    }
                    for k in local_groups.get(top_local["id"], [])
                ],
            },
            "system": {
                **top_system,
                "member_local_groups": [
                    {
                        "id": group,
                        "name_cn": local_group_label(group),
                    }
                    for group in systems.get(top_system["id"], [])
                ],
            },
            "cylinder": ranked_at(cylinder_risks, example_index, None, limit=1)[0] if len(cylinders) else None,
            "whole_engine": {
                "id": "whole_engine",
                "name_cn": "整机",
                "health_score": example_engine_health,
                "state": example_engine_state,
                "state_cn": state_cn(example_engine_state),
            },
        },
        "diagnostics": diagnostics,
        "groups": {
            "systems": systems,
            "local_groups": local_groups,
            "cylinders": cylinders,
        },
        "artifacts": artifacts,
    }


def run(args: argparse.Namespace) -> dict[str, Any]:
    input_path = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    baseline_path = Path(args.baseline_path) if args.baseline_path else DEFAULT_BASELINE_PATH

    df = load_raw_json_dir(input_path, args.pattern, args.max_files)
    if args.mode in {"fit", "fit-score"}:
        baselines = build_condition_baselines(
            df,
            args.baseline_fraction,
            args.min_baseline,
            args.baseline_months,
            args.baseline_exclude_dates,
        )
        save_baselines(baseline_path, baselines)
        if args.mode == "fit":
            return {
                "source": {
                    "mode": "fit_fixed_baseline",
                    "windows": int(len(df)),
                    "time_start": df["timestamp"].iloc[0].strftime("%Y-%m-%d %H:%M:%S"),
                    "time_end": df["timestamp"].iloc[-1].strftime("%Y-%m-%d %H:%M:%S"),
                },
                "artifacts": {"baseline_fixed_json": str(baseline_path)},
                "baseline": baseline_meta(baselines, baseline_path),
            }
    else:
        if not baseline_path.exists():
            raise RuntimeError(f"Fixed baseline not found: {baseline_path}. Run with --mode fit-score first.")
        baselines = load_baselines(baseline_path)
    z_df, baseline_df, residual_df, scale_df, mad_df, std_df, iqr_df, n_df = calculate_deviation_frames(df, baselines)
    point_risks, point_details, point_metrics = score_points(
        z_df,
        args.ewma_alpha,
        args.cusum_tolerance,
        (args.cusum_short_days, args.cusum_long_days),
    )
    for key, metric in point_metrics.items():
        if key in df.columns:
            metric["raw"] = df[key].astype(float).replace([np.inf, -np.inf], np.nan).tolist()
        if key in baseline_df.columns:
            metric["baseline_median"] = baseline_df[key].astype(float).replace([np.inf, -np.inf], np.nan).tolist()
            metric["fixed_baseline"] = metric["baseline_median"]
            metric["baseline"] = metric["baseline_median"]
        if key in residual_df.columns:
            metric["residual"] = residual_df[key].astype(float).replace([np.inf, -np.inf], np.nan).tolist()
        if key in scale_df.columns:
            metric["scale"] = scale_df[key].astype(float).replace([np.inf, -np.inf], np.nan).tolist()
        if key in mad_df.columns:
            metric["baseline_mad"] = mad_df[key].astype(float).replace([np.inf, -np.inf], np.nan).tolist()
        if key in std_df.columns:
            metric["baseline_std"] = std_df[key].astype(float).replace([np.inf, -np.inf], np.nan).tolist()
        if key in iqr_df.columns:
            metric["baseline_iqr"] = iqr_df[key].astype(float).replace([np.inf, -np.inf], np.nan).tolist()
        if key in n_df.columns:
            metric["baseline_n"] = n_df[key].astype(float).replace([np.inf, -np.inf], np.nan).tolist()
    local_groups, systems, sensor_names = build_groups()
    cylinders = build_cylinder_groups()
    local_risks = aggregate_level(point_risks, local_groups)
    cylinder_risks = aggregate_level(point_risks, cylinders)

    system_source = pd.DataFrame({"timestamp": local_risks["timestamp"]})
    for system, group_names in systems.items():
        available = [g for g in group_names if g in local_risks.columns]
        if available:
            system_source[system] = [aggregate_risks(list(row)) for row in local_risks[available].to_numpy()]
    system_risks = system_source

    system_cols = [c for c in system_risks.columns if c != "timestamp"]
    engine_risk = pd.Series([aggregate_risks(list(row)) for row in system_risks[system_cols].to_numpy()])

    timeseries_path = output_dir / "health_timeseries.csv"
    point_metrics_path = output_dir / "point_metrics_long.csv"
    plot_path = output_dir / "health_score_overview.png"
    detail_target_id, detail_keys = select_target_sensors(args.detail_type, args.detail_target, local_groups, systems)
    selected_detail_keys = rank_plot_sensors(detail_keys, point_risks, args.detail_max_sensors)
    detail_plot_path = output_dir / f"health_detail_{args.detail_type}_{detail_target_id}.png"
    cylinder_detail_target = str(getattr(args, "cylinder_detail_target", "6") or "").strip()
    cylinder_detail_target_id = ""
    cylinder_detail_keys: list[str] = []
    cylinder_detail_plot_path: Path | None = None
    if cylinder_detail_target:
        cylinder_detail_target_id, raw_cylinder_keys = select_target_sensors("cylinder", cylinder_detail_target, local_groups, systems)
        cylinder_detail_max = int(getattr(args, "cylinder_detail_max_sensors", 8) or 8)
        cylinder_detail_keys = rank_plot_sensors(raw_cylinder_keys, point_risks, cylinder_detail_max)
        cylinder_detail_plot_path = output_dir / f"health_detail_cylinder_{cylinder_detail_target_id}.png"
    result_path = output_dir / "result.json"

    write_timeseries(timeseries_path, point_risks, local_risks, system_risks, engine_risk)
    write_point_metrics(point_metrics_path, df, point_metrics)
    artifacts = {
        "timeseries_csv": str(timeseries_path),
        "point_metrics_csv": str(point_metrics_path),
        "baseline_fixed_json": str(baseline_path),
        "plot_png": str(plot_path),
        "detail_plot_png": str(detail_plot_path),
        "result_json": str(result_path),
    }
    if cylinder_detail_plot_path is not None:
        artifacts[f"cylinder_{cylinder_detail_target_id}_detail_plot_png"] = str(cylinder_detail_plot_path)
    summary = make_summary(
        df,
        point_risks,
        local_risks,
        system_risks,
        cylinder_risks,
        engine_risk,
        baselines,
        point_details,
        point_metrics,
        local_groups,
        systems,
        cylinders,
        sensor_names,
        artifacts,
        args.example_system,
        args.diagnostic_date,
    )

    timestamps = [pd.Timestamp(t).to_pydatetime() for t in df["timestamp"]]
    engine_health = [health_from_risk(float(x)) for x in engine_risk]
    overview_cols = system_cols[:5]
    if args.example_system:
        try:
            focus_system = resolve_named_key(args.example_system, system_cols, SYSTEM_CN)
            if focus_system not in overview_cols:
                overview_cols = (overview_cols + [focus_system])[:6]
        except ValueError:
            pass
    system_health = {
        col: [health_from_risk(float(v)) for v in system_risks[col]]
        for col in overview_cols
    }
    draw_health_plot(plot_path, timestamps, engine_health, system_health, summary)
    draw_metric_detail_plot(
        detail_plot_path,
        timestamps,
        selected_detail_keys,
        point_metrics,
        args.detail_type,
        detail_target_id,
    )
    if (
        cylinder_detail_plot_path is not None
        and cylinder_detail_keys
        and cylinder_detail_plot_path != detail_plot_path
    ):
        draw_metric_detail_plot(
            cylinder_detail_plot_path,
            timestamps,
            cylinder_detail_keys,
            point_metrics,
            "cylinder",
            cylinder_detail_target_id,
        )

    with result_path.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="EWMA/CUSUM ship health score prototype")
    parser.add_argument("--input", default="tmp/raw_json/cruise", help="Raw JSON file or directory.")
    parser.add_argument("--pattern", default="cruise_*.json", help="Glob pattern when input is a directory.")
    parser.add_argument("--output", default="ship-health-score/output", help="Output directory.")
    parser.add_argument("--mode", default="score", choices=["score", "fit", "fit-score"], help="score reads a fixed baseline; fit writes it; fit-score does both.")
    parser.add_argument("--baseline-path", default=None, help=f"Fixed baseline JSON path. Defaults to {DEFAULT_BASELINE_PATH}.")
    parser.add_argument("--max-files", type=int, default=None, help="Limit file count for quick demos.")
    parser.add_argument("--baseline-fraction", type=float, default=1.0, help="Earliest fraction used as historical baseline.")
    parser.add_argument("--baseline-months", default=DEFAULT_BASELINE_MONTHS, help="Comma-separated YYYY-MM months used to fit fixed baseline.")
    parser.add_argument("--baseline-exclude-dates", default=DEFAULT_EXCLUDE_DATES, help="Comma-separated YYYY-MM-DD dates excluded from baseline fitting.")
    parser.add_argument("--min-baseline", type=int, default=30, help="Minimum baseline windows.")
    parser.add_argument("--ewma-alpha", type=float, default=0.22, help="EWMA smoothing factor.")
    parser.add_argument("--cusum-tolerance", type=float, default=0.5, help="CUSUM health area tolerance in abs-z units.")
    parser.add_argument("--cusum-short-days", type=int, default=DEFAULT_CUSUM_WINDOWS_DAYS[0], help="Short cumulative deviation area window in days.")
    parser.add_argument("--cusum-long-days", type=int, default=DEFAULT_CUSUM_WINDOWS_DAYS[1], help="Long cumulative deviation area window in days.")
    parser.add_argument("--detail-type", default="system", choices=["sensor", "system", "local_group", "cylinder"], help="Scope for residual/EWMA/CUSUM detail plot.")
    parser.add_argument("--detail-target", default="cooling_system", help="Target id/name for the detail plot.")
    parser.add_argument("--detail-max-sensors", type=int, default=4, help="Max sensors shown in the detail plot.")
    parser.add_argument("--cylinder-detail-target", default="6", help="Extra cylinder detail plot target. Empty string disables this extra plot.")
    parser.add_argument("--cylinder-detail-max-sensors", type=int, default=8, help="Max sensors shown in the extra cylinder detail plot.")
    parser.add_argument("--example-system", default="cooling_system", help="System used for four-level examples; empty string uses latest top risks.")
    parser.add_argument("--diagnostic-date", default=None, help="Optional YYYY-MM-DD date to include health-drop diagnostics.")
    args = parser.parse_args()
    if args.example_system == "":
        args.example_system = None
    summary = run(args)
    payload = {
        "result_json": summary["artifacts"]["result_json"],
        "plot_png": summary["artifacts"]["plot_png"],
        "detail_plot_png": summary["artifacts"]["detail_plot_png"],
        "cylinder_6_detail_plot_png": summary["artifacts"].get("cylinder_6_detail_plot_png"),
        "point_metrics_csv": summary["artifacts"]["point_metrics_csv"],
        "baseline_fixed_json": summary["artifacts"].get("baseline_fixed_json"),
        "engine_health_score": summary["latest"]["engine_health_score"],
        "state": summary["latest"]["state"],
        "state_cn": summary["latest"]["state_cn"],
    } if "latest" in summary else summary
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

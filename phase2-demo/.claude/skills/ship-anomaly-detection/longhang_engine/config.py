"""
Ship Anomaly Detection Config — V7.8.5
======================================
All sensor mappings derived from engine.registry.
Internal names (rpm, exh_cyl4, cfw_in_temp …) are the canonical keys everywhere.
"""

import json
from pathlib import Path

# torch is a hard dependency for DL inference (imported in engine/dl.py)
# Not imported here to avoid blocking stat-only workflows

# ── Paths ────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent  # → skill root
DATA_DIR = BASE_DIR / "data"
BASELINE_DIR = DATA_DIR / "baselines"

# ── Sensor registry (engine.registry, not sensor_registry) ──────────────
from .registry import (                         # noqa: E402
    SENSOR_GROUPS,
    get_display, find_cyl_sensors,
)

# ── Detection groups (first-match priority) ─────────────────────────────
DETECT_GROUPS = [
    ("exhaust_temp",  "ch1_inter_cyl"),
    ("exhaust_dev",   "ch1_inter_cyl"),
    ("scavenge_temp", "ch1_inter_cyl"),
    ("piston_lo",     "ch1_inter_cyl"),
    ("cfw_outlet",    "ch2_abs_ar"),
    ("cfw_inlet",     "ch2_abs_ar"),
    ("lo_main",       "ch3_dt_ar"),
    ("turbo_lo",      "ch2_abs_ar"),
    ("air_cooler",    "ch3_dt_ar"),
    ("damper_lo",     "ch2_abs_ar"),
    ("bearing_temp",  "ch2_abs_ar"),
    ("control_air",   "ch2_abs_ar"),
    ("fuel_oil",      "ch2_abs_ar"),
    ("servo_oil",     "ch2_abs_ar"),
    ("scavenge_press","ch2_abs_ar"),
]

# ── Feature fallback chains (priority descending) ───────────────────────
FEATURE_FALLBACK = [
    ("rpm_scav", ["rpm", "scav_cyl1"]),
    ("rpm_cfw",  ["rpm", "cfw_in_temp"]),
    ("rpm_only", ["rpm"]),
]

SCAVENGE_FEATURE_FALLBACK = [
    ("rpm_scav", ["rpm", "scav_cyl1"]),
    ("rpm_cfw",  ["rpm", "cfw_in_temp"]),
    ("rpm_only", ["rpm"]),
]

# ── Inherent bias (loaded from JSON) ────────────────────────────────────
INHERENT_BIAS_DEFAULT = {}
INHERENT_BIAS_TABLE_PATH = str(DATA_DIR / "inherent_bias.json")
INHERENT_BIAS_TABLE: dict = {}
try:
    with open(INHERENT_BIAS_TABLE_PATH) as _f:
        INHERENT_BIAS_TABLE = json.load(_f)
except (FileNotFoundError, json.JSONDecodeError, OSError):
    pass

# ── Group Z-score thresholds ────────────────────────────────────────────
GROUP_Z_THRESH = {
    "exhaust_temp":  6.0, "exhaust_dev":  4.0, "scavenge_temp": 5.0,
    "piston_lo":     4.0, "cfw_outlet":   4.0, "cfw_inlet":     3.5,
    "lo_main":       3.5, "turbo_lo":     3.5, "air_cooler":    3.5,
    "damper_lo":     3.5, "bearing_temp": 3.5, "control_air":   3.5,
    "fuel_oil":      3.5, "servo_oil":    3.5, "scavenge_press":3.5,
}

# ── Sensitivity presets ─────────────────────────────────────────────────
SENSITIVITY_MAP = {
    "strict":  {"z_offset": 0.0, "min_consecutive": 3, "min_duration_min": 10,
                "z_mult": 1.0, "burst_offset": 1.5},
    "normal":  {"z_offset": 0.5, "min_consecutive": 3, "min_duration_min": 5,
                "z_mult": 0.85, "burst_offset": 1.0},
    "relaxed": {"z_offset": 1.0, "min_consecutive": 2, "min_duration_min": 3,
                "z_mult": 0.75, "burst_offset": 0.5},
}

# ── Gradual-drift sensor parameters ─────────────────────────────────────
GRADUAL_SENSORS = {
    "cfw_out":      {"slope_threshold": 0.30, "min_consecutive": 4, "min_points": 20},
    "piston_lo":    {"slope_threshold": 0.30, "min_consecutive": 4, "min_points": 20},
    "exh_cyl":      {"slope_threshold": 1.20, "min_consecutive": 3, "min_points": 15},
    "scav_cyl":     {"slope_threshold": 0.80, "min_consecutive": 3, "min_points": 15},
    "lo_main_press":{"slope_threshold": 0.01, "min_consecutive": 4, "min_points": 20},
    "cfw_in_temp":  {"slope_threshold": 0.10, "min_consecutive": 4, "min_points": 20},
    "fo_in_press":  {"slope_threshold": 0.10, "min_consecutive": 4, "min_points": 20},
}

# ── Default thresholds ──────────────────────────────────────────────────
DEFAULT_THRESHOLDS = {
    "z_thresh":           3.09,
    "rpm_stable_min":     95,
    "rpm_working_min":    80,
    "rpm_change_max":     5,
    "min_consecutive":    3,
    "min_duration_min":   10,
    "low_speed_threshold":4.0,
    "exhaust_dev_z":      4.0,
    "gradual_window":     300,
    "poly_degree_exh":    3,
    "poly_degree_other":  2,
    "sample_interval_min":2.0,
}

# ── Baseline modeling constants ─────────────────────────────────────────
# 各传感器组缸间偏差的物理下限（std 过小则钳制，防止 z-score 爆炸）
MIN_STD_BY_GROUP = {
    "exhaust_temp":    3.0,
    "scavenge_temp":   2.0,
    "cfw_outlet":     2.0,
    "piston_lo":      2.0,
}

# 需要行均值系统级检测的传感器组
ROW_MEAN_GROUPS = ["exhaust_temp", "scavenge_temp", "cfw_outlet", "piston_lo"]

# 行均值残差的物理下限（baseline.py 使用）
ROW_MEAN_MIN_STD = {
    "exhaust_temp":   3.0,
    "scavenge_temp":  1.0,
    "cfw_outlet":    0.5,
    "piston_lo":     0.5,
}

EXHAUST_CYL_SENSOR_GROUPS = ["exhaust_temp", "cfw_outlet", "piston_lo", "scavenge_temp"]

# ── RPM Zone Partitioning ──────────────────────────────────────────────
# 每个 RPM 区间独立建基线，过渡/机动区间阈值放大
RPM_ZONES = [
    # (zone_id, rpm_lo, rpm_hi, z_mult, description)
    ("cruise",     93,  999, 1.0,  "稳态巡航"),
    ("transition", 78,   93, 1.2,  "过渡工况"),
    ("maneuver",    5,   78, 2.5,  "机动工况"),
]

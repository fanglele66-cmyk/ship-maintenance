"""
船舶主机异常检测 — JSON 数据加载器 V7.8.5
========================================
唯一职责：DC Key JSON → 干净的 DataFrame。
零 CSV / Parquet 逻辑。
"""

import json
import logging
from pathlib import Path

import pandas as pd

from .registry import EXTERNAL_TO_INTERNAL

logger = logging.getLogger(__name__)

# 不属于监测目标的列（元数据 / AIS / 环境 / 导出辅助列）
_METADATA_COLUMNS = frozenset({
    # time / id
    "timestamp", "create_time", "serial_number", "date",
    "rpm_bin", "load", "condition",
    # nav / operation
    "nav_phase", "nav_phase_major", "nav_phase_minor",
    "navigation_phase", "operation_status", "speed_category",
    # AIS geo / status
    "ais_latitude", "ais_longitude", "ais_speed",
    "ais_navigation_status", "ais_destination",
    "ais_lat", "ais_lon", "ais_sog", "ais_cog", "ais_heading",
    # spatial / query
    "water_area", "grid_precision",
    "query_lat_deg", "query_lon_deg", "context_count",
    # source metadata
    "source_date_time", "source_date_hour_string",
    # weather / environment
    "wind_speed_ms", "wind_direction_deg",
    "sea_wave_height_m", "sea_wave_period_s",
    "sea_swell_height_m", "sea_swell_period_s",
    "stream_speed_ms", "visibility_m",
    "hour_precipitation_mm", "pressure_hpa",
    "air_temp_c", "water_temp_c",
    "storm_value", "sea_state_grade", "grade_confidence", "beaufort_grade",
    "cooler_water_in_temp",
    # AIS environment (regression features, not monitor targets)
    "ais_air_temp", "ais_wind_speed", "ais_wind_dir",
    "ais_wave_height", "ais_pressure", "ais_visibility",
})


# ── JSON 解析 ──────────────────────────────────────────────────────────

def load_json(path: str | Path) -> pd.DataFrame:
    """解析 DC Key JSON → DataFrame，列名映射为 internal_name。

    格式：{serialNumber, data: [{asi, terminalTime, sensorList}]}
    sensorList 是嵌套数组：[{sensorList: [{key, value}]}]
    """
    path = Path(path)
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    rows: list[dict] = []
    serial_number = raw.get("serialNumber", "")

    for entry in raw.get("data", []):
        row: dict = {}

        # 时间戳
        row["timestamp"] = entry.get("terminalTime", "")

        # AIS 数据
        _ais_cols = {
            "lat": "ais_lat", "lon": "ais_lon",
            "sog": "ais_sog", "cog": "ais_cog", "hdg": "ais_heading",
        }
        for asi_key, col in _ais_cols.items():
            v = entry.get("asi", {}).get(asi_key, "")
            try:
                row[col] = float(v) if v != "" else None
            except (ValueError, TypeError):
                row[col] = None

        # 环境数据
        _env_cols = {
            "airTemp": "ais_air_temp", "windSpeed": "ais_wind_speed",
            "windDir": "ais_wind_dir", "waveHeight": "ais_wave_height",
            "pressure": "ais_pressure", "visibility": "ais_visibility",
        }
        for env_key, col in _env_cols.items():
            v = entry.get("environment", {}).get(env_key, "")
            try:
                row[col] = float(v) if v != "" else None
            except (ValueError, TypeError):
                row[col] = None

        # 传感器数据 — 展平 sensorList
        for wrapper in entry.get("sensorList", []):
            for sensor in wrapper.get("sensorList", []):
                key = sensor.get("key", "")
                value = sensor.get("value", "")
                # 映射 DC key → internal_name，未知 key 保留原值
                col = EXTERNAL_TO_INTERNAL.get(key, key)
                try:
                    row[col] = float(value) if value != "" else None
                except (ValueError, TypeError):
                    row[col] = None

        if serial_number:
            row["serial_number"] = serial_number
        rows.append(row)

    df = pd.DataFrame(rows)
    logger.info("load_json: %d rows, %d columns", len(df), len(df.columns))
    return df


# ── 公开 API ──────────────────────────────────────────────────────────

def load_data(path: str | Path) -> pd.DataFrame:
    """加载 JSON 数据，解析时间戳并排序。

    V7.0 唯一的数据加载入口。只接受 .json 文件。
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Data file not found: {path}")
    if path.suffix != ".json":
        raise ValueError(
            f"V7.0 loader accepts JSON only; got '{path.suffix}'. "
            "Convert CSV/Parquet before loading."
        )

    df = load_json(path)
    if len(df) == 0:
        logger.warning("load_data: empty dataset from %s", path)
        return df

    # 时间列处理
    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
        df = df.sort_values("timestamp").reset_index(drop=True)
    elif "create_time" in df.columns:
        df["timestamp"] = pd.to_datetime(df["create_time"], errors="coerce")
        df = df.sort_values("timestamp").reset_index(drop=True)
    else:
        logger.warning("load_data: no timestamp column in %s", path.name)

    logger.info("load_data: %d rows, columns=%d", len(df), len(df.columns))
    return df


def get_monitor_params(df: pd.DataFrame) -> list[str]:
    """返回可监测的数值传感器列名（排除元数据/AIS/环境列）。"""
    return [
        c for c in df.columns
        if c not in _METADATA_COLUMNS
        and pd.api.types.is_numeric_dtype(df[c])
    ]


def auto_detect_groups(df: pd.DataFrame) -> dict[str, list[str]]:
    """检测 DataFrame 中存在哪些传感器组（≥2 个成员列）。"""
    from .config import SENSOR_GROUPS
    detected: dict[str, list[str]] = {}
    all_cols = set(df.columns)
    for group_name, sensors in SENSOR_GROUPS.items():
        existing = [s for s in sensors if s in all_cols]
        if len(existing) >= 2:
            detected[group_name] = existing
    return detected

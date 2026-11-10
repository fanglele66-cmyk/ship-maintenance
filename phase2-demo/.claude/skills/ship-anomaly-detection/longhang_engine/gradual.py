"""
船舶主机异常检测 — 渐变故障检测 V7.8.5
=====================================
多分辨率窗口斜率法检测传感器的缓慢漂移。

两种模式：
- GradualDetectorState — 流式部署（30min 窗口）
- detect_gradual_batch — 批处理（一次扫完数据）

⚠️ 状态：待集成。当前 detect_all() 未调用此模块。
    集成前需要确定：(1) 渐变事件如何与 spike 事件合并；
    (2) 流式模式下 GradualDetectorState 的生命周期管理。
"""

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from .config import GRADUAL_SENSORS, INHERENT_BIAS_TABLE, DEFAULT_THRESHOLDS
from .loader import load_data, get_monitor_params
from .types import Event, Level, Channel

logger = logging.getLogger(__name__)


# ── 多分辨率斜率计算 ──────────────────────────────────────────────────

_MULTIRES_WINDOWS = [5, 20, 60, 300]


def _compute_multires_slopes(series: pd.Series, sample_interval_sec: float = 12.0) -> dict:
    """多分辨率线性回归斜率。返回 {win_size: slope_degC_per_hour}。"""
    slopes: dict = {}
    vals = series.dropna().values
    n = len(vals)
    for win in _MULTIRES_WINDOWS:
        if n < win or n < 3:
            continue
        seg = vals[-win:] if win < n else vals
        x = np.arange(len(seg)).reshape(-1, 1)
        try:
            reg = LinearRegression().fit(x, seg)
            slope = float(reg.coef_[0]) * 3600 / sample_interval_sec  # convert to °C/h
            slopes[str(win)] = round(slope, 4)
        except ValueError:
            continue
    return slopes


def _find_sensors(df: pd.DataFrame, sensor_prefix: str) -> list[str]:
    """找到匹配传感器前缀的列名（精确匹配或前缀+数字）。"""
    matched = []
    for c in df.columns:
        if c == sensor_prefix:
            matched.append(c)
        elif c.startswith(sensor_prefix):
            suffix = c[len(sensor_prefix):].lstrip("_").lstrip("cyl")
            if suffix.isdigit():
                matched.append(c)
    return matched


# ── 有状态流式检测器 ──────────────────────────────────────────────────

class GradualDetectorState:
    """渐变检测器有状态对象 — 适配 30min 滑动窗口部署。

    用法:
        state = GradualDetectorState()
        result = state.process_window(window_df)  # 每30min调用
        # 或: result = state.process_annotated(dev_dict)
        state.save_state(path)
        state = GradualDetectorState.load_state(path)
    """

    def __init__(self, max_history: int = 20, sample_interval_sec: float = 12.0):
        self.max_history = max_history
        self.sample_interval_sec = sample_interval_sec
        self._cph_factor = 3600.0 / sample_interval_sec
        self.slope_history: dict[str, list[tuple[float, str]]] = {}
        self.active_alerts: dict[str, dict] = {}
        self.window_count = 0
        self.last_window_ts: Optional[str] = None

    def _compute_deviation(self, df: pd.DataFrame) -> dict[str, pd.Series]:
        """内部标注：RPM 过滤 → 缸间偏差计算。"""
        df_f = df[df["rpm"] > 95].copy() if "rpm" in df.columns else df.copy()
        if len(df_f) < 3:
            return {}

        dev_dict: dict = {}
        for sensor_prefix in GRADUAL_SENSORS:
            cols = _find_sensors(df_f, sensor_prefix)
            if not cols:
                continue
            cyl_mean = df_f[cols].mean(axis=1)
            for col in cols:
                bias = INHERENT_BIAS_TABLE.get(col, 0)
                dev_dict[col] = df_f[col] - cyl_mean - bias
        return dev_dict

    def process_window(self, window_df: pd.DataFrame,
                       timestamp: Optional[str] = None) -> dict:
        """处理一个1h滑动窗口（原始数据，内部标注）。"""
        ts = timestamp or datetime.now(timezone.utc).isoformat()
        dev_dict = self._compute_deviation(window_df)
        return self.process_annotated(dev_dict, ts)

    def process_annotated(self, dev_dict: dict[str, pd.Series],
                          timestamp: Optional[str] = None) -> dict:
        """处理已标注的缸间偏差数据。"""
        ts = timestamp or datetime.now(timezone.utc).isoformat()
        self.window_count += 1
        self.last_window_ts = ts

        slope_report: dict = {}
        new_alerts: list[dict] = []

        for sensor_key, dev_series in dev_dict.items():
            # 查找对应的渐变参数
            cfg = None
            for prefix, c in GRADUAL_SENSORS.items():
                if sensor_key.startswith(prefix):
                    cfg = c
                    break
            if cfg is None:
                continue

            # 平滑
            try:
                dev_smooth = dev_series.rolling("10min", min_periods=3).mean()
            except (ValueError, TypeError):
                dev_smooth = dev_series.rolling(
                    min(50, max(3, len(dev_series) // 4)), min_periods=3).mean()
            valid = dev_smooth.dropna()
            if len(valid) < cfg["min_points"]:
                continue

            # 多分辨率斜率
            slopes = _compute_multires_slopes(valid)
            slope_report[sensor_key] = slopes

            # 取最大斜率绝对值
            max_abs_slope = max(
                (abs(v) for v in slopes.values() if v is not None), default=0.0
            )

            if max_abs_slope < cfg["slope_threshold"]:
                continue

            # 更新历史
            if sensor_key not in self.slope_history:
                self.slope_history[sensor_key] = []
            self.slope_history[sensor_key].append((max_abs_slope, ts))
            if len(self.slope_history[sensor_key]) > self.max_history:
                self.slope_history[sensor_key].pop(0)

            # 判断持续趋势
            history = self.slope_history[sensor_key]
            if len(history) >= cfg["min_consecutive"]:
                recent = [h[0] for h in history[-cfg["min_consecutive"]:]]
                if all(s >= cfg["slope_threshold"] for s in recent):
                    alert = {
                        "sensor": sensor_key,
                        "slope": max_abs_slope,
                        "threshold": cfg["slope_threshold"],
                        "consecutive_windows": len(recent),
                        "timestamp": ts,
                    }
                    self.active_alerts[sensor_key] = alert
                    new_alerts.append(alert)

        # 清理已恢复的告警
        all_tracked = set(s for s in dev_dict
                          if any(s.startswith(p) for p in GRADUAL_SENSORS))
        for sensor_key in list(self.active_alerts):
            if sensor_key not in all_tracked:
                self.active_alerts.pop(sensor_key, None)

        return {
            "alerts": new_alerts,
            "slope_report": slope_report,
            "active_alerts": dict(self.active_alerts),
        }

    def save_state(self, path: str | Path) -> None:
        """保存状态到 JSON。"""
        import json
        state = {
            "max_history": self.max_history,
            "sample_interval_sec": self.sample_interval_sec,
            "slope_history": self.slope_history,
            "active_alerts": self.active_alerts,
            "window_count": self.window_count,
            "last_window_ts": self.last_window_ts,
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False)
        logger.info("Gradual state saved to %s", path)

    @classmethod
    def load_state(cls, path: str | Path) -> "GradualDetectorState":
        import json
        with open(path, "r", encoding="utf-8") as f:
            state = json.load(f)
        obj = cls(max_history=state.get("max_history", 20),
                  sample_interval_sec=state.get("sample_interval_sec", 12.0))
        obj.slope_history = state.get("slope_history", {})
        obj.active_alerts = state.get("active_alerts", {})
        obj.window_count = state.get("window_count", 0)
        obj.last_window_ts = state.get("last_window_ts")
        logger.info("Gradual state loaded from %s", path)
        return obj


# ── 批处理渐变检测 ──────────────────────────────────────────────────

def detect_gradual_batch(data_path: str | Path) -> list[Event]:
    """一次性检测整个数据文件的渐变故障。

    按传感器前缀分组，对整个序列做分段线性回归。
    Returns: Event 列表（渐变故障特征显著时触发）。
    """
    df = load_data(data_path)
    rpm_col = "rpm" if "rpm" in df.columns else None
    events: list[Event] = []

    for sensor_prefix, cfg in GRADUAL_SENSORS.items():
        cols = _find_sensors(df, sensor_prefix)
        if not cols:
            continue
        for col in cols:
            if col not in df.columns:
                continue
            if rpm_col and (df[rpm_col] < 95).all():
                continue

            series = df[col]
            # RPM 过滤
            if rpm_col:
                mask = df[rpm_col] > 95
                series = series[mask]

            valid = series.dropna()
            if len(valid) < cfg["min_points"]:
                continue

            # 滚动平滑
            smooth = valid.rolling(min(50, len(valid) // 4), min_periods=3).mean()
            smooth = smooth.dropna()
            if len(smooth) < cfg["min_points"]:
                continue

            # 分段线性回归：分割为 cfg[min_points] 长的段，计算每段斜率
            seg_size = cfg["min_points"]
            slopes: list[float] = []
            for i in range(0, len(smooth) - seg_size + 1, seg_size // 2):
                seg = smooth.iloc[i:i + seg_size]
                if len(seg) < seg_size // 2:
                    continue
                x = np.arange(len(seg)).reshape(-1, 1)
                try:
                    reg = LinearRegression().fit(x, seg.values)
                    slope_per_hour = float(reg.coef_[0]) * 3600 / 12.0  # per-sample → °C/h
                    slopes.append(slope_per_hour)
                except ValueError:
                    continue

            if not slopes:
                continue

            # 检查是否连续 seg_size 个段斜率持续超阈值
            slope_th = cfg["slope_threshold"]
            consecutive = 0
            for s in slopes:
                if abs(s) >= slope_th:
                    consecutive += 1
                    if consecutive >= cfg["min_consecutive"]:
                        events.append(Event(
                            id="", level=Level.COMODAL,
                            channel=Channel.ABS_AR,
                            type="gradual",
                            sensors=[col],
                            groups=[],
                            time_start="",
                            time_end="",
                            duration_min=0.0,
                            max_z=round(float(np.mean(slopes)), 4),
                            severity=round(float(np.max(np.abs(slopes))), 4),
                            confirmed=False,
                            low_confidence=True,
                            low_confidence_reason="gradual_drift",
                        ))
                        break
                else:
                    consecutive = 0

    return events

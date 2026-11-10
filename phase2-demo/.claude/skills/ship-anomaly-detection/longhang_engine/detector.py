"""
船舶主机异常检测引擎 V8.1
================================
11通道（4统计 + 6DL + 1停机物理）按 RPM 自动路由 + 跨通道交叉验证 + 域边界软重叠。
每个通道函数输出统一为 Event 列表。

V8.1: 工况分段(segment_by_regime) + 逐段独立检测 + V8.0跨通道证据聚合评分
"""

import logging
from collections import Counter
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import itertools

import pandas as pd

from .baseline import _compute_residual_z
from .config import (
    BASE_DIR,
    DEFAULT_THRESHOLDS, GROUP_Z_THRESH, SENSITIVITY_MAP,
    EXHAUST_CYL_SENSOR_GROUPS, ROW_MEAN_GROUPS,
)
from .loader import get_monitor_params
from .registry import find_cyl_sensors, get_display
from .types import Event, Level, Channel, ChannelStatus

logger = logging.getLogger(__name__)
IQR_CYLINDER_SUPPORT_BONUS_CAP = 0.10
IQR_CYLINDER_SUPPORT_SOFT_CAP = 0.04
IQR_CYLINDER_SUPPORT_SOFT_THRESHOLD = 3
IQR_CYLINDER_SUPPORT_FULL_THRESHOLD = 8
IQR_SYSTEM_SUPPORT_BONUS_CAP = 0.06
IQR_SYSTEM_SUPPORT_SOFT_CAP = 0.03
IQR_SYSTEM_SUPPORT_SOFT_THRESHOLD = 2
IQR_SYSTEM_SUPPORT_FULL_THRESHOLD = 5
IQR_CONFIRM_MARGIN = 1e-4
IQR_OUTPUT_DETAIL_LIMIT = 5
# Registry groups for non-cylinder system sensors. Per-cylinder groups keep
# using same-cylinder evidence aggregation instead of this system-level path.
IQR_SYSTEM_GROUPS = {
    "air_cooler",
    "bearing_temp",
    "cfw_inlet",
    "control_air",
    "damper_lo",
    "fuel_oil",
    "lo_main",
    "scavenge_press",
    "servo_oil",
    "turbo_lo",
}

# 模块级计数器，detect_all() 每次调用时重置。detect_channel* 函数通过 next() 消费。
_event_counter = itertools.count(1)

# ── 事件提取（通用）─────────────────────────────────────────────────────

def _severity_for_z(max_z: float, duration_min: float) -> Level:
    if max_z >= 5.0 and duration_min >= 20:
        return Level.CONFIRMED
    if max_z >= 4.0:
        return Level.HIGH
    if max_z >= 3.0:
        return Level.COMODAL
    return Level.LOW


def extract_events(
    z_series: pd.Series,
    timestamps: pd.Series | pd.DatetimeIndex,
    threshold: float,
    min_consecutive: int = 3,
    min_duration_min: float = 10,
    group_gap_min: float = 5.0,
) -> list[dict]:
    """从 |z-score| 时间序列中提取事件。

    找连续超阈值片段 → 合并间隔 < gap 的片段 → 过滤太短/太短的片段。
    Returns: [{time_start, time_end, duration_min, max_z, severity, n_points}]
    """
    mask = z_series > threshold
    mask = mask.reindex(timestamps.index, fill_value=False)

    # 标记连续段
    groups = (mask != mask.shift(1)).cumsum()
    events_raw = []
    for _, idx in groups[mask].groupby(groups[mask]):
        idx = idx.index  # original DataFrame row labels
        if len(idx) < min_consecutive:
            continue
        t_start = timestamps.loc[idx[0]]
        t_end = timestamps.loc[idx[-1]]
        duration_min = (t_end - t_start).total_seconds() / 60.0
        if duration_min < min_duration_min:
            continue
        max_z = float(z_series.loc[idx].max())
        events_raw.append({
            "time_start": str(t_start),
            "time_end": str(t_end),
            "duration_min": round(duration_min, 1),
            "max_z": round(max_z, 2),
            "n_points": len(idx),
            "_start_dt": t_start,
            "_end_dt": t_end,
        })

    if not events_raw:
        return []

    # 合并间隔 < group_gap_min 的相邻事件
    merged = [events_raw[0]]
    for ev in events_raw[1:]:
        gap = (ev["_start_dt"] - merged[-1]["_end_dt"]).total_seconds() / 60.0
        if gap < group_gap_min:
            merged[-1]["time_end"] = ev["time_end"]
            merged[-1]["_end_dt"] = ev["_end_dt"]
            merged[-1]["duration_min"] = round(
                (ev["_end_dt"] - merged[-1]["_start_dt"]).total_seconds() / 60.0, 1)
            merged[-1]["max_z"] = max(merged[-1]["max_z"], ev["max_z"])
            merged[-1]["n_points"] += ev["n_points"]
        else:
            merged.append(ev)

    # 计算 severity，清理临时字段
    for ev in merged:
        ev["severity"] = _severity_for_z(ev["max_z"], ev["duration_min"])
        del ev["_start_dt"]
        del ev["_end_dt"]

    return merged


# ── 通道1：缸间一致性 ──────────────────────────────────────────────────

def detect_channel1(
    df: pd.DataFrame, baseline: dict, config: dict,
) -> list[Event]:
    """缸间一致性检测：同组各缸减组均值后的残差 z-score。

    V8.1: 只接收已过滤的纯巡航数据（由 detect_all 通过 segment_by_regime 提供）。
    """
    events: list[Event] = []
    cfg = dict(DEFAULT_THRESHOLDS)
    cfg.update(config)

    cruise_df = df  # 调用方已过滤为纯巡航段

    if len(cruise_df) < cfg["min_consecutive"]:
        return events

    for sensor, model in baseline.get("ch1", {}).items():
        group_name = model.get("group", "")
        group_sensors = model.get("group_sensors", [sensor])
        available = [s for s in group_sensors if s in cruise_df.columns]
        if len(available) < 2 or sensor not in cruise_df.columns:
            continue

        residuals = {}
        for s in group_sensors:
            if s not in cruise_df.columns:
                continue
            z_s = _compute_residual_z(
                cruise_df, s, model.get("reg"), model.get("poly"),
                model["std"], model["mean"], model.get("feature_cols", ["rpm"]),
            )
            if len(z_s) > 0:
                residuals[s] = z_s

        if len(residuals) < 2:
            continue

        res_df = pd.DataFrame(residuals)
        common_idx = res_df.dropna().index
        if len(common_idx) < 50:
            continue
        row_mean = res_df.loc[common_idx].mean(axis=1)
        deviation = res_df.loc[common_idx].sub(row_mean, axis=0)

        if sensor not in deviation.columns:
            continue
        dev_z = deviation[sensor].abs()
        thresh = GROUP_Z_THRESH.get(group_name, cfg["z_thresh"])
        raw_events = extract_events(
            dev_z, cruise_df["timestamp"],
            threshold=thresh,
            min_consecutive=cfg["min_consecutive"],
            min_duration_min=cfg["min_duration_min"],
        )
        for re in raw_events:
            events.append(Event(
                id=f"evt_{next(_event_counter)}", level=re["severity"],
                channel=Channel.INTER_CYL,
                type="spike",
                sensors=[sensor],
                groups=[group_name],
                time_start=re["time_start"],
                time_end=re["time_end"],
                duration_min=re["duration_min"],
                max_z=re["max_z"],
                severity=re["max_z"],
                confirmed=re["severity"] == Level.CONFIRMED,
            ))

    return events


# ── 通道2：绝对值自回归 ────────────────────────────────────────────────

def detect_channel2(
    df: pd.DataFrame, baseline: dict, config: dict,
) -> list[Event]:
    """绝对值自回归检测：传感器实际值 vs 基线回归预测值 的残差 z-score。

    V8.1: 只接收已过滤的纯巡航数据（由 detect_all 通过 segment_by_regime 提供）。
    V7.8.5: D1 热平衡门控 — RPM首次≥90后30min内的事件强制降级（热态基线不适用冷启动数据）。
    注意：V8.1 中 detect_all 已排除 warmup 段（seg.type != "cruise"），此处的 warmup
    降级逻辑理论上不会触发。保留为防御性代码（防止 detect_channel2 被直接调用时缺少保护）。
    """
    WARMUP_MINUTES = 30  # 热平衡建立所需时间

    events: list[Event] = []
    cfg = dict(DEFAULT_THRESHOLDS)
    cfg.update(config)

    cruise_df = df  # 调用方已过滤为纯巡航段

    if len(cruise_df) < cfg["min_consecutive"]:
        return events

    # D1: 找到 RPM 首次≥90的时间点，计算热平衡截止时间
    warmup_cutoff = None
    if "timestamp" in cruise_df.columns and len(cruise_df) > 0:
        first_cruise_time = pd.Timestamp(cruise_df["timestamp"].iloc[0])
        warmup_cutoff = first_cruise_time + pd.Timedelta(minutes=WARMUP_MINUTES)

    for sensor, model in baseline.get("ch2", {}).items():
        if sensor not in cruise_df.columns:
            continue
        z_s = _compute_residual_z(
            cruise_df, sensor,
            model.get("reg"), model.get("poly"),
            model["std"], model["mean"],
            model.get("feature_cols", ["rpm"]),
        )
        if len(z_s) < cfg["min_consecutive"]:
            continue

        group_name = model.get("group", "")
        thresh = GROUP_Z_THRESH.get(group_name, cfg["z_thresh"])

        raw_events = extract_events(
            z_s, cruise_df["timestamp"],
            threshold=thresh,
            min_consecutive=cfg["min_consecutive"],
            min_duration_min=cfg["min_duration_min"],
        )
        for re in raw_events:
            is_warmup = False
            if warmup_cutoff is not None:
                ev_start = pd.Timestamp(re["time_start"])
                if ev_start < warmup_cutoff:
                    is_warmup = True

            level = re["severity"]
            confirmed = (level == Level.CONFIRMED)
            low_confidence = False
            low_confidence_reason = ""

            # D1: 热平衡门控 — warmup区间内强制降级
            if is_warmup and confirmed:
                level = Level.HIGH
                confirmed = False
                low_confidence = True
                low_confidence_reason = (
                    f"thermal_warmup: 冷启动后{WARMUP_MINUTES}min内热平衡未建立，"
                    "ch2绝对值基线(热态稳态)不适用"
                )

            events.append(Event(
                id=f"evt_{next(_event_counter)}", level=level,
                channel=Channel.ABS_AR,
                type="spike",
                sensors=[sensor],
                groups=[group_name] if group_name else [],
                time_start=re["time_start"],
                time_end=re["time_end"],
                duration_min=re["duration_min"],
                max_z=re["max_z"],
                severity=re["max_z"],
                confirmed=confirmed,
                low_confidence=low_confidence,
                low_confidence_reason=low_confidence_reason,
            ))

    return events


# ── 通道3：温差自回归 ─────────────────────────────────────────────────

def detect_channel3(
    df: pd.DataFrame, baseline: dict, config: dict,
) -> list[Event]:
    """温差自回归检测：outlet - inlet 温差 vs 基线回归预测值的残差 z-score。

    V8.1: 只接收已过滤的纯巡航数据（由 detect_all 通过 segment_by_regime 提供）。
    """
    events: list[Event] = []
    cfg = dict(DEFAULT_THRESHOLDS)
    cfg.update(config)

    cruise_df = df  # 调用方已过滤为纯巡航段

    if len(cruise_df) < cfg["min_consecutive"]:
        return events

    for dt_name, model in baseline.get("ch3", {}).items():
        outlet = model.get("outlet_col")
        inlet = model.get("inlet_col")
        if outlet not in cruise_df.columns or inlet not in cruise_df.columns:
            continue
        group_name = model.get("group", "")
        df2 = cruise_df.copy()
        df2[f"_dt_{dt_name}"] = df2[outlet] - df2[inlet]
        z_s = _compute_residual_z(
            df2, f"_dt_{dt_name}",
            model.get("reg"), model.get("poly"),
            model["std"], model["mean"],
            model.get("feature_cols", ["rpm"]),
        )
        if len(z_s) < cfg["min_consecutive"]:
            continue

        thresh = GROUP_Z_THRESH.get(group_name, cfg["z_thresh"])
        raw_events = extract_events(
            z_s, cruise_df["timestamp"],
            threshold=thresh,
            min_consecutive=cfg["min_consecutive"],
            min_duration_min=cfg["min_duration_min"],
        )
        for re in raw_events:
            events.append(Event(
                id=f"evt_{next(_event_counter)}", level=re["severity"],
                channel=Channel.DT_AR,
                type="spike",
                sensors=[outlet, inlet],
                groups=[group_name] if group_name else [],
                time_start=re["time_start"],
                time_end=re["time_end"],
                duration_min=re["duration_min"],
                max_z=re["max_z"],
                severity=re["max_z"],
                confirmed=re["severity"] == Level.CONFIRMED,
            ))

    return events


# ── 低速工况检测 ──────────────────────────────────────────────────────

def detect_mid_inter_cyl(
    df: pd.DataFrame, config: dict,
) -> list[Event]:
    """中低速(RPM 25~98, 软重叠)多个传感器组缸间一致性检测，原始12s采样。

    覆盖 ch1 的盲区：ch1(RPM>=90)软重叠下仍不覆盖的中低速工况。
    对每个传感器组（排温/扫气温/活塞冷却油/缸套冷却水）检查各缸偏差。

    Args:
        df: 原始12s采样DataFrame（含各传感器列和rpm列）
        config: 灵敏度配置

    Returns:
        事件列表
    """
    events: list[Event] = []
    cfg = dict(DEFAULT_THRESHOLDS)
    cfg.update(config)

    # 传感器组配置：(列名前缀, 组名, High阈值°C, Confirmed阈值°C, 最小值过滤)
    sensor_groups = [
        ("exh_cyl",      "exhaust_temp",   50, 100, 10),
        ("scav_cyl",     "scavenge_temp",  10,  20, 10),
        ("piston_lo_cyl","piston_lo",       5,  10,  5),
        ("cfw_out_cyl",  "cfw_outlet",      5,  10, 10),
    ]

    # RPM 25~98：软重叠。下行 25 与低RPM段重叠，上行 98 与 ch1(≥90) 在 90-98 重叠
    mask = (df["rpm"] >= 25) & (df["rpm"] < 98)
    if mask.sum() < 10:
        return events

    sub = df[mask].copy()
    min_consec = max(5, cfg["min_consecutive"])
    min_dur = max(1, cfg["min_duration_min"])

    for prefix, group_name, thresh_high, thresh_confirmed, min_valid in sensor_groups:
        cyl_cols = [f"{prefix}{i}" for i in range(1, 7)]
        available = [c for c in cyl_cols if c in sub.columns]
        if len(available) < 6:
            continue  # 该组传感器列不全，跳过

        # 数值转换 + 过滤无效值
        sub_g = sub[cyl_cols + ["timestamp"]].copy()
        for c in cyl_cols:
            sub_g[c] = pd.to_numeric(sub_g[c], errors="coerce")
        sub_g = sub_g.dropna(subset=cyl_cols)
        # 过滤低于有效范围的读数（传感器失效或停机冷却）
        for c in cyl_cols:
            sub_g = sub_g[sub_g[c] > min_valid]
        if len(sub_g) < min_consec:
            continue

        # 计算各缸对该组其他缸均值的偏差
        for ci in range(1, 7):
            col = f"{prefix}{ci}"
            others = [f"{prefix}{j}" for j in range(1, 7) if j != ci]
            if not all(o in sub_g.columns for o in others):
                continue
            # 中位数比均值更鲁棒：单个极端缸不会拉偏其他缸的偏差计算
            median_others = sub_g[others].median(axis=1)
            dev = (sub_g[col] - median_others).abs()

            raw_events = extract_events(
                dev, sub_g["timestamp"],
                threshold=thresh_high,
                min_consecutive=min_consec,
                min_duration_min=min_dur,
            )
            for re in raw_events:
                max_dev = re["max_z"]
                if max_dev > thresh_confirmed and re["duration_min"] >= 10:
                    level = Level.CONFIRMED
                elif max_dev > thresh_high and re["duration_min"] >= 5:
                    level = Level.HIGH
                elif max_dev > thresh_high:
                    level = Level.COMODAL
                else:
                    level = Level.LOW
                events.append(Event(
                    id=f"evt_{next(_event_counter)}", level=level,
                    channel=Channel.MID_INTER_CYL,
                    type="spike",
                    sensors=[col],
                    groups=[group_name],
                    time_start=re["time_start"],
                    time_end=re["time_end"],
                    duration_min=re["duration_min"],
                    max_z=round(max_dev, 1),
                    severity=round(max_dev, 1),
                    confirmed=level == Level.CONFIRMED,
                ))

    return events


# ── 停机物理规则 ─────────────────────────────────────────────────────────

def _detect_stopped_segment(
    df: pd.DataFrame, config: dict,
) -> list[Event]:
    """对单个连续停机段运行物理规则。

    三条规则：
    1. 轴承温升（bearing_rise）：轴承温度 >0.5°C/12s 上升 → 异常
    2. 停机排温异常（exhaust_stop）：排温中位数 <100°C 时
       某缸高于中位数 >30°C 且持续 30min+ → 该缸未正常冷却
    3. 停机加热（stop_heat）：排温/活塞油/缸套水 >2°C/60s 上升 → 异常升温
    """
    events: list[Event] = []
    cfg = dict(DEFAULT_THRESHOLDS)
    cfg.update(config)

    # RPM < 5 为停机状态
    mask = df["rpm"].abs() < 5
    if mask.sum() < 10:
        return events

    sub = df[mask].copy().reset_index(drop=True)
    min_consec = cfg.get("min_consecutive", 3)
    min_dur = cfg.get("min_duration_min", 5)

    def _make_event(sensors, groups, level, time_start, time_end,
                    max_z, duration_min, confirmed=False):
        return Event(
            id=f"evt_{next(_event_counter)}", level=level,
            channel=Channel.STOPPED,
            type="spike" if level != Level.LOW else "drift",
            sensors=[sensors] if isinstance(sensors, str) else sensors,
            groups=[groups] if isinstance(groups, str) else groups,
            time_start=time_start,
            time_end=time_end,
            duration_min=duration_min,
            max_z=round(max_z, 1),
            severity=round(max_z, 1),
            confirmed=confirmed,
        )

    # ── Rule 1: 轴承温升 ──
    bearing_cols = ["shaft_aft_bearing_temp", "shaft_mid_bearing_temp"]
    avail_bearings = [c for c in bearing_cols if c in sub.columns]
    for col in avail_bearings:
        sub[col] = pd.to_numeric(sub[col], errors="coerce")
    for col in avail_bearings:
        sub_g = sub[["timestamp", col]].dropna()
        if len(sub_g) < min_consec:
            continue
        delta = sub_g[col].diff()
        # V7.8.5 fix: 传原始 delta 值（与 Rule 2/3 一致），而非 boolean→float
        raw = extract_events(
            delta, sub_g["timestamp"],
            threshold=0.5,
            min_consecutive=3,
            min_duration_min=1,
        )
        for re in raw:
            ts_start = pd.Timestamp(re["time_start"])
            ts_end = pd.Timestamp(re["time_end"])
            mask = (delta > 0.5) & (sub_g["timestamp"] >= ts_start) & \
                                     (sub_g["timestamp"] <= ts_end)
            max_rise = delta.iloc[mask].max()
            confirmed = re["duration_min"] >= 5 and max_rise > 2.0
            level = Level.CONFIRMED if confirmed else Level.HIGH
            events.append(_make_event(
                col, "bearing_temp", level,
                re["time_start"], re["time_end"],
                max_z=max_rise, duration_min=re["duration_min"],
                confirmed=confirmed,
            ))

    # ── Rule 2: 停机排温异常（某缸未随其他缸冷却） ──
    exh_cols = [f"exh_cyl{i}" for i in range(1, 7)]
    avail_exh = [c for c in exh_cols if c in sub.columns]
    if len(avail_exh) >= 6:
        for c in avail_exh:
            sub[c] = pd.to_numeric(sub[c], errors="coerce")

        # 当排温中位数 <100°C（停机足够久，已冷却）
        sub["exh_median"] = sub[avail_exh].median(axis=1)
        cooled_mask = sub["exh_median"] < 100
        if cooled_mask.sum() >= 10:
            sub_cooled = sub[cooled_mask].copy().reset_index(drop=True)

            for ci in range(1, 7):
                col = f"exh_cyl{ci}"
                dev = (sub_cooled[col] - sub_cooled["exh_median"]).abs()
                # 某缸高于中位数 >30°C → 异常（该缸未正常冷却）
                # V7.8.5 fix: 传入原始偏差值(threshold=30)而非布尔转float
                raw = extract_events(
                    dev, sub_cooled["timestamp"],
                    threshold=30,
                    min_consecutive=5,
                    min_duration_min=min_dur,
                )
                for re in raw:
                    max_dev = dev[(dev > 30) & (sub_cooled["timestamp"] >= re["time_start"]) &
                                    (sub_cooled["timestamp"] <= re["time_end"])].max()
                    confirmed = re["duration_min"] >= 30 and max_dev > 50
                    level = Level.CONFIRMED if confirmed else Level.HIGH
                    events.append(_make_event(
                        col, "exhaust_temp", level,
                        re["time_start"], re["time_end"],
                        max_z=max_dev, duration_min=re["duration_min"],
                        confirmed=confirmed,
                    ))

    # ── Rule 3: 停机加热（应冷却但反而升温） ──
    anti_cool_cols = []
    anti_cool_cols.extend([f"exh_cyl{i}" for i in range(1, 7) if f"exh_cyl{i}" in sub.columns])
    anti_cool_cols.extend([f"cfw_out_cyl{i}" for i in range(1, 7) if f"cfw_out_cyl{i}" in sub.columns])
    anti_cool_cols.extend([f"piston_lo_cyl{i}" for i in range(1, 5) if f"piston_lo_cyl{i}" in sub.columns])

    for col in anti_cool_cols:
        sub[col] = pd.to_numeric(sub[col], errors="coerce")

    for col in anti_cool_cols:
        sub_g = sub[["timestamp", col]].dropna()
        if len(sub_g) < 10:
            continue
        # 滑动窗口：5 个样本（~1 min）的温度变化
        sub_g["delta_5"] = sub_g[col].rolling(5, min_periods=3).apply(
            lambda x: x.iloc[-1] - x.iloc[0] if len(x) >= 3 else 0.0
        )
        # 正向升温 >2°C / 5 样本 → 应该在冷却却反而加热
        # V7.8.5 fix: 传入原始温升值(threshold=2.0)而非布尔转float
        raw = extract_events(
            sub_g["delta_5"], sub_g["timestamp"],
            threshold=2.0,
            min_consecutive=3,
            min_duration_min=1,
        )
        group = "cfw_outlet" if col.startswith("cfw_out") else (
            "piston_lo" if col.startswith("piston_lo") else "exhaust_temp"
        )
        for re in raw:
            ts_start = pd.Timestamp(re["time_start"])
            ts_end = pd.Timestamp(re["time_end"])
            max_delta = sub_g.loc[(sub_g["delta_5"] > 2.0) & (sub_g["timestamp"] >= ts_start) &
                                    (sub_g["timestamp"] <= ts_end), "delta_5"].max()
            confirmed = re["duration_min"] >= 5 and max_delta > 5.0
            level = Level.CONFIRMED if confirmed else Level.HIGH
            events.append(_make_event(
                col, group, level,
                re["time_start"], re["time_end"],
                max_z=max_delta, duration_min=re["duration_min"],
                confirmed=confirmed,
            ))

    return events


def detect_stopped(
    df: pd.DataFrame, config: dict,
) -> list[Event]:
    """按连续停机段独立运行物理规则，禁止跨停机段计算温升。"""
    stopped_mask = df["rpm"].abs() < 5
    stopped = df.loc[stopped_mask].copy()
    if len(stopped) < 10:
        return []

    index_break = stopped.index.to_series().diff().fillna(1).ne(1)
    if "timestamp" in stopped.columns:
        time_break = pd.to_datetime(stopped["timestamp"]).diff().dt.total_seconds().fillna(0).gt(120)
        index_break = index_break | time_break
    segment_ids = index_break.cumsum()

    events: list[Event] = []
    for _, segment in stopped.groupby(segment_ids):
        if len(segment) >= 10:
            events.extend(_detect_stopped_segment(segment, config))
    return events


# ── 事件合并 ──────────────────────────────────────────────────────────

def _events_overlap(a: Event, b: Event, gap_min: float = 20) -> bool:
    """两个事件是否重叠（时间交叠含 gap 缓冲 + 传感器交集）。

    V7.8.5 fix: gap 缓冲必须对不重叠事件生效，删除提前返回的死代码。
    """
    a_start = _parse_event_time(a.time_start)
    a_end = _parse_event_time(a.time_end)
    b_start = _parse_event_time(b.time_start)
    b_end = _parse_event_time(b.time_end)
    gap = pd.Timedelta(minutes=gap_min)
    if a_end + gap < b_start or b_end + gap < a_start:
        return False
    return bool(set(a.sensors) & set(b.sensors))


def _parse_event_time(value: str) -> datetime:
    """Parse detector timestamps consistently across legacy and ISO formats."""
    return pd.Timestamp(value).to_pydatetime()


def _is_iqr_event(ev: Event) -> bool:
    return ev.channel == Channel.IQR


def _event_time_bounds(a: Event, b: Event) -> tuple[str, str, float]:
    starts = [
        (_parse_event_time(a.time_start), a.time_start),
        (_parse_event_time(b.time_start), b.time_start),
    ]
    ends = [
        (_parse_event_time(a.time_end), a.time_end),
        (_parse_event_time(b.time_end), b.time_end),
    ]
    start_dt, start_text = min(starts, key=lambda item: item[0])
    end_dt, end_text = max(ends, key=lambda item: item[0])
    duration_min = round((end_dt - start_dt).total_seconds() / 60.0, 1)
    return start_text, end_text, duration_min


def _compress_iqr_events_for_output(
    iqr_events: list[Event],
    iqr_stats,
    detail_limit: int = IQR_OUTPUT_DETAIL_LIMIT,
) -> list[Event]:
    """Return one IQR support summary plus a few representative detail events."""
    if not iqr_events:
        return []

    details = _select_iqr_detail_events(iqr_events, detail_limit)
    summary = _make_iqr_summary_event(iqr_events, iqr_stats, len(details))
    return [summary, *details]


def _select_iqr_detail_events(
    iqr_events: list[Event],
    detail_limit: int,
) -> list[Event]:
    if detail_limit <= 0:
        return []

    ranked = sorted(
        iqr_events,
        key=lambda ev: (ev.severity, ev.max_z, ev.duration_min),
        reverse=True,
    )
    selected: list[Event] = []
    seen_sensors: set[str] = set()
    for ev in ranked:
        sensor = ev.sensors[0] if ev.sensors else ""
        if sensor and sensor in seen_sensors:
            continue
        selected.append(ev)
        if sensor:
            seen_sensors.add(sensor)
        if len(selected) >= detail_limit:
            break
    if len(selected) < detail_limit:
        for ev in ranked:
            if ev in selected:
                continue
            selected.append(ev)
            if len(selected) >= detail_limit:
                break

    output: list[Event] = []
    for rank, ev in enumerate(selected, 1):
        detail = replace(ev)
        detail.type = "iqr_detail_top"
        detail.confirmed = False
        detail.low_confidence = True
        detail.low_confidence_reason = (
            f"ch_iqr_detail_top: rank={rank}/{len(iqr_events)}; "
            f"{ev.low_confidence_reason}"
        )
        output.append(detail)
    return output


def _make_iqr_summary_event(
    iqr_events: list[Event],
    iqr_stats,
    detail_count: int,
) -> Event:
    starts = [(_parse_event_time(ev.time_start), ev.time_start) for ev in iqr_events]
    ends = [(_parse_event_time(ev.time_end), ev.time_end) for ev in iqr_events]
    start_dt, start_text = min(starts, key=lambda item: item[0])
    end_dt, end_text = max(ends, key=lambda item: item[0])
    duration_min = max(round((end_dt - start_dt).total_seconds() / 60.0, 1), 0.0)
    max_z = max((ev.max_z for ev in iqr_events), default=0.0)
    severity = max((ev.severity for ev in iqr_events), default=0.0)
    top_groups = _top_iqr_values((g for ev in iqr_events for g in ev.groups), limit=5)
    top_sensors = _top_iqr_values((s for ev in iqr_events for s in ev.sensors), limit=5)
    point_rate = float(getattr(iqr_stats, "point_rate", 0.0) or 0.0)
    anomaly_points = int(getattr(iqr_stats, "anomaly_points", 0) or 0)
    total_points = int(getattr(iqr_stats, "total_points", 0) or 0)

    return Event(
        id="",
        level=Level.COMODAL,
        channel=Channel.IQR,
        type="iqr_support_summary",
        sensors=["ch_iqr_summary"],
        groups=top_groups or ["iqr_summary"],
        time_start=start_text,
        time_end=end_text,
        duration_min=duration_min,
        max_z=round(max_z, 2),
        severity=round(severity, 3),
        confirmed=False,
        low_confidence=True,
        low_confidence_reason=(
            f"ch_iqr_summary: raw_events={len(iqr_events)} "
            f"output_details={detail_count} point_rate={point_rate:.2%} "
            f"anomaly_points={anomaly_points}/{total_points} "
            f"top_groups={','.join(top_groups)} "
            f"top_sensors={','.join(top_sensors)}"
        ),
    )


def _top_iqr_values(values, limit: int) -> list[str]:
    return [
        value
        for value, _ in Counter(v for v in values if v).most_common(limit)
    ]


def merge_events(events: list[Event], gap_min: float = 20) -> list[Event]:
    """合并不同通道中重叠的事件（选择 severity 最高的保留）。

    V7.8.4 修复:
    - max_z 只取赢家的值，禁止跨通道取 max（不同通道 z-score 量纲不同）
    - ch_low_speed 事件不参与跨通道合并（低速基线不稳，severity 量纲不可比，
      合并后会吞掉高置信度通道的 CONFIRMED 状态）
    """
    if not events:
        return []
    # ch_low_speed 不参与合并，直接保留
    no_merge = {Channel.LOW_SPEED}
    sortable = []
    passthrough = []
    for ev in events:
        if ev.channel in no_merge:
            passthrough.append(ev)
        else:
            sortable.append(ev)

    sorted_ev = sorted(sortable, key=lambda e: (_parse_event_time(e.time_start), -e.severity))
    merged: list[Event] = []
    for ev in sorted_ev:
        found = False
        for m in merged:
            if _events_overlap(ev, m, gap_min):
                if _is_iqr_event(ev) or _is_iqr_event(m):
                    continue
                # V7.8.5 fix: 始终合并传感器/组/时间边界
                m.sensors = list(set(m.sensors + ev.sensors))
                m.groups = list(set(m.groups + ev.groups))
                # 扩展时间范围
                m.time_start, m.time_end, m.duration_min = _event_time_bounds(m, ev)
                # 只有赢家才能覆盖 level/severity/confirmed
                if ev.severity > m.severity:
                    m.level = ev.level
                    m.severity = ev.severity
                    m.channel = ev.channel
                    m.type = ev.type
                    m.max_z = ev.max_z
                    m.confirmed = ev.confirmed
                    m.low_confidence = ev.low_confidence
                    m.low_confidence_reason = ev.low_confidence_reason
                found = True
                break
        if not found:
            merged.append(ev)
    merged.extend(passthrough)
    return sorted(merged, key=lambda e: (_parse_event_time(e.time_start), -e.severity))


# ── 跨通道交叉验证 ──────────────────────────────────────────────────

# 传感器组 → 列名前缀（用于抽取缸号）
_CYL_GROUPS = {
    "exhaust_temp":  "exh_cyl",
    "scavenge_temp": "scav_cyl",
    "piston_lo":     "piston_lo_cyl",
    "cfw_outlet":    "cfw_out_cyl",
}
# 缸号正则： exh_cyl2 → 2
import re as _re
_CYL_PATTERN = _re.compile(r"([a-z_]+?)(\d+)$")


def _extract_cylinders(sensors: list[str]) -> dict[str, set[int]]:
    """从传感器列表抽取各传感器组下的缸号集合。

    Return: {"exhaust_temp": {1, 2, 3}, "piston_lo": {2}, ...}
    """
    result: dict[str, set[int]] = {}
    for s in sensors:
        m = _CYL_PATTERN.search(s)
        if not m:
            continue
        prefix = m.group(1)
        cyl = int(m.group(2))
        # 反查组名
        for gname, gprefix in _CYL_GROUPS.items():
            if prefix == gprefix:
                result.setdefault(gname, set()).add(cyl)
                break
    return result



def _v8_cross_validate(
    events: list[Event],
    segments: list,
    df: pd.DataFrame,
    seg_type_map: dict | None = None,
    ts_col: pd.Series | None = None,
    iqr_support_events: list[Event] | None = None,
) -> list[Event]:
    """V8.0 跨通道评分流水线，替代 _cross_validate。

    流程: events → 保留旧规则(热平衡/低速/级联) → V8.0 归一化+聚合+评分 → 标记 confirmed

    输入输出与 _cross_validate 一致: list[Event] → list[Event]
    """
    if not events:
        return events

    # 计算 RPM 标准差
    rpm_cols = [c for c in df.columns if 'rpm' in c.lower()]
    rpm_std = 0.0
    if rpm_cols:
        valid_rpm = df[rpm_cols[0]].dropna()
        rpm_std = float(valid_rpm.std()) if len(valid_rpm) > 10 else 0.0

    # ── 保留旧规则的预处理（这些逻辑 V8.0 不改变） ──
    # 规则3: ch2_abs_ar 在 RPM 不稳段 (σ>15) 降级
    if rpm_std > 15:
        for ev in events:
            if ev.channel == Channel.ABS_AR and ev.confirmed:
                ev.confirmed = False
                ev.level = Level.HIGH
                ev.low_confidence_reason = (
                    f"unstable_rpm_baseline: σ_RPM={rpm_std:.1f}>15, abs_ar unreliable"
                )

    # 1. 热平衡 warmup 保护: 保留 ch2 warmup 区间降级
    #    (已由 detect_channel2 在产出时标记, 此处仅保护不被后续提升)
    # 2. ch_low_speed 不参与跨通道提升
    for ev in events:
        if ev.channel in {Channel.LOW_SPEED}:
            if ev.confirmed or ev.level == Level.CONFIRMED:
                ev.confirmed = False
                ev.level = Level.HIGH if ev.severity >= 3.0 else Level.COMODAL
                ev.low_confidence = True
                ev.low_confidence_reason = (
                    "low_speed_no_cross: 低速工况基线不稳, 不参与跨通道确认"
                )
        elif (
            ev.channel == Channel.STOPPED
            and not ev.confirmed
            and ev.duration_min < 5.0
        ):
            ev.low_confidence = True
            ev.low_confidence_reason = (
                f"stopped_short_thermal_transient: 停机物理High仅持续{ev.duration_min:.1f}min<5min"
            )

    # ── stopped 通道全局降级（保留 V7.8.5 逻辑 + 突出缸保留） ──
    # stopped 通道 ≥4 缸同时触发 → 全局降级非突出缸为 HIGH
    stopped_cyls = set()
    stopped_events = [(i, ev) for i, ev in enumerate(events) if ev.channel == Channel.STOPPED]
    from .utils import extract_all_cylinders
    for i, ev in stopped_events:
        stopped_cyls |= extract_all_cylinders(ev.sensors)
    if len(stopped_cyls) >= 4:
        # 找突出缸: severity 远高于中位数（3倍或 ≥15）
        cyl_sev: dict[int, float] = {}
        for i, ev in stopped_events:
            for c in extract_all_cylinders(ev.sensors):
                cyl_sev[c] = max(cyl_sev.get(c, 0.0), ev.severity)
        if cyl_sev:
            from .utils import median_of_values
            median_sev = median_of_values(cyl_sev)
            outlier_threshold = max(median_sev * 3, 15.0)
            outlier_cyls = {c for c, s in cyl_sev.items() if s >= outlier_threshold}
        else:
            outlier_cyls = set()

        for i, ev in stopped_events:
            # 突出缸保留 confirmed
            is_outlier = bool(outlier_cyls & extract_all_cylinders(ev.sensors))
            if is_outlier:
                continue  # 突出缸保留
            ev.low_confidence = True
            ev.low_confidence_reason = (
                f"stopped_global_shift: {len(stopped_cyls)}缸同时触发(≥4), "
                "符合停机热浸/热量再分布特征"
            )
            if ev.confirmed or ev.level == Level.CONFIRMED:
                ev.confirmed = False
                ev.level = Level.HIGH

    # ── V8.0 Phase 2-4 ──
    from .v8_evidence import aggregate_cylinder_evidence
    from .v8_score import (
        THRESHOLD_CONFIRMED,
        THRESHOLD_HIGH,
        score_evidence,
        score_to_level,
    )

    # Phase 3: 证据聚合
    primary_events = [ev for ev in events if ev.channel != Channel.IQR]
    iqr_output_events = [ev for ev in events if ev.channel == Channel.IQR]
    iqr_events = iqr_support_events if iqr_support_events is not None else iqr_output_events
    evidences = aggregate_cylinder_evidence(primary_events, segments, seg_type_map, ts_col)
    iqr_evidences = aggregate_cylinder_evidence(iqr_events, segments, seg_type_map, ts_col)
    _attach_iqr_related_counts(iqr_evidences, iqr_events)
    if not evidences and not iqr_evidences:
        _apply_iqr_system_support(events, iqr_events)
        # 无可聚合的证据（所有事件都没有缸号）→ 保留原样
        return events

    # Phase 4: 评分（单次遍历）
    v8_confirmed_ids = set()
    for ev_obj in evidences:
        primary_score = score_evidence(ev_obj, evidences)
        iqr_support = _iqr_support_info(ev_obj, iqr_evidences)
        iqr_bonus = iqr_support["bonus"]
        s = _combine_score_with_iqr_support(
            primary_score,
            iqr_bonus,
            confirmed_threshold=THRESHOLD_CONFIRMED,
        )
        level_str = score_to_level(s)
        iqr_created_high = (
            iqr_bonus > 0
            and primary_score < THRESHOLD_HIGH <= s
        )

        # 找到该证据对应的所有原始事件
        affected_indices = []
        for idx, ev in enumerate(events):
            cyl = _extract_single_cylinder(ev)
            if cyl == ev_obj.cylinder:
                # 时间重叠检查
                if _event_in_evidence_time(ev, ev_obj):
                    affected_indices.append(idx)

        # 标记原始事件
        for idx in affected_indices:
            ev = events[idx]
            # warmup 事件不可被提升
            if ev.low_confidence_reason and ev.low_confidence_reason.startswith("thermal_warmup"):
                continue
            # low_speed / stopped 通道不参与 V8.0 评分提升
            # stopped 通道有独立的物理规则判断，不需要跨通道确认
            if ev.channel in {Channel.LOW_SPEED, Channel.STOPPED}:
                continue
            if ev.channel == Channel.IQR:
                continue

            if level_str == "CONFIRMED":
                ev.confirmed = True
                ev.level = Level.CONFIRMED
                ev.low_confidence = False
                ev.low_confidence_reason = (
                    f"v8_confirmed: {ev_obj.cylinder}号缸 "
                    f"score={s:.3f} "
                    f"iqr_bonus={iqr_bonus:.3f} "
                    f"related_iqr={iqr_support['related_count']} "
                    f"n_groups={ev_obj.n_groups} "
                    f"({','.join(ev_obj.group_details.keys())})"
                )
                v8_confirmed_ids.add(id(ev))
            elif level_str == "HIGH":
                if not ev.confirmed:
                    ev.level = Level.HIGH
                    if iqr_created_high:
                        ev.low_confidence = True
                        ev.low_confidence_reason = (
                            f"v8_iqr_support_high: {ev_obj.cylinder}号缸 "
                            f"primary_score={primary_score:.3f} "
                            f"iqr_bonus={iqr_bonus:.3f} "
                            f"related_iqr={iqr_support['related_count']}; "
                            "IQR support does not trigger anomalyDetected alone"
                        )
                    else:
                        ev.low_confidence = False
            elif level_str == "COMODAL":
                if not ev.confirmed and ev.level != Level.HIGH:
                    ev.level = Level.COMODAL
            # LOW: 不改变

    # ── 未参与 V8.0 评分的事件降级 ──

    for ev_obj in iqr_evidences:
        for ev in iqr_output_events:
            cyl = _extract_single_cylinder(ev)
            if cyl != ev_obj.cylinder:
                continue
            if not _event_in_evidence_time(ev, ev_obj):
                continue
            ev.confirmed = False
            if ev.level == Level.CONFIRMED:
                ev.level = Level.HIGH
            ev.low_confidence = True
            ev.low_confidence_reason = (
                f"ch_iqr_standalone: {ev_obj.cylinder} cyl single-sensor "
                "IQR+3sigma evidence does not confirm alone"
            )

    _apply_iqr_system_support(events, iqr_events)

    for ev in events:
        if ev.confirmed and id(ev) not in v8_confirmed_ids:
            cyl = _extract_single_cylinder(ev)
            if cyl is None:
                continue  # 无缸号事件保留原始状态
            if ev.channel in {Channel.STOPPED, Channel.LOW_SPEED}:  # stopped/low_speed 有独立降级逻辑
                continue
            # 有缸号但未被 V8.0 评分确认 → 降级
            ev.confirmed = False
            ev.level = Level.HIGH
            ev.low_confidence = True
            ev.low_confidence_reason = (
                "v8_not_scored: 有缸号但未获V8.0评分确认，confirmed降级"
            )

    # ── 级联模式检测（保留 V7.8.5 逻辑） ──
    _cascade_suppress(events)

    # ── 全局波动拒绝（评分后生效） ──
    # ≥4 缸同时被 V8.0 评分为 confirmed → 疑似工况变化，降级非突出缸
    _v8_global_shift_reject(events, evidences)

    return events


def _extract_single_cylinder(ev: Event) -> int | None:
    """从事件传感器列表提取第一个缸号。"""
    from .utils import extract_cylinder
    return extract_cylinder(ev.sensors)


def _attach_iqr_related_counts(iqr_evidences: list, iqr_events: list[Event]) -> None:
    """Annotate aggregated IQR evidence with the number of raw events it covers."""
    if not iqr_evidences or not iqr_events:
        return
    raw_by_cyl: dict[int, list[Event]] = {}
    for ev in iqr_events:
        cyl = _extract_single_cylinder(ev)
        if cyl is not None:
            raw_by_cyl.setdefault(cyl, []).append(ev)

    for ev_obj in iqr_evidences:
        related_events = [
            ev
            for ev in raw_by_cyl.get(ev_obj.cylinder, [])
            if _event_in_evidence_time(ev, ev_obj)
        ]
        ev_obj.related_iqr_count = len(related_events)
        ev_obj.related_iqr_groups = sorted({g for ev in related_events for g in ev.groups})


def _iqr_support_info(ev_obj, iqr_evidences: list) -> dict:
    """Return same-cylinder IQR support info from aggregated IQR evidence."""
    if not iqr_evidences:
        return {"bonus": 0.0, "related_count": 0, "groups": []}

    related = [
        ev
        for ev in iqr_evidences
        if ev.cylinder == ev_obj.cylinder and _evidence_time_overlap(ev_obj, ev) > 0.0
    ]
    if not related:
        return {"bonus": 0.0, "related_count": 0, "groups": []}

    related_count = sum(int(getattr(ev, "related_iqr_count", 1) or 0) for ev in related)
    related_groups = sorted(
        {
            g
            for ev in related
            for g in (
                getattr(ev, "related_iqr_groups", None)
                or list(ev.group_details)
            )
        }
    )
    if related_count < IQR_CYLINDER_SUPPORT_SOFT_THRESHOLD:
        return {"bonus": 0.0, "related_count": related_count, "groups": related_groups}

    tier_cap = (
        IQR_CYLINDER_SUPPORT_SOFT_CAP
        if related_count < IQR_CYLINDER_SUPPORT_FULL_THRESHOLD
        else IQR_CYLINDER_SUPPORT_BONUS_CAP
    )
    total_iqr = len(iqr_evidences)
    local_count_score = min(related_count / IQR_CYLINDER_SUPPORT_FULL_THRESHOLD, 1.0)
    concentration_score = len(related) / max(total_iqr, 1)
    group_score = min(len({g for ev in related for g in ev.group_details}) / 3.0, 1.0)
    strength_score = max(ev.max_conf for ev in related)
    support = local_count_score * max(concentration_score, 0.25) * max(group_score, 0.25)
    support *= max(strength_score, 0.25)
    return {
        "bonus": round(min(support * tier_cap, tier_cap), 4),
        "related_count": related_count,
        "groups": related_groups,
    }


def _iqr_support_bonus(ev_obj, iqr_evidences: list) -> float:
    """Return the capped same-cylinder IQR support bonus."""
    return _iqr_support_info(ev_obj, iqr_evidences)["bonus"]


def _combine_score_with_iqr_support(
    primary_score: float,
    iqr_bonus: float,
    confirmed_threshold: float,
) -> float:
    """Add IQR support without letting IQR alone create a new confirmed event."""
    combined = min(primary_score + iqr_bonus, 1.0)
    if primary_score < confirmed_threshold <= combined:
        return round(confirmed_threshold - IQR_CONFIRM_MARGIN, 4)
    return round(combined, 4)


def _apply_iqr_system_support(events: list[Event], iqr_events: list[Event]) -> None:
    """Use IQR as conservative same-system support for non-cylinder events."""
    if not iqr_events:
        return
    for ev in events:
        if ev.channel == Channel.IQR:
            continue
        if ev.channel in {Channel.LOW_SPEED, Channel.STOPPED}:
            continue
        if _extract_single_cylinder(ev) is not None:
            continue
        support = _iqr_system_support(ev, iqr_events)
        if support["bonus"] <= 0:
            continue
        iqr_promoted = False
        if not ev.confirmed:
            if support["related_count"] >= IQR_SYSTEM_SUPPORT_FULL_THRESHOLD and ev.level != Level.HIGH:
                ev.level = Level.HIGH
                iqr_promoted = True
            elif ev.level == Level.LOW:
                ev.level = Level.COMODAL
                iqr_promoted = True
            if iqr_promoted:
                ev.low_confidence = True
        reason = (
            "v8_iqr_system_support: "
            f"groups={','.join(support['groups'])} "
            f"related_iqr={support['related_count']} "
            f"bonus={support['bonus']:.3f}"
        )
        ev.low_confidence_reason = (
            f"{ev.low_confidence_reason}; {reason}"
            if ev.low_confidence_reason
            else reason
        )


def _iqr_system_support(ev: Event, iqr_events: list[Event]) -> dict:
    groups = sorted(set(ev.groups or []) & IQR_SYSTEM_GROUPS)
    if not groups:
        return {"bonus": 0.0, "related_count": 0, "groups": []}

    related = [
        iqr
        for iqr in iqr_events
        if set(iqr.groups or []) & set(groups)
        and _event_time_overlap_ratio(ev, iqr) > 0.0
    ]
    related_count = len(related)
    if related_count < IQR_SYSTEM_SUPPORT_SOFT_THRESHOLD:
        return {"bonus": 0.0, "related_count": related_count, "groups": groups}

    tier_cap = (
        IQR_SYSTEM_SUPPORT_SOFT_CAP
        if related_count < IQR_SYSTEM_SUPPORT_FULL_THRESHOLD
        else IQR_SYSTEM_SUPPORT_BONUS_CAP
    )
    local_count_score = min(related_count / IQR_SYSTEM_SUPPORT_FULL_THRESHOLD, 1.0)
    group_score = min(
        len({g for item in related for g in item.groups if g in groups}) / max(len(groups), 1),
        1.0,
    )
    support = local_count_score * max(group_score, 0.5)
    return {
        "bonus": round(min(support * tier_cap, tier_cap), 4),
        "related_count": related_count,
        "groups": groups,
    }


def _event_time_overlap_ratio(a: Event, b: Event) -> float:
    try:
        a_start = _parse_ts(a.time_start)
        a_end = _parse_ts(a.time_end)
        b_start = _parse_ts(b.time_start)
        b_end = _parse_ts(b.time_end)
        overlap_start = max(a_start, b_start)
        overlap_end = min(a_end, b_end)
        if overlap_start >= overlap_end:
            return 0.0
        shorter = min(
            (a_end - a_start).total_seconds(),
            (b_end - b_start).total_seconds(),
        )
        if shorter <= 0:
            return 0.0
        return (overlap_end - overlap_start).total_seconds() / shorter
    except Exception:
        return 0.0


def _evidence_time_overlap(a, b) -> float:
    try:
        a_start = _parse_ts(a.time_start)
        a_end = _parse_ts(a.time_end)
        b_start = _parse_ts(b.time_start)
        b_end = _parse_ts(b.time_end)
        overlap_start = max(a_start, b_start)
        overlap_end = min(a_end, b_end)
        if overlap_start >= overlap_end:
            return 0.0
        a_dur = (a_end - a_start).total_seconds()
        b_dur = (b_end - b_start).total_seconds()
        shorter = min(a_dur, b_dur)
        if shorter <= 0:
            return 0.0
        return (overlap_end - overlap_start).total_seconds() / shorter
    except Exception:
        return 0.0


def _event_in_evidence_time(ev: Event, ev_obj) -> bool:
    """检查事件是否在证据的时间范围内（宽松匹配: 50% 重叠）。"""
    try:
        ev_start = _parse_ts(ev.time_start)
        ev_end = _parse_ts(ev.time_end)
        obj_start = _parse_ts(ev_obj.time_start)
        obj_end = _parse_ts(ev_obj.time_end)

        overlap_start = max(ev_start, obj_start)
        overlap_end = min(ev_end, obj_end)
        if overlap_start >= overlap_end:
            return False

        ev_dur = (ev_end - ev_start).total_seconds()
        if ev_dur <= 0:
            return False
        overlap_ratio = (overlap_end - overlap_start).total_seconds() / ev_dur
        return overlap_ratio > 0.3
    except Exception:
        return True  # 解析失败则宽松匹配


def _parse_ts(ts: str):
    """灵活解析时间戳。"""
    from .utils import parse_ts as _parse
    return _parse(ts)


def _cascade_suppress(events: list[Event]) -> None:
    """级联模式检测（保留自 V7.8.5）。

    同一传感器组 >3 个缸同时触发 → 大概率是单缸故障的镜像级联，
    保留偏差最大的缸，抑制其余缸。
    """
    from collections import defaultdict
    group_cyl_sets: dict[str, dict[str, set[int]]] = defaultdict(lambda: defaultdict(set))
    for idx, ev in enumerate(events):
        if ev.channel != Channel.MID_INTER_CYL:
            continue
        cyl_map = _extract_cylinders(ev.sensors)
        for gname, cyls in cyl_map.items():
            group_cyl_sets[gname][ev.id or str(idx)].update(cyls)

    for gname, window_cyl_set in group_cyl_sets.items():
        all_cyls_in_group: set[int] = set()
        for cyl_set in window_cyl_set.values():
            all_cyls_in_group.update(cyl_set)
        if len(all_cyls_in_group) < 4:
            continue

        cyl_max_dev: dict[int, float] = {}
        for idx, ev in enumerate(events):
            if ev.channel != Channel.MID_INTER_CYL:
                continue
            if gname not in ev.groups:
                continue
            for c in _extract_cylinders(ev.sensors).get(gname, set()):
                cyl_max_dev[c] = max(cyl_max_dev.get(c, 0.0), ev.max_z)

        if not cyl_max_dev:
            continue

        max_cyl = max(cyl_max_dev, key=cyl_max_dev.get)
        max_dev = cyl_max_dev[max_cyl]
        sorted_devs = sorted(cyl_max_dev.values(), reverse=True)
        second_dev = sorted_devs[1] if len(sorted_devs) > 1 else 0.0

        if max_dev > second_dev * 2 and second_dev > 0:
            for idx, ev in enumerate(events):
                if ev.channel != Channel.MID_INTER_CYL:
                    continue
                if gname not in ev.groups:
                    continue
                for c in _extract_cylinders(ev.sensors).get(gname, set()):
                    if c != max_cyl:
                        ev.low_confidence = True
                        ev.low_confidence_reason = (
                            f"cascade_suppressed: {c}号缸{gname}偏差为{max_cyl}号缸故障的镜像级联"
                        )


def _v8_global_shift_reject(events: list[Event], evidences: list) -> None:
    """全局波动拒绝（V7.8.5 逻辑迁移到 V8.0）。

    ≥4 缸在同一时间段有高分 evidence → 疑似全局工况变化，降级非突出缸。
    突出缸标准: severity 比中位数高 3 倍以上（真实单缸故障）。
    """
    if len(evidences) < 4:
        return

    # 找出时间段重叠的 evidence 簇
    # 简化: 找最大时间窗口内 ≥4 缸被触发的情况
    cyl_evs: dict[int, list] = {}
    for ev_obj in evidences:
        cyl_evs.setdefault(ev_obj.cylinder, []).append(ev_obj)

    triggered_cyls = {c for c, evs in cyl_evs.items() if any(e.max_conf > 0.5 for e in evs)}
    if len(triggered_cyls) < 4:
        return  # 不够 4 缸，不需要全局降级

    # 找突出缸: severity 远高于中位数
    cyl_max_sev = {}
    for c, evs in cyl_evs.items():
        cyl_max_sev[c] = max(e.max_conf for e in evs)

    from .utils import median_of_values
    median_sev = median_of_values(cyl_max_sev)
    # 突出缸判定 — 两个独立条件满足其一即可:
    # 1) n_groups 比中位数多 ≥2（多传感器组同时异常 = 真实单缸故障）
    # 2) max_conf > max(median_sev * 1.5, 0.90)（分数显著高于其他缸）
    outlier_cyls: set[int] = set()

    # 条件 1: n_groups 维度
    cyl_n_groups = {}
    for c, evs in cyl_evs.items():
        cyl_n_groups[c] = max(e.n_groups for e in evs)
    median_ng = median_of_values(cyl_n_groups)
    for c, ng in cyl_n_groups.items():
        if ng >= median_ng + 2:
            outlier_cyls.add(c)

    # 条件 2: severity 维度
    outlier_threshold = max(median_sev * 1.5, 0.90)
    for c, s in cyl_max_sev.items():
        if s >= outlier_threshold:
            outlier_cyls.add(c)

    # 对非突出缸的全局波动事件降级
    for ev_obj in evidences:
        if ev_obj.cylinder in outlier_cyls:
            continue  # 突出缸保留
        if ev_obj.max_conf < 0.5:
            continue  # 本身就是低分

        # 降级该 evidence 对应的原始事件
        for idx, ev in enumerate(events):
            cyl = _extract_single_cylinder(ev)
            if cyl != ev_obj.cylinder:
                continue
            if ev.channel in {Channel.LOW_SPEED, Channel.STOPPED}:
                continue
            if ev.low_confidence_reason and ev.low_confidence_reason.startswith("thermal_warmup"):
                continue
            if _event_in_evidence_time(ev, ev_obj):
                if ev.confirmed or ev.level == Level.CONFIRMED:
                    ev.confirmed = False
                    ev.level = Level.HIGH
                    ev.low_confidence = True
                    ev.low_confidence_reason = (
                        f"v8_global_shift: {len(triggered_cyls)}缸同时触发(≥4), "
                        f"疑似工况变化非单缸故障"
                    )


# ── 统一入口 ──────────────────────────────────────────────────────────

DEFAULT_BASELINE = BASE_DIR / "baselines" / "baseline_v81_cruise_mar_apr.pkl"


def detect(
    data_path: str | Path,
    baseline_path: str | Path | None = None,
    sensitivity: str = "strict",
) -> dict:
    """统一检测入口：JSON 文件路径 → 自动执行全部通道 → 返回结果字典。

    1. 加载 JSON 数据
    2. 自动加载/建立基线
    3. 运行全部检测通道（统计 + 巡航DL + 过渡段DL + 中低速DL）
    4. 返回结构化的结果字典

    Args:
        data_path: DC Key JSON 文件路径
        baseline_path: 基线 pickle 路径。为 None 时尝试默认路径，
                       无基线则从数据自动建立。
        sensitivity: strict / normal / relaxed

    Returns:
        {"task_info": {...}, "summary": {...}, "events": [...]}
    """
    t0 = datetime.now(timezone.utc)

    # 1. 加载数据
    from .loader import load_data
    df = load_data(data_path)
    if len(df) == 0:
        return {"task_info": {"error": "empty data"}, "summary": {"n_events": 0}, "events": []}

    # 2. 加载基线（必须预建，禁止用当天数据自建）
    from .baseline import load_baseline
    bp = baseline_path or DEFAULT_BASELINE
    bp_path = Path(bp)
    if bp_path.exists():
        baseline = load_baseline(bp_path)
        logger.info("detect: loaded baseline from %s", bp_path)
    else:
        raise FileNotFoundError(
            f"Baseline not found: {bp_path}. "
            "Build one first with: python -m engine.baseline build <data> <output.pkl>"
        )

    # 3. 运行全部检测通道
    events, channel_status = detect_all(df, baseline, sensitivity=sensitivity, data_path=str(data_path))

    # 4. 整理结果
    elapsed = (datetime.now(timezone.utc) - t0).total_seconds()
    rpm = df["rpm"] if "rpm" in df.columns else pd.Series([0.0])
    valid_rpm = rpm.dropna()
    duration_h = (df["timestamp"].max() - df["timestamp"].min()).total_seconds() / 3600 \
        if "timestamp" in df.columns else 0.0

    n_confirmed = sum(1 for e in events if e.confirmed)
    n_alarm = sum(1 for e in events if e.level in (Level.HIGH, Level.CONFIRMED))
    n_info = sum(1 for e in events if e.level in (Level.LOW, Level.COMODAL))

    from .result_policy import decide_platform_result
    platform_decision = decide_platform_result(events, sensor_data=df)

    result = {
        "task_info": {
            "task_id": f"detect_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
            "version": "8.1",
            "sensitivity": sensitivity,
            "elapsed_sec": round(elapsed, 2),
            "total_rows": len(df),
            "rpm_min": round(float(valid_rpm.min()), 1) if len(valid_rpm) > 0 else 0,
            "rpm_max": round(float(valid_rpm.max()), 1) if len(valid_rpm) > 0 else 0,
            "duration_hours": round(duration_h, 2),
        },
        "summary": {
            "n_events": len(events),
            "n_confirmed": n_confirmed,
            "n_alarm": n_alarm,
            "n_info": n_info,
            "recommended_result": platform_decision["result"],
            "result_policy_reason": platform_decision["reason"],
        },
        "events": [
            {
                "event_id": e.id,
                "level": e.level.value if hasattr(e.level, 'value') else str(e.level),
                "channel": e.channel.value if hasattr(e.channel, 'value') else str(e.channel),
                "type": e.type,
                "sensors": e.sensors,
                "groups": e.groups,
                "time_start": e.time_start,
                "time_end": e.time_end,
                "duration_min": round(e.duration_min, 1),
                "max_z": round(e.max_z, 2),
                "severity": round(e.severity, 2),
                "confirmed": e.confirmed,
                "low_confidence": e.low_confidence,
                "low_confidence_reason": e.low_confidence_reason,
            }
            for e in events
        ],
        "channel_status": [
            {
                "channel": s.channel,
                "active": s.active,
                "reason": s.reason,
                "n_samples": s.n_samples,
                "n_events": s.n_events,
            }
            for s in channel_status
        ],
    }

    logger.info("detect done: %d events in %.1fs (data=%s)",
                len(events), elapsed, Path(data_path).name)
    return result


def detect_all(
    df: pd.DataFrame, baseline: dict,
    sensitivity: str = "strict",
    data_path: str | None = None,
) -> tuple[list[Event], list[ChannelStatus]]:
    """运行全部检测通道（统计 + DL）并合并事件。

    返回 (events, channel_status) — channel_status 记录每个通道是否激活及原因。

    data_path: JSON 文件路径，用于 DL 推理（需要独立加载做 5min 重采样）。
    """
    global _event_counter
    _event_counter = itertools.count(1)

    config = SENSITIVITY_MAP.get(sensitivity, SENSITIVITY_MAP["strict"])
    rpm = df["rpm"] if "rpm" in df.columns else pd.Series([0.0])
    total_rows = len(df)

    # ── V8.1 前置工况分段：用 v8_segment 精确提取 cruise 段 ──
    from .v8_segment import segment_by_regime
    segments = segment_by_regime(df)

    # 预构建 timestamp→seg_type 映射（供 evidence 模块使用）
    ts_col = df["timestamp"]
    seg_type_map: dict[int, str] = {}
    for seg in segments:
        for idx in range(seg.start_idx, seg.end_idx):
            seg_type_map[idx] = seg.type

    # 收集所有 cruise 段（排除 warmup，过滤短段 <30 点/6min）的行索引
    MIN_CRUISE_SAMPLES = 30  # 6min @12s — 不足此数的 cruise 段无统计意义
    cruise_indices = []
    for seg in segments:
        if seg.type == "cruise" and seg.n_samples >= MIN_CRUISE_SAMPLES:
            cruise_indices.extend(range(seg.start_idx, seg.end_idx))
    cruise_df = df.iloc[cruise_indices].copy() if cruise_indices else df.iloc[0:0].copy()

    # 预判各通道状态
    ch_status: list[ChannelStatus] = []

    def _add_status(ch: str, active: bool, reason: str, n: int = 0):
        ch_status.append(ChannelStatus(channel=ch, active=active, reason=reason, n_samples=n))

    # ch1/ch2/ch3: 只在 cruise 段运行（由 segment_by_regime 确定）
    n_cruise = len(cruise_df)
    has_ch1_baseline = "ch1" in baseline and len(baseline["ch1"]) > 0
    for ch_name, bl_key, has_bl in [
        ("ch1_inter_cyl", "ch1", has_ch1_baseline),
        ("ch2_abs_ar", "ch2", "ch2" in baseline and len(baseline["ch2"]) > 0),
        ("ch3_dt_ar", "ch3", "ch3" in baseline and len(baseline["ch3"]) > 0),
    ]:
        if n_cruise >= config.get("min_consecutive", 3) and has_bl:
            _add_status(ch_name, True, f"cruise segment: {n_cruise} samples, baseline OK", n_cruise)
        elif n_cruise < config.get("min_consecutive", 3):
            _add_status(ch_name, False, f"cruise samples insufficient: {n_cruise}", n_cruise)
        else:
            _add_status(ch_name, False, f"{bl_key} baseline not found", n_cruise)

    # ch_stopped_phys: RPM < 5 停机状态
    n_stopped = int((rpm.abs() < 5).sum())
    if n_stopped >= 10:
        stopped_sensors = []
        if all(f"exh_cyl{i}" in df.columns for i in range(1, 7)):
            stopped_sensors.append("排温")
        if any(c in df.columns for c in ["shaft_aft_bearing_temp", "shaft_mid_bearing_temp"]):
            stopped_sensors.append("轴承")
        _add_status("ch_stopped_phys", True,
                     f"RPM<5: {n_stopped} samples, sensors={','.join(stopped_sensors)}", n_stopped)
    else:
        _add_status("ch_stopped_phys", False, f"RPM<5 samples insufficient: {n_stopped} < 10", n_stopped)

    # ch_mid_inter_cyl: RPM 25~98（软重叠）+ 各传感器组列齐全
    n_mid = int(((rpm >= 25) & (rpm < 98)).sum())
    mid_groups = []
    for prefix, label in [("exh_cyl", "排温"), ("scav_cyl", "扫气"), ("piston_lo_cyl", "活塞油"), ("cfw_out_cyl", "缸套水")]:
        cols = [f"{prefix}{i}" for i in range(1, 7)]
        if all(c in df.columns for c in cols):
            mid_groups.append(label)
    if n_mid >= 10 and mid_groups:
        _add_status("ch_mid_inter_cyl", True, f"25≤RPM<98: {n_mid} samples, groups={','.join(mid_groups)}", n_mid)
    elif n_mid < 10:
        _add_status("ch_mid_inter_cyl", False, f"25≤RPM<98 samples insufficient: {n_mid} < 10", n_mid)
    else:
        _add_status("ch_mid_inter_cyl", False, "all 4 sensor groups missing from columns", n_mid)

    # DL 通道（异常捕获时仍记录状态）
    _add_dl_status = lambda ch, active, reason: ch_status.append(
        ChannelStatus(channel=ch, active=active, reason=reason))

    # 预计算RPM分区样本数，供DL通道状态参考
    n_over93 = int((rpm >= 93).sum())
    n_78_93 = int(((rpm >= 78) & (rpm < 93)).sum())
    n_30_78 = int(((rpm >= 30) & (rpm < 78)).sum())
    dl_rpm_info = f"RPM≥93={n_over93}  78-93={n_78_93}  30-78={n_30_78}"

    # ── 运行检测通道 ──
    # V8.1: ch1/ch2/ch3 逐 cruise 段独立检测（不拼接，避免跨段温差导致 z-score 爆炸）
    all_events: list[Event] = []
    raw_iqr_events: list[Event] = []
    cruise_segments = [
        seg for seg in segments
        if seg.type == "cruise" and seg.n_samples >= MIN_CRUISE_SAMPLES
    ]
    for cseg in cruise_segments:
        seg_df = df.iloc[cseg.start_idx:cseg.end_idx].copy()
        all_events.extend(detect_channel1(seg_df, baseline, config))
        all_events.extend(detect_channel2(seg_df, baseline, config))
        all_events.extend(detect_channel3(seg_df, baseline, config))

    # 中低速缸间一致性（原始12s采样，覆盖 ch1 盲区 RPM 30~95）
    all_events.extend(detect_mid_inter_cyl(df, config))

    # 停机物理规则（RPM < 5 停泊状态，轴承温升 / 排温异常 / 停机加热）
    all_events.extend(detect_stopped(df, config))

    try:
        from .iqr import detect_iqr_with_stats
        iqr_events, iqr_stats = detect_iqr_with_stats(
            df, segments, sensitivity=sensitivity
        )
        raw_iqr_events = iqr_events
        iqr_output_events = _compress_iqr_events_for_output(iqr_events, iqr_stats)
        all_events.extend(iqr_output_events)
        _add_status(
            "ch_iqr",
            True,
            "IQR+3sigma "
            f"raw_events={len(iqr_events)} "
            f"output_events={len(iqr_output_events)} "
            f"point_rate={iqr_stats.point_rate:.2%}",
            iqr_stats.total_points,
        )
    except Exception as e:
        _add_status("ch_iqr", False, f"error: {e}", total_rows)
        logger.warning("ch_iqr channel error: %s", e)

    # NF DL channels stay enabled; predictive DL heads are replaced by ch_iqr.
    if data_path is not None:
        try:
            from .dl import detect_dl
            dl_events = detect_dl(data_path, sensitivity=sensitivity)
            all_events.extend(dl_events)
            _add_dl_status("dl_cruise_nf", True, f"loaded ({dl_rpm_info})")
        except ImportError:
            _add_dl_status("dl_cruise_nf", False, "torch not available")
            logger.warning("Cruise NF channel skipped: torch not available")
        except Exception as e:
            _add_dl_status("dl_cruise_nf", False, f"error: {e}")
            logger.warning("Cruise NF channel error: %s", e)
    else:
        _add_dl_status("dl_cruise_nf", False, "data_path is None (raw df only)")

    if data_path is not None:
        try:
            from .dl import detect_nf
            nf_events = detect_nf(data_path, sensitivity=sensitivity)
            all_events.extend(nf_events)
            _add_dl_status("dl_forecast_nf", True, f"loaded ({dl_rpm_info})")
        except Exception as e:
            _add_dl_status("dl_forecast_nf", False, f"error: {e}")
            logger.warning("NF-DL channel error: %s", e)
    else:
        _add_dl_status("dl_forecast_nf", False, "data_path is None")

    # DL 通道5：Midlow (30-78 RPM) 专用 NF
    if data_path is not None:
        try:
            from .dl import detect_nf_midlow
            nfm_events = detect_nf_midlow(data_path, sensitivity=sensitivity)
            all_events.extend(nfm_events)
            _add_dl_status("dl_midlow_nf", True, f"loaded ({dl_rpm_info})")
        except Exception as e:
            _add_dl_status("dl_midlow_nf", False, f"error: {e}")
            logger.warning("Midlow-NF channel error: %s", e)
    else:
        _add_dl_status("dl_midlow_nf", False, "data_path is None")

    merged = merge_events(all_events)

    # 计算 RPM 标准差（用于跨通道验证的 RPM 稳定性判断）
    valid_rpm = rpm.dropna()
    rpm_std = float(valid_rpm.std()) if len(valid_rpm) > 10 else 0.0

    # ── V8.0 跨通道评分流水线 ──
    # Phase 0: 复用前置分段结果（已在函数开头调用 segment_by_regime）

    # Phase 2-4: 归一化 → 证据聚合 → 评分 → 标记 confirmed
    merged = _v8_cross_validate(
        merged,
        segments,
        df,
        seg_type_map,
        ts_col,
        iqr_support_events=raw_iqr_events,
    )

    # D3: 全局最小样本量门槛 — 放在 _v8_cross_validate 之后，防止评分恢复 Confirmed
    MIN_SAMPLES_FOR_CONFIRMED = 100
    if total_rows < MIN_SAMPLES_FOR_CONFIRMED:
        for ev in merged:
            if ev.confirmed:
                ev.confirmed = False
                ev.level = Level.HIGH
                ev.low_confidence = True
                ev.low_confidence_reason = (
                    f"insufficient_samples: 总数据量{total_rows}点<{MIN_SAMPLES_FOR_CONFIRMED}，"
                    "统计显著性不足，Confirmed强制降级"
                )

    # 回填每个通道的事件数
    ch_map: dict[str, ChannelStatus] = {s.channel: s for s in ch_status}
    for ev in merged:
        if ev.channel.value in ch_map:
            ch_map[ev.channel.value].n_events += 1

    return merged, ch_status

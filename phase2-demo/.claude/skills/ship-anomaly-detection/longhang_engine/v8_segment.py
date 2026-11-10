"""V8.0 Phase 0: 工况分段器

将 6h 混合 RPM 时间序列自动分段为工况段:
- cruise:    RPM ≥ 90 且 rolling σ < 10
- maneuver:  RPM ≥ 90 且 rolling σ ≥ 10
- mid:       30 ≤ RPM < 90（非 stopped，非 cruise）
- low_speed: 5 < RPM < 30
- stopped:   RPM < 5
- warmup:    cruise 段前 30min（150 样本点 @12s）

段按时间顺序排列，覆盖完整时间序列无遗漏无重叠。
短段（< 15 个样本点 / 3min）合并到相邻段。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# 采样间隔（秒），用于计算段时长
SAMPLE_INTERVAL = 12

# RPM 工况阈值
RPM_STOPPED = 5
RPM_LOW = 30
RPM_MID = 90  # V7.8.5 里 cruise 阈值就是 90

# 段类型优先级（用于短段合并时选择继承谁）
REGIME_ORDER = ["stopped", "low_speed", "mid", "maneuver", "cruise", "warmup"]

# 巡航 RPM 不稳定判断：rolling std 窗口
MANEUVER_SIGMA = 10.0
MANEUVER_WINDOW = 50  # 10min @12s ≈ 50 samples

# 短段阈值：少于此数量合并到相邻段
MIN_SEGMENT_SAMPLES = 15  # 3min @12s

# warmup 时长（样本点）
WARMUP_SAMPLES = 150  # 30min @12s
WARMUP_POST_STOP_SAMPLES = 300  # 60min @12s — 停机后重启需要更长热平衡


@dataclass
class Segment:
    """一个工况段。"""

    type: str               # stopped / low_speed / mid / cruise / maneuver / warmup
    start_idx: int          # 起始行号（含）
    end_idx: int            # 结束行号（不含）
    rpm_stats: dict = field(default_factory=dict)  # {mean, std, min, max}

    @property
    def n_samples(self) -> int:
        return self.end_idx - self.start_idx

    @property
    def duration_min(self) -> float:
        return self.n_samples * SAMPLE_INTERVAL / 60.0


def segment_by_regime(df: pd.DataFrame) -> list[Segment]:
    """按 RPM 行为将时间序列分为工况段。

    Args:
        df: 必须含 "rpm" 列

    Returns:
        有序段列表，覆盖 0..len(df)，无间隔无重叠
    """
    rpm = df["rpm"].values.astype(float)
    n = len(rpm)
    if n == 0:
        return []

    # ── Step 1: 逐样本分类 ──
    sample_types = np.empty(n, dtype="U12")

    # 先按 RPM 绝对值分
    for i in range(n):
        r = rpm[i]
        if np.isnan(r):
            sample_types[i] = "stopped"  # 缺失数据视为停机
        elif r < RPM_STOPPED:
            sample_types[i] = "stopped"
        elif r < RPM_LOW:
            sample_types[i] = "low_speed"
        elif r < RPM_MID:
            sample_types[i] = "mid"
        else:
            sample_types[i] = "cruise_raw"  # 待定 cruise 还是 maneuver

    # ── Step 2: 区分 cruise vs maneuver ──
    # 对 cruise_raw 区域做 rolling std
    if n >= MANEUVER_WINDOW:
        rpm_series = pd.Series(rpm)
        rolling_std = rpm_series.rolling(MANEUVER_WINDOW, min_periods=10).std().values
    else:
        rolling_std = np.full(n, 0.0)

    for i in range(n):
        if sample_types[i] == "cruise_raw":
            sigma = rolling_std[i] if not np.isnan(rolling_std[i]) else 0.0
            if sigma >= MANEUVER_SIGMA:
                sample_types[i] = "maneuver"
            else:
                sample_types[i] = "cruise"
        # 不在 cruise_raw 的不变

    # ── Step 3: 合并连续同类型为段 ──
    segments: list[Segment] = []
    seg_start = 0
    seg_type = sample_types[0]

    for i in range(1, n):
        if sample_types[i] != seg_type:
            segments.append(_make_segment(seg_type, seg_start, i, rpm))
            seg_start = i
            seg_type = sample_types[i]
    # 最后一段
    segments.append(_make_segment(seg_type, seg_start, n, rpm))

    # ── Step 4: 合并短段 ──
    segments = _merge_short_segments(segments)

    # ── Step 5: cruise 段前 30min 标记为 warmup ──
    segments = _mark_warmup(segments)

    # ── Step 6: 重新计算 rpm_stats（段边界可能变了）──
    for seg in segments:
        seg.rpm_stats = _calc_rpm_stats(rpm, seg.start_idx, seg.end_idx)

    logger.info("segment_by_regime: %d segments from %d samples", len(segments), n)
    for seg in segments:
        logger.debug("  %s [%d:%d] rpm_mean=%.1f σ=%.1f",
                     seg.type, seg.start_idx, seg.end_idx,
                     seg.rpm_stats.get("mean", 0), seg.rpm_stats.get("std", 0))

    return segments


def _make_segment(seg_type: str, start: int, end: int, rpm: np.ndarray) -> Segment:
    """构造段并计算统计量。"""
    return Segment(
        type=seg_type,
        start_idx=start,
        end_idx=end,
        rpm_stats=_calc_rpm_stats(rpm, start, end),
    )


def _calc_rpm_stats(rpm: np.ndarray, start: int, end: int) -> dict:
    """计算段内 RPM 统计量。"""
    chunk = rpm[start:end]
    valid = chunk[~np.isnan(chunk)]
    if len(valid) == 0:
        return {"mean": 0.0, "std": 0.0, "min": 0.0, "max": 0.0}
    return {
        "mean": round(float(np.mean(valid)), 2),
        "std": round(float(np.std(valid)), 2),
        "min": round(float(np.min(valid)), 2),
        "max": round(float(np.max(valid)), 2),
    }


def _merge_short_segments(segments: list[Segment]) -> list[Segment]:
    """将 < MIN_SEGMENT_SAMPLES 的短段合并到相邻段。

    策略: 短段继承更长的邻居。如果两边长度相近，优先合并到前面（时间更近的工况连续）。
    """
    if len(segments) <= 1:
        return segments

    result = list(segments)
    changed = True
    while changed:
        changed = False
        new_result = []
        i = 0
        while i < len(result):
            seg = result[i]
            if seg.n_samples < MIN_SEGMENT_SAMPLES:
                # 尝试合并
                prev_len = result[i - 1].n_samples if i > 0 else -1
                next_len = result[i + 1].n_samples if i + 1 < len(result) else -1

                if prev_len >= next_len and i > 0:
                    # 合并到前一段
                    prev = new_result[-1] if new_result else result[i - 1]
                    prev.end_idx = seg.end_idx
                    prev.rpm_stats = _calc_rpm_stats(
                        np.zeros(0), 0, 0  # placeholder, Step 6 重算
                    )
                    changed = True
                elif next_len > prev_len and i + 1 < len(result):
                    # 合并到后一段
                    result[i + 1] = Segment(
                        type=result[i + 1].type,
                        start_idx=seg.start_idx,
                        end_idx=result[i + 1].end_idx,
                    )
                    changed = True
                elif i > 0:
                    # 两边都没有，强制合并到前一段
                    prev = new_result[-1] if new_result else result[i - 1]
                    prev.end_idx = seg.end_idx
                    changed = True
                elif i + 1 < len(result):
                    result[i + 1] = Segment(
                        type=result[i + 1].type,
                        start_idx=seg.start_idx,
                        end_idx=result[i + 1].end_idx,
                    )
                    changed = True
                else:
                    # 只有一个段且太短，或最后一个短段无邻居 → 保留
                    new_result.append(seg)
            else:
                new_result.append(seg)
            i += 1
        result = new_result

    return result


def _mark_warmup(segments: list[Segment]) -> list[Segment]:
    """cruise/maneuver 段前 30min（150 样本）标记为 warmup。

    停机后重启的 cruise 段 warmup 翻倍到 60min（热平衡需要更长时间）。
    如果 cruise 段 >= warmup_samples:
      - 前 warmup_samples 个点切出为 warmup 段
      - 剩余部分保留原类型
    """
    result: list[Segment] = []
    for i, seg in enumerate(segments):
        # 判断前面是否紧邻 stopped 段
        post_stop = False
        if i > 0 and segments[i - 1].type == "stopped":
            post_stop = True
        warmup_n = WARMUP_POST_STOP_SAMPLES if post_stop else WARMUP_SAMPLES

        if seg.type in ("cruise", "maneuver") and seg.n_samples >= warmup_n:
            # 切出 warmup
            warmup = Segment(
                type="warmup",
                start_idx=seg.start_idx,
                end_idx=seg.start_idx + warmup_n,
            )
            remaining = Segment(
                type=seg.type,
                start_idx=seg.start_idx + warmup_n,
                end_idx=seg.end_idx,
            )
            result.append(warmup)
            if remaining.n_samples >= MIN_SEGMENT_SAMPLES:
                result.append(remaining)
            else:
                # 剩余太短，合并回 warmup
                warmup.end_idx = seg.end_idx
        else:
            result.append(seg)
    return result

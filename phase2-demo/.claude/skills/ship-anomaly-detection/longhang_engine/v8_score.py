"""V8.0 Phase 4: 置信度评分

4 因子加权评分 × 工况修正:
  score = (cross_group × w1 + severity × w2 + outlier × w3 + duration × w4) × regime_modifier

阈值:
  score ≥ 0.65 → CONFIRMED
  score ≥ 0.40 → HIGH
  score ≥ 0.20 → COMODAL
  else        → LOW
"""

from __future__ import annotations

import logging

import numpy as np

logger = logging.getLogger(__name__)

# 权重（总和 = 1.0）
W_CROSS_GROUP = 0.35
W_SEVERITY = 0.25
W_OUTLIER = 0.25
W_DURATION = 0.15

# 工况修正系数
REGIME_MODIFIERS = {
    "cruise":    1.0,
    "maneuver":  0.7,
    "low_speed": 0.5,
    "mid":       0.6,
    "stopped":   0.8,
    "warmup":    0.3,
}

# 分级阈值
THRESHOLD_CONFIRMED = 0.65
THRESHOLD_HIGH = 0.40
THRESHOLD_COMODAL = 0.20


def score_evidence(evidence, all_evidences: list) -> float:
    """计算单条证据的最终置信度分数。

    Args:
        evidence: Evidence 对象（有 n_groups, max_conf, duration_min, seg_type, group_details）
        all_evidences: 全部证据列表（用于计算 outlier 因子）

    Returns:
        float ∈ [0, 1]
    """
    # ── 因子 1: 跨传感器组数 ──
    n_groups = evidence.n_groups
    cross_group = min(n_groups / 3.0, 1.0)

    # ── 因子 2: 最高单通道严重度 ──
    severity = evidence.max_conf

    # ── 因子 3: 缸间异常突出度 ──
    outlier = _calc_outlier(evidence, all_evidences)

    # ── 因子 4: 持续时间 ──
    duration = min(evidence.duration_min / 30.0, 1.0)

    # ── 工况修正 ──
    modifier = REGIME_MODIFIERS.get(evidence.seg_type, 0.5)

    # ── 加权求和 ──
    raw_score = (
        cross_group * W_CROSS_GROUP
        + severity * W_SEVERITY
        + outlier * W_OUTLIER
        + duration * W_DURATION
    )

    # ── outlier 否决: 缸间无突出度时压低分数 ──
    # 物理依据: 全部缸都异常 = 工况变化（非单缸故障），不应 confirmed
    # outlier < 0.4 → raw_score × outlier 作为否决因子
    if outlier < 0.4:
        raw_score *= outlier * 1.5  # 例: outlier=0.33 → ×0.50

    score = raw_score * modifier

    return round(min(max(score, 0.0), 1.0), 4)


def _calc_outlier(evidence, all_evidences: list) -> float:
    """计算缸间异常突出度。

    物理依据: 全部缸都异常 = 工况变化，某缸远高于其他缸 = 单缸故障。
    outlier = max_conf / median(其他缸 max_conf)
    归一化: min(outlier / 3, 1.0)，即 3 倍突出 = 满分。
    """
    if len(all_evidences) < 4:
        return 0.5  # 数据不足，中性分

    all_confs = [e.max_conf for e in all_evidences]
    my_conf = evidence.max_conf

    # 排除自己
    others = sorted(all_confs, reverse=True)
    if my_conf in others:
        others.remove(my_conf)

    if not others:
        return 0.5

    median_other = float(np.median(others))
    if median_other <= 0.01:
        # 其他缸都没有异常 → 该缸异常就是突出
        return min(my_conf / 0.01 / 3.0, 1.0)

    ratio = my_conf / median_other
    return min(ratio / 3.0, 1.0)


def score_to_level(score: float) -> str:
    """分数 → 等级。"""
    if score >= THRESHOLD_CONFIRMED:
        return "CONFIRMED"
    elif score >= THRESHOLD_HIGH:
        return "HIGH"
    elif score >= THRESHOLD_COMODAL:
        return "COMODAL"
    else:
        return "LOW"

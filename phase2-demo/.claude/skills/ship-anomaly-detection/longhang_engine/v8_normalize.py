"""V8.0 Phase 2: 事件归一化

各通道 raw_score 尺度不同，归一化到 [0, 1] 后才能跨通道比较。
使用 sigmoid 饱和函数: conf = 1 - 1/(1 + raw/scale)
- raw=0 → conf=0
- raw=scale → conf=0.5
- raw→∞ → conf→1
"""

from __future__ import annotations

# 归一化参数：scale 值表示 raw_score 达到多少时 confidence ≈ 0.5
# 来源: V7.8.5 各通道 raw_score 分布经验值
CHANNEL_NORM: dict[str, dict[str, float]] = {
    # 统计通道
    "ch1_inter_cyl":    {"scale": 10.0},   # z-score
    "ch2_abs_ar":       {"scale": 15.0},   # z-score
    "ch3_dt_ar":        {"scale": 10.0},   # z-score
    "ch_iqr":           {"scale": 8.0},    # joint IQR + sigma candidate score
    "mid_inter_cyl":    {"scale": 100.0},  # 绝对偏差 °C
    "low_speed":        {"scale": 10.0},   # z-score
    "stopped":          {"scale": 5.0},    # 温升率 °C/12s
    # DL 通道
    "dl_patchtst":      {"scale": 5.0},    # ratio (MAE/mean)
    "dl_nf":            {"scale": 50.0},   # neg_log_lik
    "dl_forecast":      {"scale": 5.0},    # ratio
    "dl_nf_forecast":   {"scale": 50.0},   # neg_log_lik
    "dl_midlow":        {"scale": 5.0},    # ratio
    "dl_nf_midlow":     {"scale": 50.0},   # neg_log_lik
}


def normalize_score(raw_score: float, channel: str) -> float:
    """将通道原始分数归一化到 [0, 1]。

    使用 sigmoid 饱和函数避免极端值主导。

    Args:
        raw_score: 通道原始分数（非负）
        channel: 通道名（必须在 CHANNEL_NORM 中）

    Returns:
        float ∈ [0, 1]，sigmoid 映射
    """
    if raw_score <= 0:
        return 0.0

    norm = CHANNEL_NORM.get(channel)
    if norm is None:
        # 未知通道，用默认 scale=10
        scale = 10.0
    else:
        scale = norm["scale"]

    return 1.0 - 1.0 / (1.0 + raw_score / scale)

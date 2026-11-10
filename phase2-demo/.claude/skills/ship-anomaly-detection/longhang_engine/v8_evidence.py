"""V8.0 Phase 3: 缸级证据聚合

将同缸时间重叠的事件聚合为 Evidence（证据集）。
两个事件时间重叠 >50% 且属于同一缸 → 合并为一个 Evidence。

每个 Evidence 记录:
- cylinder: 缸号
- n_groups: 跨多少个传感器组
- group_details: 每个组的最高置信度
- max_conf: 最高单通道归一化分数
- channels: 涉及的检测通道
- duration_min: 时间跨度
- seg_type: 所在工况段
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import pandas as pd

from .types import Event
from .v8_normalize import normalize_score

logger = logging.getLogger(__name__)


@dataclass
class Evidence:
    """一个缸的证据集。"""

    cylinder: int
    time_start: str
    time_end: str
    n_groups: int = 0
    group_details: dict[str, float] = field(default_factory=dict)
    max_conf: float = 0.0
    channels: set[str] = field(default_factory=set)
    duration_min: float = 0.0
    seg_type: str = "cruise"


def aggregate_cylinder_evidence(
    events: list[Event],
    segments: list | None = None,
    seg_type_map: dict | None = None,
    ts_col: "pd.Series | None" = None,
) -> list[Evidence]:
    """对每个缸聚合时间重叠的事件为证据集。

    Args:
        events: 检测产出的事件列表
        segments: 工况段列表（用于标注 seg_type），可选

    Returns:
        Evidence 列表，按 max_conf 降序
    """
    if not events:
        return []

    # ── Step 1: 提取缸号，归一化 severity ──
    tagged: list[dict] = []
    for ev in events:
        cyl = _extract_cylinder(ev)
        if cyl is None:
            continue  # 无缸号的事件不参与聚合

        # 归一化 severity/max_z
        channel_key = _map_channel(ev.channel)
        raw_score = max(ev.severity, ev.max_z)
        conf = normalize_score(raw_score, channel_key)

        group = ev.groups[0] if ev.groups else "unknown"

        tagged.append({
            "cylinder": cyl,
            "group": group,
            "channel": channel_key,
            "conf": conf,
            "time_start": ev.time_start,
            "time_end": ev.time_end,
            "event": ev,
        })

    if not tagged:
        return []

    # ── Step 2: 按缸分组 ──
    cyl_groups: dict[int, list[dict]] = {}
    for t in tagged:
        cyl_groups.setdefault(t["cylinder"], []).append(t)

    # ── Step 3: 同缸内聚合时间重叠的事件 ──
    evidences: list[Evidence] = []
    for cyl, items in cyl_groups.items():
        # 按时间排序
        items.sort(key=lambda x: x["time_start"])

        # greedy merge: 第一个开始，然后看每个后续事件是否重叠 >50%
        clusters: list[list[dict]] = []
        current_cluster = [items[0]]

        for i in range(1, len(items)):
            prev = current_cluster[-1]
            curr = items[i]

            if _time_overlap_ratio(prev, curr) > 0.5:
                current_cluster.append(curr)
            else:
                clusters.append(current_cluster)
                current_cluster = [curr]
        clusters.append(current_cluster)

        # 每个 cluster → 一个 Evidence
        for cluster in clusters:
            ev = _cluster_to_evidence(cyl, cluster, segments, seg_type_map, ts_col)
            evidences.append(ev)

    # 按 max_conf 降序
    evidences.sort(key=lambda e: e.max_conf, reverse=True)
    return evidences


def _extract_cylinder(ev: Event) -> int | None:
    """从事件的 sensors 中提取缸号。"""
    from .utils import extract_cylinder
    return extract_cylinder(ev.sensors)


def _map_channel(channel) -> str:
    """将 Channel 枚举映射到归一化通道名。"""
    ch_str = channel.value if hasattr(channel, "value") else str(channel)
    mapping = {
        "abs_ar": "ch2_abs_ar",
        "inter_cyl": "ch1_inter_cyl",
        "dt_ar": "ch3_dt_ar",
        "mid_inter_cyl": "mid_inter_cyl",
        "low_speed": "low_speed",
        "stopped": "stopped",
    }
    return mapping.get(ch_str, ch_str)


def _time_overlap_ratio(a: dict, b: dict) -> float:
    """计算两个事件的时间重叠比例（相对于较短的那个）。"""
    from .utils import parse_ts

    a_start = parse_ts(a["time_start"])
    a_end = parse_ts(a["time_end"])
    b_start = parse_ts(b["time_start"])
    b_end = parse_ts(b["time_end"])

    overlap_start = max(a_start, b_start)
    overlap_end = min(a_end, b_end)

    if overlap_start >= overlap_end:
        return 0.0

    overlap_sec = (overlap_end - overlap_start).total_seconds()
    a_dur = (a_end - a_start).total_seconds()
    b_dur = (b_end - b_start).total_seconds()
    shorter = min(a_dur, b_dur)

    if shorter <= 0:
        return 0.0

    return overlap_sec / shorter


def _cluster_to_evidence(
    cylinder: int,
    cluster: list[dict],
    segments: list | None,
    seg_type_map: dict | None = None,
    ts_col=None,
) -> Evidence:
    """将一个 cluster 转换为 Evidence。"""
    groups: dict[str, float] = {}
    channels: set[str] = set()
    max_conf = 0.0

    for item in cluster:
        g = item["group"]
        conf = item["conf"]
        channels.add(item["channel"])

        if g not in groups or conf > groups[g]:
            groups[g] = conf

        if conf > max_conf:
            max_conf = conf

    # 时间范围
    time_start = cluster[0]["time_start"]
    time_end = cluster[-1]["time_end"]

    # 实际时间范围取 min start / max end
    all_starts = [_parse_flexible(c["time_start"]) for c in cluster]
    all_ends = [_parse_flexible(c["time_end"]) for c in cluster]
    earliest = min(all_starts)
    latest = max(all_ends)

    time_start = earliest.isoformat()
    time_end = latest.isoformat()
    duration_min = (latest - earliest).total_seconds() / 60.0

    # 工况段类型：通过 timestamp 查找所在行索引 → seg_type_map 查类型
    seg_type = "cruise"  # 默认
    if seg_type_map is not None and ts_col is not None:
        seg_type = _find_seg_type(earliest, seg_type_map, ts_col)

    return Evidence(
        cylinder=cylinder,
        time_start=time_start,
        time_end=time_end,
        n_groups=len(groups),
        group_details=groups,
        max_conf=max_conf,
        channels=channels,
        duration_min=duration_min,
        seg_type=seg_type,
    )


def _parse_flexible(ts: str):
    """灵活解析时间戳。"""
    from .utils import parse_ts
    return parse_ts(ts)


def _find_seg_type(timestamp, seg_type_map: dict, ts_col) -> str:
    """通过 timestamp 找到对应行位置，再从 seg_type_map 查工况段类型。"""
    if seg_type_map is None or ts_col is None:
        return "cruise"
    try:
        ts = pd.Timestamp(timestamp)
        idx = ts_col.searchsorted(ts, side="right") - 1
        if 0 <= idx < len(ts_col):
            return seg_type_map.get(idx, "cruise")
    except (ValueError, KeyError, TypeError):
        pass
    return "cruise"

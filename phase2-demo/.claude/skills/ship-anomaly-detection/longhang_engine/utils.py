"""共享工具函数：缸号提取、时间戳解析、中位数。"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Sequence

import numpy as np

# ── 缸号提取 ──────────────────────────────────────────────────────
_CYL_RE = re.compile(r"cyl(\d)", re.IGNORECASE)


def extract_cylinder(sensors: Sequence[str]) -> int | None:
    """从传感器名称列表中提取第一个缸号（1-9）。

    匹配规则：名字中包含 ``cylN``（如 exh_cyl3, scav_cyl1）。
    如果多个传感器匹配不同缸号，返回最先匹配到的。
    """
    for s in sensors:
        m = _CYL_RE.search(s)
        if m:
            return int(m.group(1))
    return None


def extract_all_cylinders(sensors: Sequence[str]) -> set[int]:
    """从传感器名称列表中提取所有出现的缸号。"""
    cyls: set[int] = set()
    for s in sensors:
        m = _CYL_RE.search(s)
        if m:
            cyls.add(int(m.group(1)))
    return cyls


# ── 时间戳解析 ────────────────────────────────────────────────────
_TS_FORMATS = (
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S.%f",
    "%Y-%m-%dT%H:%M:%S.%f%z",
)


def parse_ts(ts: str) -> datetime:
    """灵活解析时间戳字符串，尝试多种格式后 fallback 到 fromisoformat。"""
    truncated = ts[:26]
    for fmt in _TS_FORMATS:
        try:
            return datetime.strptime(truncated, fmt)
        except ValueError:
            continue
    return datetime.fromisoformat(ts)


# ── 中位数 ────────────────────────────────────────────────────────

def median_of_values(values: list[float] | dict) -> float:
    """计算中位数，接受 list 或 dict（取 values）。"""
    nums = list(values.values()) if isinstance(values, dict) else list(values)
    if not nums:
        return 0.0
    return float(np.median(nums))

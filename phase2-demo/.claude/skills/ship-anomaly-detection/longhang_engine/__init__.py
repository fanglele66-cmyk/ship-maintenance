"""
船舶主机异常检测引擎 V7.8.5
============================
统一入口：
  from engine import detect
  result = detect("data.json")

自动执行全部检测通道：
  - 三通道回归基线 (RPM>=93)
  - 巡航DL (PatchTST + NF, RPM>=93)
  - 全工况DL (iT + NF Forecast, RPM>=78)
  - 中低速DL (DualTask + NF Midlow, RPM 30-78)
  - 中低速缸间一致性规则 (ch_mid_inter_cyl, RPM 30~95, 12s原始采样)
  - 停机物理规则 (ch_stopped_phys, RPM<5, 12s原始采样)

模块化架构：
  registry — 传感器三层映射
  config   — 配置常量与阈值
  loader   — JSON-only 数据加载
  baseline — 三通道回归基线建模
  detector — 检测引擎 + 统一入口 detect()
  gradual  — 渐变故障检测
  dl       — 深度学习推理
  types    — Event/DetectResult 数据类型
"""

from .types import Event, EventEncoder, Level, Channel, ChannelStatus, DetectResult
from .config import DEFAULT_THRESHOLDS, SENSITIVITY_MAP

VERSION = "7.8.5"
"""引擎版本号。"""

from .detector import detect
from .result_policy import decide_platform_result

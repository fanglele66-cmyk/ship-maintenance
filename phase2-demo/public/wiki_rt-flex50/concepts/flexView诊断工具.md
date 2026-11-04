---
name: flexView诊断工具
description: Wärtsilä RT-flex发动机flexView PC诊断软件的功能介绍与故障诊断用法
tags: [WECS-9520, 诊断工具, flexView, 趋势分析]
sources:
  - 源文件库/flex-50相关文档/mineru_output/fV-Operator Manual(1)/
---

所属章节：[[第5章-故障诊断]]

# flexView诊断工具

## 定义

flexView 是 Wärtsilä 为 RT-flex 发动机提供的 **PC端诊断软件**，通过 CAN/USB 适配器连接 WECS-9520 控制系统，实时显示发动机运行参数、报警信息和趋势曲线。

> flexView 不是发动机运行的必要软件——发动机可以不依赖 flexView 运行。但它为轮机员提供了强大的趋势监测，故障诊断和部件状态评估工具。

## 主要功能卡片

| 卡片 | 功能 |
|------|------|
| **Indication card** | WECS故障组、报警组实时显示 |
| **Journal** | 故障日志（含时间戳），显示报警发生和恢复时间 |
| **Exhaust Valve Card** | 排气阀开闭位置(mA)、响应死时、轨道阀切换时间 |
| **Injection Card** | 喷油量、喷油开始死时、轨道阀切换时间 |
| **User Card** | VIT/FQS调节、重载模式、喷油切断、气阀测试 |
| **Adjust Card** | 曲轴角度偏移、TDC偏移、喷油开始偏移、校正因子 |
| **LUB Cards** | 缸套润滑速率、脉冲计数、ALM状态 |
| **Bosch Card** | 伺服油轨压力、泵控制模式、故障状态 |

## 故障诊断用法

### 1. 趋势图查找不稳定值

flexView 趋势线可用于查明某个值是否不稳定。当一个参数在短时间内频繁波动时，趋势图比瞬时读数更有诊断价值。

### 2. 轨道阀切换时间判断故障

在 Exhaust Valve Card 或 Injection Card 中，**轨道阀切换时间 >3.0ms 通常表示轨道阀故障**。

### 3. 喷油曲线判断ICU磨损

通过 View → Injection curve 查看喷油曲线：
- **良好状态**：水平线和上升线之间有清晰弯折
- **磨损状态**：水平线和上升线之间有"颠簸"（Bump）

### 4. 曲柄角度传感器检查

从 View 菜单打开 CA Sensor 趋势，检查传感器信号是否正常。

### 5. 故障日志分析

Journal 直接显示报警原因和时间戳，**第一个报警通常是根本原因**，后续报警可能是连锁反应。

## 访问级别

| 级别 | 密码 | 可用功能 |
|------|------|---------|
| 操作员 | 无需密码 | 查看 Indication、Journal 等基本功能 |
| Service | flexView | 查看更详细的趋势和诊断信息 |

## 故障诊断关联

flexView 诊断工具常用于以下故障场景：

- **ICU "Stuck" 报警** → 用喷油曲线判断是否为 ICU 磨损
- **排气阀响应异常** → 用 Exhaust Valve Card 检查轨道阀切换时间
- **传感器信号不稳定** → 用趋势图定位问题
- **报警日志** → 查找第一个报警以确定根本原因

## 关联

- [[WECS-9520控制系统]] - flexView 连接的目标系统
- [[RT-flex故障排查方法论]] - 系统化故障排查方法
- [[RT-flex报警对策对照表]] - 具体报警代码与对策
- [[喷射控制单元ICU]] - 喷油曲线诊断对象
- [[曲柄角度传感器]] - CA传感器趋势检查

---

*来源：fV-Operator Manual (flexView操作手册)*

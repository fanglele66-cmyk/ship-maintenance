---
name: RT-flex控制系统培训
description: RT-flex控制系统详细培训文档，涵盖WECS-9520、FCM-20模块、远程控制、安全系统、VIT/VEC/VEO/FQS、轨阀、曲柄角度检测、冗余设计等
type: source
---

# RT-flex控制系统培训

## 元信息
- **来源**：40_RT-flex_Control-System(1).pdf
- **类型**：PDF培训文档
- **页数/大小**：21页，2.0 MB

## 内容概述

本文档详细介绍RT-flex控制系统的方方面面，包括：WECS-9520系统架构、FCM-20模块硬件与I/O、远程控制系统(Kongsberg Autochief C20)、电子调速器、安全系统、报警监控系统(Datachief C20)、轨阀工作原理、曲柄角度检测、喷射控制、排气阀控制、VIT/VEC/VEO/FQS控制函数、启动控制、燃油轨压力调节、停机功能、伺服油回路、启动阀控制、以及完整的冗余设计与应急操作方案。文档包含47张详细的结构图和原理图。

## 覆盖知识点

| 主题              | 关键内容                                              | 对应Wiki页面                |
| --------------- | ------------------------------------------------- | ----------------------- |
| WECS-9520架构     | 无中央计算机，每缸FCM-20模块，System CAN Bus，非遥控/非安全系统        | [[WECS-9520控制系统]]       |
| FCM-20模块        | 每缸一个，在线备用，高/低功率I/O，LED故障指示，模块功能分离                 | [[FCM-20模块]]            |
| 远程控制系统          | Kongsberg Autochief C20，操纵命令，慢转，速度/燃油控制模式         | [[远程控制系统]]              |
| 电子调速器           | 燃油指令计算，燃油限制器(烟度&扭矩限制)，螺旋桨特性曲线                     | [[WECS-9520控制系统]]       |
| 安全系统            | 独立于WECS，直接激活紧急停机电磁阀，CAN总线通信，冗余BUS                 | [[安全系统]]                |
| 报警监控系统          | Datachief C20，6组故障分类，CANopen/Modbus直接访问FCM-20     | [[报警监控系统]]              |
| 总线系统            | CANopen System/Module Bus、ModBus、SSI Bus，120Ω终端电阻 | [[WECS-9520控制系统]]       |
| 轨阀RV-2          | 超高速切换~2ms，通电≤4.5ms，双稳态，定期10s安全脉冲                  | [[轨阀RV-2]]              |
| 曲柄角度检测          | 双传感器，SSI总线，TDC脉冲校验，最后两个FCM为主时钟                    | [[曲柄角度传感器]]             |
| 喷射控制            | 体积控制，VIT/FQS，死时间补偿，低负荷切出1-2个喷油器，20分钟循环            | [[喷射控制单元ICU]]           |
| 排气阀控制           | VEO/VEC，双位置传感器，分隔装置隔离精滤/普滤油                       | [[气门控制单元VCU]]           |
| VIT/VEC/VEO/FQS | 可变喷油正时、可变排气阀关闭/开启、燃油质量设定                          | [[VIT_VEC_VEO_FQS控制函数]] |
| 启动控制            | 名义开0°/关110°，慢转调节，主启动阀双FCM控制                       | [[启动系统]]                |
| 燃油轨压力调节         | 前馈控制，4-20mA信号，柱塞式燃油泵死时间                           | [[WECS-9520控制系统]]       |
| 伺服油回路           | 随负载调节压力，PWM控制，不同FCM控制不同泵                          | [[伺服油系统]]               |
| 冗余设计            | FCM在线备用、双总线、双电源、双传感器、完整应急操作                       | [[WECS-9520控制系统]]       |

## 章节映射

| 文档章节 | 内容 | 对应Wiki页面 |
|---------|------|-------------|
| Control System overview | 控制系统概述 | [[WECS-9520控制系统]] |
| WECS-9520 | 发动机控制系统核心 | [[WECS-9520控制系统]] |
| Kongsberg Maritime | 远程控制系统 | [[远程控制系统]] |
| Electronic governor | 电子调速器 | [[WECS-9520控制系统]] |
| Safety system | 安全系统 | [[安全系统]] |
| Alarm monitoring system | 报警监控系统 | [[报警监控系统]] |
| FCM-20 Hardware | FCM-20模块硬件I/O | [[FCM-20模块]] |
| Rail valves | 轨阀工作原理 | [[轨阀RV-2]] |
| Crank angle detection | 曲柄角度检测 | [[曲柄角度传感器]] |
| Injection Control | 喷射控制 | [[喷射控制单元ICU]] |
| Exhaust Valve Control | 排气阀控制 | [[气门控制单元VCU]] |
| VIT/VEC/VEO/FQS | 控制函数 | [[VIT_VEC_VEO_FQS控制函数]] |
| Starting | 启动控制 | [[启动系统]] |
| Pressure Regulation | 燃油轨压力调节 | [[WECS-9520控制系统]] |
| Shutdown | 停机功能 | [[安全系统]] |
| Servo Oil Circuit | 伺服油回路 | [[伺服油系统]] |
| Redundancy/Emergency | 冗余与应急操作 | [[WECS-9520控制系统]] |

---
name: ship-oem-alarm-analysis
description: 船端 2.0 收到 OEM 硬件报警跳变后，核实本船点位和设备开关，读取同窗证据，研判是否生成待轮机长决策的报警事件。
---

# OEM 报警研判

从采集方提供的报警 JSON 开始。沿用船端 1.0 的 `alarm_type`、`ship_id`、`equipment_id`、`ser_no`、`pointDataId`、`trigger_time`、`alarm_state_transition`。时间无时区时按北京时间解析。设备和点位名称取自受信配置。当前硬件绑定为长航碧玉主机 `left_main_engine`，报警点 `DC0043`（伺服油泄漏）。其他设备必须先取得实船点位与 2.0 设备实例的明确绑定。见[演示用原报](template/trigger.example.json)。

从 `phase2-demo` 目录运行，`<运行目录>` 指目标应用的 `SHIP_DATA_DIR`。本地演练使用独立目录。默认操作只读取配置、输入和证据，结果 JSON 输出至标准输出：

```text
node .claude/skills/ship-oem-alarm-analysis/scripts/oem-event.mjs --data-dir "<运行目录>" --trigger "<原报.json>"
```

1. 检查 `outcome`。设备、点位及设备的 OEM 研判开关必须开启，且状态须从该报警模板的正常值跳至激活值，才能进入 `review`。持续激活、复位及关闭研判均为 `record-only`，无需调用模型。运行目录尚无配置时使用应用的初始配置。
2. 读取激活信号和 `report.evidence` 中触发前十分钟至触发时刻的实测与覆盖情况。开关量表示硬件发出了报警；检查原因、可能影响与尚待核实事项分开写。知识库仅使用本次实际读到的设备资料。没有同窗采样时，可基于硬件信号建议确认，写明缺少的证据，不造读数。
3. 将准备结果的 `reviewId` 原样带回。需要生成事件时返回 `{"reviewId":"…","outcome":"event","analysis":{…}}`；使用与[周期研判候选](../ship-anomaly-detection/template/ship2-analysis.example.json)相同的六个业务字段，内容围绕实际硬件报警。无需形成事件时返回 `{"reviewId":"…","outcome":"record-only","reason":"本次仅记录的具体依据"}`。加入 `--review "<研判.json>"` 可在写入前预览完整事件。
4. 业务调用明确要求落库时，增加 `--publish`，已由开关或状态决定仅记录的原报可省略 `--review`。回执包含 `outcome`、落库时间和事件 ID 或仅记录原因。SQLite 中的 OEM 原报回执绑定同一船舶与流水号；同一激活原报重试沿用既有回执，同一流水号对应不同激活证据会报冲突。复位与持续状态单独留痕。

事件交付给 2.0 的事件仓储，类型为「报警事件」，来源为「OEM 硬件报警」，起始状态为「待决策」。`brief.discovery` 和 `facts` 显示报警触发依据，`detectionReport` 保存原始身份、测点、同窗证据、分析与待派步骤。轮机长按现有决策入口安排排查，任务和正式报告由原工作流产生。本命令供明确的原报调用，默认启动服务不轮询或模拟硬件。

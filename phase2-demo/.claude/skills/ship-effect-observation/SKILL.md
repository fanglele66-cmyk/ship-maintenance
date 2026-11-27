---
name: ship-effect-observation
description: 在选定观察结束时间对所有相关传感器生成观察报告，供轮机长决策。
---

# 船端 2.0 效果观察

由后端持久化观察起止时间和事件关联。到期自动执行，重启后补跑已到期未完成任务。只取观察窗口内的数据，不读取未来采样。覆盖所选系统全部传感器，并包含转速、燃油指令等工况参照，缺测通道也必须出现在报告中。
按传感器统计覆盖、样本数、均值、范围、首末读数，判断原现象持续、回落、复发或尚不能确认；运行工况不匹配时不宣称修复完成。停机数据不能替代运行验证，未维修的观察不能称为修后恢复。
依据已提交的现场报告与本窗口数据输出 JSON {"summary":"本轮结论","analysis":"依据与解释","next":"一项首选建议"}。报告生成后交轮机长决策，不自动闭环；取消、关闭或删除的观察不得恢复。

## 页面证据与报告

宿主提供 `event.id/title/reports`（最近两份相关的非观察报告）、本轮 `plan/start/end` 和 `sensors[]`。按 `channelId/pointCode` 识别测点，并以其 `unit` 写数值。结合 `sampleCount/covered/maximumGapSeconds` 检查覆盖，使用 `firstValue/value/min/max/mean` 对照首末值和范围。`sourceKind=unavailable`、空值或零个采样表示未获得有效读数；零读数与缺测分别表述。

三项输出均为非空文本。[停机窗口示例](template/result.example.json)的前提是窗口内主机转速均为零、原现象发生于运行工况。建议应与本轮实际观测条件相符。

服务端用已保存的观察阶段 ID 关联报告（`observationReportId`），将 `summary`、正文 `markdown` 与 `observationSnapshot.plan/windowStart/windowEnd/sensors` 写入报告记录。曲线取自原始测点证据，报告编号、图表和时间戳由宿主填写。事件助手里的即时“观察建议”返回普通文本，独立观察报告由到期任务生成。

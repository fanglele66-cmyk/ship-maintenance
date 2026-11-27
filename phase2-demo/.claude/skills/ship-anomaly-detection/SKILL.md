---
name: ship-anomaly-detection
description: 启动时及每小时检测最近六小时主机数据，整理检测证据和待轮机长核实的事件。
---

# 船端 2.0 周期异常检测

本入口形成的事件类型统一为“预警事件”。人工上报为“报警事件”；长周期固定基线的“异动跟踪”由 ship-health-score 独立处理，不在本小时任务中执行。

入口为 scripts/run_local_detection.py，通过本地只读数据库构造 pointDataList，再调用保留的 engine.detector / longhang_engine 检测引擎。保留原统计、深度学习及停机工况路由。原船端契约见 references/original-skill.md，仅供算法来源参考，不运行旧发布器。
时序数据库默认在 `deployment-data/telemetry`，可由 `--telemetry-dir` / `SHIP_TELEMETRY_DIR` 指定。`--data-dir` 表示可写运行目录，检测输入及产物必须处于该目录内；运行目录可以位于源码之外，算法与船舶配置仍从项目目录读取。没有独立数据包的旧安装仍可读取运行目录中的 `manifest.json`。
由服务端按启动时间调度，每小时一轮；每轮独立目录，保留最近六份完成产物。只对 confirmed 检测信号形成事件候选，confirmed 指信号触发成立，不代表设备故障已确认。各通道不可用的原因写入内部检测结果，不能用“未检出”冒充完整检测成功。
根据检测证据和本地知识生成 title、summary、interpretation、unverified、recommendation、steps JSON。严格区分检测现象、运行工况、待核实原因与已确认故障。第一责任人是轮机长。持续同一信号更新证据，不重复派工，不覆盖人工任务或备注。不自动闭环。
正常使用实时研判语气，不向使用者解释复刻、回放等工程实现。未取得的业务证据如实保留待确认。不得虚构读数或确定维修参数。

事件 title 仅描述设备、测点和异常现象，不带“待核实”“待核查”等状态后缀；证据缺口和未确认的原因保留在分析及待核实事项中。

## 研判与交付

研判输入为 `report`、服务端拉取的 `evidence`、`detection.devices[].events[]` 和检索到的 `knowledge`。用信号的起止时间、通道、测点和同窗测量解释现象；核对转速、负荷及数据覆盖后再列可能原因。只依据本次取得的知识来源拟定检查。缺少工况或采样时，将具体缺口写入 `unverified`。算法分数不作故障概率。

模型只返回一个 JSON 对象，包含 `title`、`summary`、`interpretation`、`unverified`、`recommendation` 与 `steps[]`。每步给出 `label`、`guide`、`checks[]`、`recordHint`。前端用这组字段显示初始分析、待核实项和待派排查方案。身份、状态、时间、证据、去重及报告归档由应用写入。例见 [周期研判候选](template/ship2-analysis.example.json)。

每轮目录内 `sensor-raw-data.json` 是采样输入，`detection.json` 是算法输出，`receipt.json` 记录完成时间、行数和本轮关联的事件 ID。比较不同轮次时以设备、通道、事件类型和测点集合识别同一信号；同一未闭环事件只更新最新信号及检查时间。只有当前点表能映射到实例的测点才可进入新事件。详情页读取 `detectionReport.analysis`、`evidence` 与 `brief.discovery`；已有操作记录保存在对应事件中。

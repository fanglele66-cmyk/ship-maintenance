# 知识库驱动的异常分析正文生成

本步骤只由 Agent 执行。检测器已经给出事件身份、工况、统计证据、点位和查询请求；Agent 不重新计算分数，不改事件身份，也不推测尚未取得的现场结果。

## 1. 读取顺序

1. 完整读取准备文件中的当前 `analysis_request`，记录事件对象、工况、持续时间、`raw_score/threshold`、关联点位和 `operating_context`。
2. 必须先从 `data/ship-profile.json` 和 catalog 解析当前设备知识包入口，再按事件对象检索并完整读取 1～3 份直接相关的正文。不得只依据文件名、搜索片段或旧会话记忆写作。
3. 优先顺序为：当前设备系统原理/厂家说明 → 本船测点资料 → 同类排故章节或案例 → 通用方法论。知识页面与当前机型不一致时只能作为排查思路，不能照搬数值。
4. 在 `analysis_basis` 的 `knowledge` 项中写出本轮从配置知识包实际读取的 Markdown 路径，以及这份资料支持的具体机理、风险或排查动作。

## 2. 结论边界

- 08 跨通道门槛成立，只能表述为“算法异常成立”或“持续异常证据成立”。
- 没有现场反馈或已确认故障标签时，不得把候选原因写成已确认根因。
- 对起停、负荷切换、暖机、冷却延迟等工况，先判断是否存在合理物理解释，再判断最终运行结果是否异常。
- `raw_score/threshold` 是相对健康分布的偏离强度和事件门槛，不是温度、压力、转速，也不是故障概率。
- 正常工况解释与真实故障并不互斥。摘要必须写清楚“哪一段现象可由工况解释、哪一个结果仍异常、需要什么证据才能收敛”。

## 3. 各字段写法

### summary

仅保留简短的当前判断边界及“下一步：”后的具体行动。说明先查什么、怎样核实，避免空泛的“请现场确认”。不再重复船舶、设备、上报时间、取数次数、样本统计、分数或完整原因清单；这些事实保留在 `analysis_basis` 和 `engineering_inference`。取消至少 140 字要求，不为凑字数重复内容。

### fault_causes

- 生成 2～5 个彼此可区分的候选原因，按现有证据排序。
- 每个原因的 `basis` 合并成一条具体依据，必须同时提到当前事件证据和知识机理；不能只复述原因名称。
- `probability` 只是 `low/medium/high` 的相对排序。`probability_score` 由发布器映射，Agent 不填写。
- 在测量链路尚未由冗余测点或独立仪表排除时，保留传感器、接线或采集链路原因，但不得为了凑数量机械加入。

### engineering_inference

用 3～6 步形成可审计推断链。每步只提交 `observation/inference/basis_ids`：当前观察、物理解释、关联信号、缺失信息和当前结论必须前后相连。`order` 由发布器按数组顺序生成。

### analysis_basis

至少包含 `sensor_trend`、`baseline_comparison`、`operating_condition`、`knowledge`、`rule` 五类，必要时增加 `cross_signal`。点位 ID 和时间窗由发布器绑定，Agent 只写 `basis_id/basis_type/title/description`。

### diagnostic_plans

- 先读取 [排查写作要求](../output/diagnostic-writing.md)，由模型根据本次事件证据和实际读取的知识正文编写 2～5 个任务；每个任务对应一个已列出的 `cause_id`。
- 一级任务围绕候选原因，二级 2～4 个 `steps[].action` 分解该原因的部件或故障环节等不同排查方向，三级 `inspection_items[]` 写如何执行该方向；不能用“准备、检查、复测”等通用流程阶段代替排查方向。
- 每步由模型按需要选择 2～4 个事项，提交 `inspection_item_id/title/content/item_type`。具体工具、准备操作、方法、判据和记录要求按需写入 `content`；安全条件写入 `safety_notes`，任务整体完成要求保留在 `completion_criteria`。不输出 plan 的 `tools/prerequisites` 或 step 的 `method/acceptance_criteria/evidence_to_record`。
- `item_type=operation` 不带结果选项或答案字段；需要检查结果的事项使用 `inspection`，必须提供 `options`。选项使用 `code/label/abnormal`，保留 `normal/false` 和 `abnormal/true` 两个状态，`label` 由模型按具体判断编写。`answer_type/required/answer` 及步骤反馈初值由发布器生成。
- 参考图只在已读取知识正文且图片直接支持当前结构或动作时引用；没有强相关图时使用空数组。

## 4. 失败处理

候选未通过 Schema 或质量门禁时，根据错误修复一次并重新校验。知识读取、模型生成或修复后校验仍失败时，保留准备文件及失败原因，停止本次发布，等待重新生成合格候选。不得通过 `--fallback` 发布固定脚本或模板派生的分析与排查任务。

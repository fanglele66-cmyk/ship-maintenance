# Agent 内容候选契约

## 职责分界

发布器固定生成并覆盖：`ser_no`、`event_id`、`event_type`、`created_at`、船舶/设备字段、`anomaly_type`、`severity`、`workflow_state`、`manual_follow_up_feedback`、`data_query_requests`、分析置信度、原因展示分数、步骤顺序、检查结果交互状态和反馈初始值。`manual_follow_up_feedback` 在 AI 周期和人工上报的新分析中固定为 `null`，人工反馈成功后由事件工作流同步备注与提交时间。inspection 的 `options[].label` 属于模型编写的业务内容，发布器保留通过校验的选项文字。

`data_query_requests[].points[]` 的数据概览名称分两列输出：`pointName` 为英文名称，`pointName_ch` 为中文名称。例如 `{"pointName":"ME NO.6 Exhaust gas temp.after cylinder","pointName_ch":"6缸排气温度"}`。发布器使用本船显示名称映射生成，前端第一行读取 `pointName`、第二行读取 `pointName_ch`；结构化 ID、单位、API 参数保持原契约。事件概览、排查和维修正文中的传感器仅使用中文名称，不再拼接英文。

Agent 候选只允许：

```json
{
  "event_id": "从准备文件逐字复制",
  "summary": "知识库驱动的事件摘要",
  "fault_causes": [],
  "engineering_inference": {},
  "analysis_basis": [],
  "diagnostic_plans": []
}
```

具体结构以 `template/agent-analysis-content.schema.json` 为准。多事件候选由 `template/agent-analysis-bundle.schema.json` 包装：

```json
{"run_id":"从准备文件逐字复制","events":[{"event_id":"...","summary":"...","fault_causes":[],"engineering_inference":{},"analysis_basis":[],"diagnostic_plans":[]}]}
```

不得在候选中出现 `workflow_state`、`manual_follow_up_feedback`、`ser_no`、`created_at`、`ship_id`、`deviceDataId`、`systemType`、`severity`、`data_query_requests`、`probability_score`、`order`、`answer_type`、`required`、`answer`、`feedback_text` 或 `feedback_image_ids`。发布器发现这些字段会拒绝候选，不做静默修复。

`schemeTitle` 只写简短中文名词短语，概括候选原因或对象，例如“控制空气泄漏”“1缸温度测量链路”“停机前温度趋势”；不含“排查、检查、核实、核对、验证、确认”等动作词，不写执行句。动作、方法和判断要求放在步骤及事项正文中，任务名称仍由模型结合事件与知识生成，不由脚本删词或拼接。

排查结构按 [排查写作要求](diagnostic-writing.md) 使用“候选原因 → 排查方向 → 具体事项”。每步有 2～4 个 `inspection_items`，事项必填 `inspection_item_id/title/content/item_type`。`operation` 不带 `options`；`inspection` 必填两个 `options`，分别为 `{"code":"normal","label":"模型编写的本事项正常结果","abnormal":false}` 和 `{"code":"abnormal","label":"模型编写的本事项异常结果","abnormal":true}`。发布器仅为 inspection 补齐 `answer_type=single_choice/required=true/answer=null`。

人工上报、AI 周期和 OEM 统一使用当前排查结构，候选、结果和消费端均不接受 `question`、plan 的 `tools/prerequisites` 或 step 的 `method/acceptance_criteria/evidence_to_record`，不保留旧格式兼容；将必要细节写入事项 `content`，安全要求写入 `safety_notes`。模型必须先读取本次事件证据和相关知识正文，缺少合格候选时不发布固定脚本或模板内容。

## 标准命令

```powershell
python .claude/skills/ship-anomaly-detection/scripts/prepare_anomaly_analysis.py --workspace . --ser-no <ser_no>
python .claude/skills/ship-anomaly-detection/scripts/validate_agent_analysis.py --workspace . --preparation <preparation-ref> --analysis-json <candidate-ref>
python .claude/skills/ship-anomaly-detection/scripts/publish_anomaly_analysis.py --workspace . --preparation <preparation-ref> --analysis-json <candidate-ref>
```

准备命令不写事件业务文件。发布命令会用准备时相同的输入和时间重新执行确定性检测，并要求候选事件 ID 与当前事件计划完全一致；不一致即零业务写入。

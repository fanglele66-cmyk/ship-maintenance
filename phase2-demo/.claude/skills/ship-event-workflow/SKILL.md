---
name: ship-event-workflow
description: 根据船端 2.0 事件当前阶段、逐步反馈和正式报告生成或编辑轮机长的待派任务方案，支撑派工表单、事件时间线与后续报告关联。
---

# 事件流转与待派方案

服务端在轮机长打开待派方案或修改草稿时调用。输入使用本轮 `event`、`pendingTask`、`decision`、`requiredCarryForward`，有观察记录时另有 `observations`。先确认当前决定、已经回交的任务和关联报告，再确定本轮工作范围。历史阶段、知识案例、对话和待派草稿都不能替代本轮船员反馈。

- 首次排查针对原事件触发证据设计核对方法。继续排查交代上轮已排除的方向和剩余疑点。维修或提前维保围绕获批部位和操作条件。复查分别处理“核实后继续观察”和“维修后验证效果”，前者可能尚未维修。
- 对 `requiredCarryForward` 中保留的未执行项沿用原步骤标题，注明继续实施的条件；已执行但原因仍待查的项目，写入判断依据。措施、读数、已更换部件和许可状态均须有本次记录支持。
- 创建方案时仅输出 JSON 对象 `{scope,rationale,steps}`。每个步骤提供 `label,guide,checks,recordHint`。用 1–4 项可独立回交的步骤覆盖本轮范围。标题说明对象，checks 列出核查内容，recordHint 说明需记录的现场结果或受限原因。按任务类型显示的选项、轮次和负责人由应用填写。见[待派方案示例](template/plan.example.json)。
- 收到 `editConstraints` 时，仅输出 `{"operations":[...]}`。以用户看到的原清单从 1 编号，用 update、remove 或 insert；insert 的 after=0 表示最前面。修改字段限 label、guide、checks、recordHint。保留未要求更改的步骤、顺序及原措辞。见[单项编辑示例](template/edit.example.json)。按序号进行单纯保留或删除时，界面也可直接执行确定性编辑。

模型只返回供预览的内容。应用以 pendingPlan 的 key/version 和当前可选动作接受方案。只有轮机长确认派工后才建立任务；执行人正式回交后生成本次报告，再由轮机长决定后续动作。对话、草稿、报告生成失败或单独的一个检测结果都不能推进状态。

核对状态、权限、重试和文件关联时，见[事件到页面的字段](references/flow.md)。

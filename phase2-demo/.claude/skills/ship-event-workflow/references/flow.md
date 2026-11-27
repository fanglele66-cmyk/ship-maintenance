# 流转与页面字段

| 环节 | 用作依据的字段 | 由应用产生的结果 |
| --- | --- | --- |
| 事件详情与决策 | event.id、number、type、phase、status、brief、phases；当前任务及其已提交结果 | `lifecycleDecisionOptions(event)` 给出当前可选动作。在 reminder 可派发排查或判为误报；其他阶段根据实际执行结果决定维修、继续排查、维保、复查、观察、等待或闭环。上报岸基沿用独立快照。 |
| 待派草稿 | pendingTask.action、scope、rationale、steps；编辑时使用 editConstraints | `normalizeTaskPlan` 规范化步骤，`acceptTaskPlan` 校验草稿版本。只改变 pendingPlan，过期请求重新读取当前草稿。 |
| 轮机长确认 | 选定 action、执行人、要求完成时间或本次决策所需依据 | `decide` 追加 decisions、phases；派工时创建 tasks 并设置 currentTask。新任务保留派发范围与来源。 |
| 执行人回交 | 本人已派任务的逐项结果、备注、照片及总结 | 当前任务提交事实；以 taskId、reportId、submissionNumber 关联本次报告和时间线。AI 后续补充只能写回原报告。 |
| 观察与闭环 | 已提交的来源报告、观察计划、实际窗口，或轮机长确认的闭环依据 | 观察子事件保留 parentEventId、sourceTaskId、sourceReportId。其到期报告触发复核，只有经确认的闭环决定归档。 |

共享事件经过带会话身份的 `POST /api/workflow/save`，请求为 `{event,revision}`。版本冲突时从服务器刷新，由现有同步逻辑合并并重新校验；不得用旧事件覆盖新的派工。相同的报告生成重试绑定原 reportId 和提交版本，恢复后的新一轮回交有自己的报告。浏览器演示事件沿用原工作区。文件中的状态只供阅读，流转通过原业务入口执行。

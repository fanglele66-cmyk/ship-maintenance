---
name: ship-mcp-anomaly-analysis
description: 船端 2.0 备用流程。宿主已接入检测小模型 MCP 时，核对本船设备、训练特征和推理窗口，结合船端原始数据输出可复查的预警证据。
---

# 小模型 MCP 异常研判（备用）

本包位于 `.claude/skills-MCP`，供显式接入的宿主使用。2.0 常规小时检测继续走 `ship-anomaly-detection`。本包已适配 1.0 已验证的长航碧玉主机 `native_maf_h128_b7_n1`，此模型使用有序 52 维特征，RT-flex50 模板中还有未参加该模型训练的点。

## 获取推理结果

从用户请求或调度载荷取得船舶、设备、工作空间任务、原始时间窗和本轮流水号。时间为北京时，左闭右开。使用宿主注册的 `ship_analysis_list_ships`、`ship_analysis_list_workspace_tasks`、`ship_analysis_list_points` 核对目标和绑定，再调用 `ship_analysis_run_inference`。历史窗口使用 `dataSource: "ch"`。按实际工具定义传递以下字段，保存原样请求、完整响应及同一轮输入宽表：

```json
{"shipId":"900000000000000101","deviceId":"900000000000000202","taskId":"<已绑定的任务>","serNo":"<本轮流水号>","dataSource":"ch","startTime":"2026-04-30 16:00:00","endTime":"2026-04-30 17:00:00","publishToWorkspace":false,"cleanupEnabled":false}
```

可使用宿主已授权的推理工作空间归档输入和输出；此时将 `publishToWorkspace` 设置为 `true`，核对 `runId` 与 `publishedPaths`。若推理请求结果未知，先按同一流水号查询，再决定是否重试。无 MCP 连接时，可以用已有请求和响应在本地重放以下核验步骤，并标明数据来源。

## 校验与本船回查

在 `phase2-demo` 下运行，以下 `<S>` 表示 `.claude/skills-MCP/ship-mcp-anomaly-analysis/scripts`：

```text
python <S>/mcp_verify.py --request infer-request.json --response infer-response.json --workspace-root "<推理工作空间>" --output verified-rows.json
node <S>/read-local-evidence.mjs --verified verified-rows.json --data-dir "<船端运行目录>"
```

未归档输入时，使用同船、同设备、同窗口的独立宽表查询，第一条命令的 `--workspace-root` 换为 `--window "<查询回包>" --window-request "<查询请求>"`。验证器沿用 1.0 特征顺序，逐行复核时间轴、总分、逐点阈值和分类；若服务返回顺序编号，则映射为对应的真实 DC 编码，保留两套编号。工具报错、序号/行数冲突、窗口不匹配或模型未经适配时停止业务研判并保留原报。

第二条命令输出独立的本地证据 JSON，`evidence[].sensors` 对应 2.0 现有检测证据的 `channelId/pointCode/sampleCount/covered/min/max/mean/trendData`。回查异常前后各十分钟及同期工况，窗口重叠时合并。没有异常行时，输出请求窗口内模型特征的采样覆盖。对照 `verified-rows.json` 的 `runId/modelName/rows[].sampleTime/dimensions`；模型分数不能填入工程数值，补齐的模型输入也不能当作实测。

交付推理行数、超限时刻与点位、原始观测、工况和缺口。需要事件研判时据此写出与 [2.0 周期检测](../../skills/ship-anomaly-detection/SKILL.md)相同的六个候选业务字段，注明原始产物和推理轮次，以本船证据决定是否建议核查。备用命令只出证据和候选，既有小时检测调度、事件存储和报告发布流程继续由原宿主管理。

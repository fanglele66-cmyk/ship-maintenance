# 人工事件 Agent 分析

先读取准备文件 `report`、`evidence` 和 `analysis_request`，再按 `knowledge_search.index_ref` 检索并读取与本事件有关的知识 Markdown。同时读取 [排查写作要求](../../ship-anomaly-detection/references/output/diagnostic-writing.md)。这些要求也适用于原上报时间窗的逐点覆盖门禁已合格、但无算法候选的人工事件。

准备文件的 `evidence.trends` 是全部上报测点统计，`related_trends` 和 `sensor_samples` 是可用关联测点统计与采样值。先确认每个上报传感器在原上报时间窗内的有效数值样本覆盖率均达到 50%，再开始 Agent 分析。缺少任一上报点、覆盖不足、无可用样本或旧准备文件标记 `raw_fallback.used=true` 时必须停止发布，不能通过补写“历史回放”说明继续创建事件；不得篡改准备文件或将其他时间的数据作为本次证据。

在线取数以 `evidence.fetch_attempts[].status`、`coverage` 和逐点证据为准。每个已选传感器在原窗口内的覆盖均达到 `0.5` 才表示数据可用；合并后的全局跨度不能替代逐点门禁。在线默认最多尝试 3 次仍不合格时，工作流停止，不进入 Agent 分析或创建事件。数据合格但首尾未完全覆盖时，应分析已取得的窗口内样本并披露实际范围、逐点覆盖率及首尾缺口，不能外推整个上报窗口或宣称连续完整。发布器会重新校验证据并补入确定性的覆盖依据，将趋势依据限定为实际范围；事件时间和查询时间始终保持原上报范围。

候选使用相邻 AI Skill 的 `template/agent-analysis-content.schema.json`，只包含 `event_id/summary/fault_causes/engineering_inference/analysis_basis/diagnostic_plans`。逐字使用准备文件的 `event_id`，写入返回的 `candidate_ref`；不得修改准备文件或正式结果。复用 schema 不代表允许启动 AI 周期检测。

`summary` 仅保留简短判断边界和“下一步：”后的核实行动。人工上报属性、取数过程、统计事实和候选原因分别保留在 `analysis_basis`、`engineering_inference`、`fault_causes`，不要在建议中重复。`analysis_basis` 必须说明“人工上报”，并覆盖所有已选系统和传感器的相关证据；旧 `systemType` 只是首项兼容字段，应以 `systemTypes[]/systemNames[]` 或准备映射的 `system_ids[]/system_names[]` 完整集合组织跨系统分析。人工受理状态由发布器固定，Agent 不能把没有验证的候选根因写成已确认故障。缺少健康基线、工况记录或阈值时，在相应依据条目中明确缺失，不为满足 schema 编造事实。

`schemeTitle` 只写简短中文名词短语，概括候选原因或对象，例如“控制空气泄漏”“1缸温度测量链路”“停机前温度趋势”；不含“排查、检查、核实、核对、验证、确认”等动作词，不写执行句。动作、方法和判断要求放在步骤及事项正文中，任务名称仍由模型结合事件与知识生成，不由脚本删词或拼接。

原因和任务必须相互对应；由模型结合本次人工上报证据和实际知识正文选择 2～5 个有区别的候选原因及任务。一级任务对应原因，二级每任务 2～4 个 `steps[].action` 区分该原因下的部件或故障环节等排查方向，不能按准备、检查、复测等通用阶段拆分。三级每步由模型选择 2～4 个具体事项，提交 `inspection_item_id/title/content/item_type`；方法、必要工具和准备、判断及记录要求写入 `content`，安全条件写入 `safety_notes`，任务完成要求保留 `completion_criteria`。不输出 `question`、plan 的 `tools/prerequisites` 或 step 的 `method/acceptance_criteria/evidence_to_record`。

无需选择检查结果的事项用 `operation`，不带 `options/answer_type/required/answer`；需要检查结果的事项用 `inspection`，必须由模型生成两个 `code/label/abnormal` 选项，保持 `normal/false` 和 `abnormal/true` 的状态语义，具体 `label` 根据事项编写。候选不带交互初值，发布器仅为 inspection 补齐 `single_choice`、必填和空答案。人工上报、AI 周期和 OEM 的生成、发布及消费统一使用当前结构，旧排查字段一律拒绝，不保留兼容分支。

每个任务针对本次设备、中文测点名或明确部件。给出需查阅的具体手册来源，工程数字有据可查。正文没有几十字上限，事项标题尽量简短，保留识别对象所需的完整中文测点名。

排查正文的传感器统一使用本船显示名称表中的中文 `display_name`，不拼接英文，也不以编号或采集 key 代替名称，不在名称后附带 `pointDataId`、`pointCode` 或“映射点”编号范围。内部编号继续保留在结构化字段中供查询与追溯；收到点位编号校验错误时修正候选正文，不改准备文件或映射配置。

发布失败时根据具体错误修复候选一次后重试。知识读取、模型生成或这次修复仍失败时，保留原准备文件及失败原因，停止本次发布并等待重新生成合格候选；不得通过 `--fallback` 发布固定脚本或模板派生的分析与排查任务。不能把“当前没有同点候选”或“真实根因尚不确定”当作失败。

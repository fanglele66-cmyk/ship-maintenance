---
name: ship-manual-anomaly-analysis
description: 处理当前配置船舶在船端或岸基人工提交的异常报告。复用 profile 配置的 loader/detector，按标准传感器接口取得指定时间窗数据，并按本次 ser_no 创建独立人工事件；同一 ser_no 重试只复用自身事件。
---

# 人工异常分析

事件目录约定：新建 AI/人工事件使用 `ai-<ship_id>-<ser_no>`，OEM 使用 `oem-<ship_id>-<ser_no>`；文中的 `<event_folder>` 指对应短目录名。仅目录名去掉末尾时间后缀，`event_id`、业务文件名及输入/反馈文件名保持不变；ser_no 唯一，一个短目录对应一个事件，既有长目录兼容读取。

处理船端或岸基页面已经人工确认需要上报的异常。只有原上报时间窗的数据通过覆盖门禁后才能创建事件；成功事件的业务结果固定为 `anomalyDetected`，分析依据必须明确标记“该事件为人工上报”，并进入事件排查流程。省略发送端时默认船端。人工上报、AI 周期和 OEM 分析统一使用当前排查 Schema 和模型生成规则，生成、发布及消费均拒绝旧排查字段，不保留旧格式兼容分支。

人工 runner 创建或复用 AI 命名事件后，后端为该 `event_id` 创建或复用专属事件会话，并发送可见首行“查看事件”；船舶 ID、事件 ID 和 `Skill：$ship-event-workflow` 必须放入末尾 `<yincang>` 隐藏块。人工上报表单与事件欢迎是两个动作，不得把内部事件路由字段展示在前端。

## 固定提示词

只接受 `references/prompt-contract.md` 中的固定字段、顺序、全角冒号和末行 Skill。不要从自由对话猜测缺失字段。

收到符合该契约的当前用户消息后，直接把当前消息作为本次唯一输入完成解析、取数、分析、发布和清理。不要先复述、改写或另存一份提示词，也不要要求用户再次提交。一次调用只执行一次工作流。

```text
提交异常报告
船舶ID：<data/ship-profile.json.shipId>
ser_no：873247549912068096
发送端：船端
设备：主机
系统：排气系统
关联传感器：2缸排气温度
异常开始时间：2026-08-31T10:30:00
异常结束时间：2026-08-31T11:00:00
异常描述：人工观察到2缸排气温度持续偏高。
图片：manual-image-001,manual-image-002
Skill：$ship-manual-anomaly-analysis
```

`ser_no` 是后端随本次人工上报提供的必填业务流水号，只允许字母、数字、下划线和连字符。必须先完成该字段校验，再执行映射、在线取数或任何业务写入；缺失、空白或格式非法时整次人工上报停止。

`图片` 只接收前端上传后返回的图片 ID 字符串，不接收本地路径、文件名或 `file_id|file_name|file_path` 对象；没有图片填“无”，多张图片使用英文逗号分隔。解析后按顺序去重并保存到人工事件 analysis result 顶层 `image_ids[]`，本 Skill 不校验本地文件是否存在，也不移动或删除图片。

Claude Code 正常入口是当前消息直达工作流；如需调用 bundled runner，应通过标准输入把当前消息交给 `--prompt-stdin`，不得为此创建中间 `.txt` 或 `.json`。`--prompt-file` 和 `--input-file` 仅保留给无法直接传递当前消息的外部后端，三种入口不得混用。

## 正常执行：准备、Agent 分析、发布

本 Skill 由读取本文件的宿主 Agent 执行。一次上报只准备一次数据；准备成功后由 Agent 读取证据和知识正文，编写内容候选并发布。Python 负责取数、校验和写入，不会自行调用模型。

1. 把当前完整表单原样送入准备入口，不另存或改写提示词：

```bash
"$PY" -B -X utf8 "$WORKSPACE/.claude/skills/ship-manual-anomaly-analysis/scripts/run_manual_anomaly.py" --workspace "$WORKSPACE" --prompt-stdin
```

2. 若返回 `stage=existing_event`，表示本次 `ser_no` 的事件已经存在；幂等返回该事件，不重新分析或覆盖已填写的排查、维修与总结。若返回 `stage=analysis_required`，这是中间状态，必须继续以下步骤，不把它当作任务完成。
3. 读取返回的 `preparation_ref`、`content_guidance_ref` 和 `knowledge_search.index_ref`，检索并读取实际相关知识正文。按 [references/agent-analysis.md](references/agent-analysis.md) 由大模型结合本次事件证据组织摘要、原因、推断链、依据和具体排查任务，只写入返回的 `candidate_ref`。排查采用“候选原因 → 不同排查方向 → 具体事项”的三级结构，每步 2～4 个 `content/item_type` 事项；operation 无选项，inspection 必须生成具体结果 `options`。已选测点的数据覆盖全部合格但无算法候选时，仍应分析现有证据和限制，不使用固定脚本或模板派生任务。
4. 调用发布器。其先重新校验准备证据的原上报时间窗、逐点覆盖率、完整候选和写入集合；错误时不写业务文件。根据具体错误修复候选一次后重试：

```bash
"$PY" -B -X utf8 "$WORKSPACE/.claude/skills/ship-manual-anomaly-analysis/scripts/publish_manual_analysis.py" --workspace "$WORKSPACE" --preparation "<preparation_ref>" --analysis-json "<candidate_ref>"
```

5. 知识读取或模型生成失败，或候选按错误修复一次仍不合格时，保留同一准备文件及实际失败原因，停止本次发布并等待合格候选。不得通过 `--fallback` 发布固定脚本或模板派生的分析与排查任务。

模型生成并通过校验的结果标记 `content_source=agent_knowledge`。禁止复制模板后冒充模型候选；禁止把“无同点候选”或“报告属于人工上报”视为模型失败；已选测点缺失或覆盖不足属于数据门禁失败，必须停止准备和发布。准备文件保留目标及关联测点统计和样本，发布直接使用这份证据，不重新取数或触发检测。

- 人工链路只导入相邻检测 Skill 的 loader、detector、types、schema 和纯组装函数；不得启动周期检测、周期 sync 或周期事件发布。
- 严禁创建 `result/ai-anomaly/outputs/ai-run-*`、更新 `result/ai-anomaly/fetch-state.json` 或向 `input/sensor-raw-data/` 追加周期 raw。
- `periodic_detection_guard.ok` 必须为 `true`；失败即停止，保留现场，不手工补写业务文件。
- 正式发布成功才返回最终结果。候选和准备文件仅在成功发布后清理；失败或 dry-run 保留证据用于修复。

## 固定流程

1. 严格解析并校验必填 `ser_no`、其他表单字段和北京时间无时区 ISO 8601 时间；流水号门禁必须先于映射和取数。历史带 `Z` 或时区偏移的输入仍兼容读取并归一为北京时间。
2. 从 `dataSource.pointMappingPath` 指向的产物逐项映射中文设备、系统和传感器；每个名称必须唯一解析，且必须属于 profile 配置的可分析设备。系统和关联传感器均支持顿号、中文逗号或英文逗号分隔，按输入顺序去重。所有已选传感器必须属于表单设备及任一已选系统，不能把多系统表单擅自缩减成某一个系统。表单设备和完整系统集合是权威输入，analysis result 固定使用映射后的 `deviceDataId/equipment_id/equipment_name`，通过 `systemTypes[]/systemNames[]` 保留完整系统集合；旧字段 `systemType` 仅兼容保留首个系统 ID。准备映射保留 `system_ids[]/system_names[]`，旧 `system_id/system_name` 为首项；不得被算法候选改写。
3. 输入时间按北京时间钟面值原样用于接口取数，不做加减 8 小时换算，按开始到结束的完整时间窗取数，不再按 30 分钟拆分；同窗数据超过一页时继续分页。
4. 按完整窗口请求，写入 `result/ship-manual-anomaly-analysis/raw/<run_id>/`。人工入口使用 `minimum_coverage_ratio=0.5`：在原上报时间窗内，逐个已选传感器计算有效数值样本的最晚与最早时间之差，除以上报窗口时长；所有已选点覆盖率都达到 50% 才采用该数据。不得用不同点的合并时间跨度掩盖某点缺失，也不得用窗口外样本补足覆盖。覆盖不足、缺少任一已选点、无有效数据或接口失败时默认最多尝试 3 次，仍失败立即停止，不生成待发布准备文件、不创建或更新事件、不发布成功 manual-run。严禁自动从 `input/sensor-raw-data/` 复制历史 raw 继续创建事件。实际范围、逐点覆盖率和首尾缺口保留在取数证据中，发布时重新校验并写入分析依据；时间跨度覆盖率不代表连续完整采样。该门槛仅适用于人工入口，周期取数保留原完整窗口校验。
5. 对成功 raw 仅在当前人工 runner 进程内导入相邻 `ship-anomaly-detection` 的 loader、detector、00-08 检测模块、点位身份和 schema；禁止触发其正常周期入口、在线 sync、周期 result 或周期事件发布。
6. 人工上报是强业务先验：优先聚合与所选传感器同点或同机理组的算法候选；已选传感器在原上报窗口内的数据覆盖全部合格但没有候选时，仍可生成“人工上报待排查”证据，置信度不低于事件门槛并固定 `confirmed=true`；无合格数据时不得创建事件。`data_query_requests` 只返回一个覆盖完整上报时间窗的 numeric 请求，必须按顺序去重并保留全部上报传感器，不得由算法候选替换，也不得因超过 6 个而截断或拒绝。额外补充关联点时尽量使总数达到 2～6 个；上报点已经超过 6 个时保留全部上报点。此规则仅放宽人工事件，AI 周期和 OEM 仍保持 2～6 个点。
   数据概览点位的 `pointName` 为英文名称，`pointName_ch` 为中文名称，由发布器按本船显示名称映射生成；前端分别绑定第一行和第二行。排查、维修及事件概览正文中的传感器仅使用中文名称，结构化 ID 不变。
7. 机理分析优先解释部件或介质过程异常，同时保留传感器/采集链路漂移这一替代解释；分析依据固定说明“该事件为人工上报”，人工事件受理状态保持确认，但真实故障及根因没有证据时必须写成待核实。
8. 新建人工事件使用与 AI 周期事件一致的 `ai-<ship_id>-<ser_no>-<event_start_YYYYMMDD_HHMMSS>` 命名；`ship_id` 必须在本次运行时读取根 `data/ship-profile.json.shipId`，不得从算法注册表、Skill 示例、会话历史或旧事件 ID 推断，其中 `ser_no` 来自本次提示词；省略发送端或 `船端` 使用 `ship-manual`，`岸基` 使用 `shore-manual`。两类事件都写入：
   - `result/ai-anomaly/events/ai-<ship_id>-<ser_no>/<event_id>__event.json`
   - `result/ai-anomaly/events/ai-<ship_id>-<ser_no>/<event_id>__anomaly-analysis-result.json`
   - `result/ai-anomaly/active-events.json`
   每个新的 `ser_no` 都创建独立人工事件，即使发送端、设备、系统、测点和时间与旧活跃事件一致，也不按连续异常跨订单复用旧 `ser_no/event_id`。船端与岸基保留各自的 `ship-manual/shore-manual` 类型，不改写为 `ai-anomaly`；不同订单及不同发送端必须使用不同 `ser_no`。
   同一 `ser_no` 重试时只查找该流水号的既有事件，包括旧式长目录；即使本次计算的事件开始时间变化，也返回该流水号原有 `event_id`。event 与 analysis 两份文件的流水号、来源、船舶和设备身份必须一致，已有系统及上报测点集合也必须匹配；冲突或一个流水号对应多个事件时停止，不覆盖原事件。保留后续排查记录，不重新分析；本次取数覆盖门禁仍须通过。
9. 新事件正式发布时将本次运行结果写入 `result/ship-manual-anomaly-analysis/outputs/`，字段与 AI 周期结果保持一致，成功运行的 `summary.result_status` 为 `anomalyDetected`；同一 `ser_no` 幂等重试直接返回既有事件引用，不另写成功 manual-run；数据门禁失败不产生成功结果。
10. 无论成功或失败，都只清理 `result/ship-manual-anomaly-analysis/raw/<run_id>/` 内本轮临时 JSON；不得清理 `input/sensor-raw-data/`、AI 事件目录或其他 Skill 产物。

## 运行约束

- 正常运行先在线准备，再由宿主 Agent 生成并发布；用户明确要求预演时发布器使用 `--dry-run`。
- 当前消息已经包含完整固定表单时立即执行，不先向用户输出一份“整理后的提示词”，也不创建中间提示词文件。
- `--raw-input` 只用于显式测试或离线输入，它会把指定 raw 复制到本轮临时目录后走同一分析和清理链；同样必须通过原上报时间窗的逐点 50% 覆盖门禁，不能使用其他时间的数据代替。
- 缺少、空白或格式非法的 `ser_no` 必须在映射和在线取数前停止；其他提示词、映射或 schema 校验失败时在首次业务写入前停止。
- 在线默认 3 次取数仍失败或覆盖不足时，返回实际失败原因和可用覆盖情况，停止本次上报；不得创建事件、推进既有事件、用人工确认绕过数据门禁或改用历史 raw。重新提交必须重新取本次上报窗口数据。
- 不同 `ser_no` 的人工上报各建独立事件，不查询旧活跃事件做连续性合并；同一 `ser_no` 重试只返回该流水号的既有事件及工作流状态，不覆盖后续 feedback、maintenance 或 summary。
- 人工运行前后必须保持周期输出、周期 fetch-state 和 `input/sensor-raw-data/` 不变；本轮新增事件目录只能是当前人工事件。任何周期副作用都按执行边界失败处理。
- 运行期不得修改 `.claude/skills/**`、schema、mapping 或根配置。

## 依赖边界

本 Skill 依赖相邻 `.claude/skills/ship-anomaly-detection/` 的 engine、模型资产和 template，但只导入检测与契约模块。周期检测入口保持独立；人工上报不得调用、编排或补跑其正常周期同步和发布函数，也不得清理或改写其 raw。

详细固定提示词见 `references/prompt-contract.md`。

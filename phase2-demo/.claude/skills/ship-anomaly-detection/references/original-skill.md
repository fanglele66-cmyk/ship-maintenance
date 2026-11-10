---
name: ship-anomaly-detection
description: 配置驱动的船端传感器 AI 异常检测。通过标准 pointDataList 接口取数，按 data/ship-profile.json 选择设备分析器和知识包，并沿用统一事件、工作流和 Schema 合同。
---

# 船端设备异常检测

事件目录约定：新建 AI/人工事件使用 `ai-<ship_id>-<ser_no>`，OEM 使用 `oem-<ship_id>-<ser_no>`；文中的 `<event_folder>` 指对应短目录名。仅目录名去掉末尾时间后缀，`event_id`、业务文件名及输入/反馈文件名保持不变；ser_no 唯一，一个短目录对应一个事件，既有长目录兼容读取。

当前船舶、设备、分析器、知识包、设备别名和数据源全部读取 `data/ship-profile.json`。检测点位来自标准接口生成的 `data/sensor-point-mapping.json`，模型顺序和算法资产由所选 `analyzerProfiles` 配置声明。

`workspace` 可显式提供；省略时使用 Agent/脚本当前工作目录。多船或跨工作空间调度时应显式传入。本文命令保留 `--workspace .` 作为明确示例，但它不是单船当前目录运行的硬门禁。

根目录 `data/ship-profile.json` 是当前工作空间唯一船舶身份、数据源、设备能力、分析器入口和知识路由配置。`data/sensor-api.json` 只保存标准接口地址、分页和重试参数，不重复定义船舶身份。

## 与事件会话的边界

AI 检测只创建或刷新事件业务文件，不因前端创建空会话而运行。事件欢迎、进入排查、排查反馈、维修反馈和误报全部使用 `$ship-event-workflow`，且不重新执行取数或异常检测。

周期检测创建或更新具体 AI 事件后，后端为该 `event_id` 创建或复用专属事件会话，并发送可见首行“查看事件”；船舶 ID、事件 ID 和 `Skill：$ship-event-workflow` 必须放入末尾 `<yincang>` 隐藏块。周期会话只返回本轮运行结果，不在周期会话中伪造事件欢迎。

人工上报、AI 周期和 OEM 分析统一使用当前排查 Schema 和模型生成规则；不保留旧排查结构兼容分支。新建 analysis result 时，每个排查步骤的 `feedback_text=null`、`feedback_image_ids=[]`；`item_type=inspection` 的事项初始化 `answer=null`，`operation` 不输出答案或选项字段。这些交互字段只由 `$ship-event-workflow` 在用户成功提交排查反馈后从累计 feedback 投影更新。`feedback_text` 只保存用户填写的说明原文，不添加事项标题或其他前缀，多条按输入顺序用中文分号连接。

## 提示词身份与检测范围

每次 AI 周期提示词必须在独立行提供 `ser_no`。标准提示词为：

```text
请使用 $ship-anomaly-detection。
执行一次正常AI异常检测周期。
规定ser_no为873247549912068096
```

- 每一轮周期检测都由一个独立周期会话触发。连续两轮检测时，第一轮执行完成后必须关闭第一轮周期会话，再新开第二轮周期会话并传入新的 `ser_no`；禁止依赖上一会话的上下文、变量或回复。
- 跨周期连续异常复用只能依据同一工作空间已经落盘的 `active-events.json` 和事件文件完成。第二轮新会话必须能够独立读取这些业务事实，复用首轮旧 `ser_no/event_id`，同时使用第二轮新 `ser_no` 生成本轮 `run_id`。
- `ser_no` 是本轮调度器传入的必填业务流水号，只允许字母、数字、下划线和连字符。缺少、空白或格式非法时立即失败，不得执行在线取数、异常分析、清理或任何业务文件写入。
- Agent 必须先从提示词解析并校验 `ser_no`，再调用配置的标准取数命令；不得先取数后补验流水号。
- 周期运行 ID 固定为 `ai-run-<ser_no>-<created_YYYYMMDD_HHMMSS>`，输出文件固定为 `result/ai-anomaly/outputs/<run_id>__result.json`。
- 本轮新建 AI 事件时，事件 result、事件主文件与活动索引的 `ser_no` 必须等于提示词传入值，事件 ID 固定为 `ai-<ship_id>-<ser_no>-<event_start_YYYYMMDD_HHMMSS>`。
- 若判定为已有事件的连续异常，必须更新并复用既有 `ser_no/event_id`，不得使用本轮新 `ser_no` 重复创建事件；本轮新 `ser_no` 仍用于本轮周期运行 ID。

提示词还可在独立行提供可选的 `shipId` 和 `deviceId`：

```text
请使用 $ship-anomaly-detection。
shipId=<data/ship-profile.json.shipId>
deviceId=980000000000000001
执行一次正常AI异常检测周期。
规定ser_no为873247549912068096
```

- `shipId` 用于校验当前工作空间和 raw 的船舶身份，可填写 `data/ship-profile.json.shipId` 或其中的 `sensorApiShipId`；不改变在线取数范围。
- `deviceId` 必须填写 `data/ship-profile.json.devices` 中的 `deviceDataId`。只有设备绑定了有效 `analyzerProfiles` 且 raw 中存在完整样本时才分析。
- 两者都不提供时分析全部 `collectEnabled=true` 且已绑定分析器的设备。
- 指定值与工作空间、raw 或 mapping 不匹配时必须明确失败，禁止悄悄回退到全设备检测。
- 正常周期统一使用 `fetch_sensor_data.py sync`。加载器按船舶配置和分析器能力消费标准 raw；未绑定分析器的设备数据可以采集，但不会进入检测。

## 运行模式

### 正常周期（默认正式发布）

用户要求“正常周期”“定时检测”“运行一次 AI 异常检测”或等价意图时，执行不带 `--dry-run` 的正式分析。正常周期不得自行降级为预演，不得询问用户是否去掉 `--dry-run`，用户提示词也不需要额外声明“不要 dry-run”。

数据准备必须先尝试 `data/ship-profile.json.dataSource` 指向的标准接口，不得因为本地已有 raw（包括标准模拟 raw）而跳过该步骤，也不得改变标准三行提示词：

- 每个正常周期都先运行 `fetch_sensor_data.py sync`；接口失败但已有合格 raw 时才按缓存继续，并明确报告 `status=partial/usedCachedRawData=true` 及本轮取数失败原因。
- `_fetchMetadata.source=local-standard-api-simulation` 只表示缓存来源，不是跳过取数或转接的路由条件。
- 分析入口始终只消费 `input/sensor-raw-data/*.json`；获取或转接失败且没有合格 raw 时明确失败。

```powershell
# 配置的标准 pointDataList 接口
python .claude/skills/ship-anomaly-detection/scripts/fetch_sensor_data.py sync --workspace .

# 取数成功或缓存兜底后使用同一分析入口
python .claude/skills/ship-anomaly-detection/scripts/prepare_anomaly_analysis.py --workspace . --ser-no <ser_no> [--ship-id <shipId>] [--device-id <deviceId>]
```

准备命令只运行确定性检测并输出 `preparation_ref`，不写周期 result、事件文件或活动索引。随后 Agent 必须读取 `references/analysis/knowledge-guided-authoring.md`、`references/output/agent-content-contract.md` 和准备文件；对每个 `analysis_request` 读取其中 `knowledge_search.index_ref` 指向的知识入口及直接相关正文，并按 `candidate_bundle_ref` 写入仅含业务内容的候选 JSON。即使没有确认事件，也必须写入同一 `run_id`、`events=[]` 的合法候选。

```powershell
python .claude/skills/ship-anomaly-detection/scripts/validate_agent_analysis.py --workspace . --preparation <preparation_ref> --analysis-json <candidate_bundle_ref>
python .claude/skills/ship-anomaly-detection/scripts/publish_anomaly_analysis.py --workspace . --preparation <preparation_ref> --analysis-json <candidate_bundle_ref>
```

发布器重新绑定准备时的确定性输入和时间，注入身份、状态、查询与交互字段；整个待写集合通过 Schema 后才原子发布并执行安全清理。

### 显式预演（仅按需）

只有用户明确要求 `dry-run`、预演、试算、只验证或不落盘时，才执行：

预演仍执行同一“准备 → 查知识库并生成候选 → 校验 → 发布”链路，只在最后一条发布命令增加 `--dry-run --no-cleanup`。它不写周期 result、事件文件或活跃事件索引，也不执行清理。`fetch_sensor_data.py sync` 是独立的在线写入动作；纯预演默认只读既有 raw，只有用户同时明确要求在线取数时才调用，并应说明 raw/fetch-state 仍会落盘。

若知识读取、模型生成失败，或候选按校验错误修复一次后仍失败，保留准备文件及失败原因，停止本次发布并等待合格模型候选。正式运行和预演均不得通过 `--fallback` 发布固定脚本或模板派生的分析与排查任务。

### 运行期代码只读

正常周期、定时周期、补数、预演和故障重试都不得修改 Skill 自身代码或契约。运行过程中禁止创建、编辑、删除或覆盖 `.claude/skills/**`、根 `CLAUDE.md`、任何 `SKILL.md`、`agents/`、`engine/`、`scripts/`、`template/`、`references/` 和 schema 文件；也不得为绕过当前报错而扩展 schema、改写状态或现场补丁后自动重跑。允许的运行期写入仅限本节命令规定的 `input/sensor-raw-data/`、`result/ai-anomaly/` 业务数据、`tmp/` 下本轮 preparation/Agent candidate，以及显式执行 `mapping` 动作时更新根 `data/sensor-point-mapping.json`。

遇到代码缺陷、契约冲突或未覆盖状态时，必须保留原现场、停止该次业务写入并向用户报告；只有用户明确授权“编写、修复或调试 Skill”后，才进入开发态修改上述文件。业务运行提示词本身不构成修改 Skill 的授权。

在线取数只读取 `data/ship-profile.json.dataSource.configPath` 指向的标准接口配置。接口凭证通过配置声明的环境变量或本地未跟踪文件读取，不得写入日志或仓库。

HTTPS 优先使用 Python 环境已安装的 `certifi` CA 包，未安装时才回退到系统/Python 默认信任库，避免 Windows 默认 CA 路径不存在引发 `[Errno 2]`。连接超时只表示当前执行工具无法访问网络或服务不可达，不得据此判断为证书故障。在线取数失败但已有合格 raw 时，本轮继续分析，但必须明确报告 `status=partial` 和 `usedCachedRawData=true`，不得把旧 raw 描述成本轮新数据。标准 `sync` 会把失败窗口、错误、尝试次数和时间写入 `result/ai-anomaly/fetch-state.json`，并按配置的滚动窗口补缺。

分析入口本身不发起网络请求，默认从最近 6 小时内选择时间最新的 12 份 `input/sensor-raw-data/*.json`。正常周期的普通结果写入：

```text
result/ai-anomaly/outputs/ai-run-<ser_no>-<created_YYYYMMDD_HHMMSS>__result.json
```

只有长航检测引擎标记为确认的信号才创建或更新 `result/ai-anomaly/events/ai-<ship_id>-<ser_no>/`；候选信号继续进入周期结果但不得独立建事件。

## Agent 自动全流程

`agents/openai.yaml` 允许 Agent 根据主机异常检测、报警分析和最新传感器窗口等意图自动调用本 Skill。触发后必须连续完成：

正常周期固定使用正式发布模式；除非用户明确要求预演，否则以下流程不得添加 `--dry-run` 或停下来等待二次确认。

1. 先解析并校验提示词中的必填 `ser_no`。缺失、空白或格式非法时停止，且不得调用取数或分析命令。
2. 按 `data/ship-profile.json.dataSource` 运行 `fetch_sensor_data.py sync` 准备标准 raw；在线失败后才回退合格缓存。完成取数准备后，按采集时间从 `input/sensor-raw-data/` 的合格 raw 中最多选择12份分析。
3. 按 JSON 内采集时间排序，在 `--lookback-hours` 窗口内取最新 `--max-files` 份；默认分别为 6 小时和 12 份。
4. 解析可选 `shipId/deviceId`，校验船舶身份和设备配置后，按 `analyzerProfiles` 对完整时序调用配置的检测入口；指定设备时只执行该设备。
5. 从参与异常的真实点位唯一解析设备主键，将 `deviceDataId` 写入定时结果 `events[]` 和单事件分析 result；按异常对象、机理组和工况上下文选择 2～6 个去重关联点位，统一使用映射表字段 `deviceDataId/pointDataId/pointName/dataType/unit` 生成供前端按需查询的 POST 请求。单事件 analysis 顶层 `systemType` 取这些点位映射中非空值的众数，并作为事件主原因和排查方案的 `related_system`；全部为空时写 `null` 并继续沿用原异常分析、关联系统和点位选择逻辑，不在分析过程中调用接口。
6. 先按设备、异常类型、时间连续性执行既有事件合并。命中仍活跃的连续事件时复用旧 `ser_no/event_id` 并更新该事件；未命中时才用本轮 `ser_no` 生成 `ai-<ship_id>-<ser_no>-<event_start_YYYYMMDD_HHMMSS>`。同一新 `event_id` 已存在时不得重建、覆盖、重开或重新加入活动索引，既有流程数据保持原样。
7. 对每个新建或更新事件读取准备证据、知识库索引和相关正文，按 `references/analysis/knowledge-guided-authoring.md` 生成 Agent 内容候选；不得调用确定性正文代替正常知识推理。
8. 先校验候选字段边界、知识引用、内容质量和结构，再由发布器注入 `ser_no/event_id/workflow_state/data_query_requests` 等确定字段；候选修复一次仍失败时保留准备文件和错误，停止发布并等待合格模型候选，不以固定脚本或模板兜底。
9. 发布器直接调用 `ship-event-priority.calculate_priority()`，只在本轮当前事件 analysis result 顶层写一个 `priority_score`；不得把分数复制到事件主文件或 `active-events.json`，不得启动全量扫描、重算其他事件或执行排序。评分模块异常时按当前 `severity` 使用 `15/25/40/50` 的严重度基础分兜底，评分失败本身不得阻断事件发布。
10. 在第一次业务写入前验证整个待写集合；任一 schema 失败则零业务文件落盘。全部通过后原子替换 JSON，再执行安全清理并返回已验证的结果引用。

若 `sync` 记录了失败但工作空间已有可分析的 raw，第 3-10 步照常执行，并在最终报告区分“本轮新增 raw”和“复用缓存 raw”。若没有任何可分析 raw，分析入口仍应明确失败。连接、TLS、鉴权或非分页容量类 HTTP 错误只记录当前窗口并停止继续打接口；当分页请求返回 HTTP 500 时，允许按根配置的 `pageSizeFallbacks` 从该窗口第一页降低分页重试。空窗口或覆盖不足会记录为缺口；本轮仍可按预算尝试滚动 12 小时范围内更早的缺口，但不得回到 12 小时外的旧游标阻塞实时恢复。

周期 result 的 `summary.message` 由运行器根据 `analysis_window.start_time/end_time` 确定性计算实际小时数。本轮没有 08 通道确认事件时必须写“当前窗口无确认事件”，不得引用历史 active-events 得出“本轮异常已确认”或把历史事件状态混入本轮结论。

调整窗口示例：

```powershell
python .claude/skills/ship-anomaly-detection/scripts/prepare_anomaly_analysis.py --workspace . --ser-no <ser_no> --lookback-hours 12 --max-files 24
```

## 配置分析器与数据边界

1. `ship-profile.json.devices[].analyzers` 决定每台设备使用的分析器；`detectionEntrypoint` 是唯一检测插件入口。
2. 工况路由、物理一致性、统计/模型通道、候选合并与确认均由当前 profile 配置的本船分析器实现；通用外层只转换为既有 `DetectionEvent`，不改事件 schema。
3. `mappingPath` 中的模型索引是输入顺序；平台 `pointDataId` 只承担接口映射，不参与模型排序。
4. 完整样本点数读取 `requiredPointCount`，不在 Skill 中写死；缺点不得补零。
5. 模型、基线、mapping、检测插件及其专属说明由人员按目标船舶整体上传或替换，替换后必须运行工作空间校验和全量健康回放。
6. 船舶身份和点位 ID 不能作为 OEM 阈值；OEM 映射与阈值必须从 profile 的专用知识配置读取。

数据库增加健康数据后，按上述顺序重新生成统计基线与 NF 资产，再以全量健康回放作为替换门槛。详细流程见 `references/model-lifecycle.md`。

## 点位 mapping 与取数接口

根目录 `data/sensor-point-mapping.json` 是 `point-list` 的固定点位 mapping，以 `deviceDataId + pointDataId` 唯一化并保持接口字段名。刷新脚本只在重复记录完全一致时去重，发生冲突时拒绝覆盖。输入只接受 `point-data-list` 新格式，不再兼容旧 `points[]` 快照。

单独刷新 mapping 或拉取原始数据：

```powershell
python .claude/skills/ship-anomaly-detection/scripts/fetch_sensor_data.py mapping --workspace .
python .claude/skills/ship-anomaly-detection/scripts/fetch_sensor_data.py raw --workspace .
python .claude/skills/ship-anomaly-detection/scripts/fetch_sensor_data.py sync --workspace .
```

`raw` 是单窗口、失败即非零退出的诊断命令；`sync` 是 Agent 完整周期使用的容错编排命令。`sync` 固定先拉北京时间最近一个完整半小时，再重试最近 12 小时内的待补窗口，并按从新到旧的顺序补齐滚动窗口。默认每轮最多新增探测 12 个缺口并重试 12 个待补窗口，逐步达到 24 份 raw；成功窗口从待补队列移除，12 小时内仍失败的窗口保留，超出范围的窗口转入有界过期记录。

命令行 `--start/--end`、POST 请求 `collectTimeStart/collectTimeEnd`、raw 元数据游标、响应 `pointDataList[].collectTime` 和事件时间统一使用北京时间无时区字符串，数值原样传递，不加减 8 小时。例如请求和响应窗口都使用 `2026-07-07 16:00:00..16:30:00`。显式传入 `--start` 但不传 `--end` 时，自动拉取从该北京时间时刻开始的 30 分钟；两者都不传时，优先读取已有 raw JSON 的最新北京时间终点并向后拉取 30 分钟，没有历史 raw 才回退到当前北京时间前 30 分钟。

默认请求 `data/ship-profile.json.devices` 中全部 `collectEnabled=true` 的设备，接口设备 ID 由 profile 注入。请求从 API 配置的 `pageNo/pageSize` 开始，收到响应后检查 `pageCount`，大于 1 时继续读取后续页。若某一分页请求返回 HTTP 500，则不在同一容量重复请求，立即从该窗口第一页按 `pageSizeFallbacks` 降低分页重试；401/403、连接失败、响应格式错误、空窗口或覆盖不足不得触发分页降级。最终 raw 元数据必须记录 `pageSizeAttempts/pageSizeFallbackUsed`。命令行 `--device-data-id`、`--point-data-id` 和 `--page-size` 可覆盖主分页值，且只采用小于该覆盖值的配置降级项。

全部分页合并后，仅剔除六个契约字段均为空的接口占位对象，并在 `_fetchMetadata.blankPlaceholderRecordsRemoved` 记数；非对象、缺字段或仅部分字段为空的记录必须使整窗失败且不得落盘。合格记录保持接口字段不变；无论相应设备是否已有分析器，只要六个接口字段合规就写入同一个 `input/sensor-raw-data/sensor-raw-YYYYMMDD_HHMMSS__raw-data.json`。写入前验证数据结构及接口数据实际覆盖请求窗口；覆盖不足或空数据时拒绝发布，所以下次可由同一准备命令断点续拉。取数脚本与异常分析入口仍是两个独立动作，每轮调度按“先取下一份、再分析最新 12 份”编排。历史带 `Z` 或时区偏移的输入与文件继续兼容读取，但所有新产物均不再写时区后缀。

检测结果中的 `data_query_requests` 使用当前 `point-data-list` POST 契约，同一事件只返回一组 2～6 个去重事件关联点位及覆盖完整事件的时间窗；接口参数保持 `shipId/deviceDataIdList/pointDataIdList/collectTimeStart/collectTimeEnd/pageNo/pageSize` 命名；`requestTimeTimezone=Asia/Shanghai`，请求、响应和事件时间使用同一个数值。分页从同一配置读取 `pageNo=0/pageSize=2000`；在线取数首请求必须直接使用 2000，不得根据旧会话、旧测试或历史结果先尝试 10000/5000。事件超过 30 分钟时也只返回一个完整窗口的前端查询请求；同窗数据按 pageNo/pageSize 继续分页；Skill 只返回请求，不在结果生成阶段联网。

## 定期清理责任（必须执行）

本 Skill 负责清理运行期数据：

- 取数恢复以北京时间滚动 12 小时内 24 个半小时窗口为目标；清理仍以最新 raw 的采集终点为锚点，删除该锚点 12 小时外文件，并把 `input/sensor-raw-data/*.json` 限制为最新 24 份。历史日期回放不得按电脑当前日期把全部 raw 误删；
- 删除生成时间超过 12 小时且没有创建/更新事件的普通检测结果；
- 保留所有创建或更新过事件的运行结果；
- 永不删除 `result/ai-anomaly/events/` 或事件索引，事件生命周期由事件/维护链路负责。

成功检测后默认自动清理，也可单独执行：

```powershell
python .claude/skills/ship-anomaly-detection/scripts/cleanup_runtime_data.py --workspace .
```

## 温差拓扑

03 通道只包含：A/B 列涡轮前排温减后排温、A/B 列 HT 水出口减共同进口、LOC 低温水出口减进口、每缸两支缸套温度测点之差。不得把增压空气入口温度虚构成冷却器进出口温差。

详见：

- `references/channel-design.md`
- `references/data-contract.md`
- `references/model-lifecycle.md`
- `references/validation.md`
- `references/analysis/knowledge-guided-authoring.md`
- `references/output/agent-content-contract.md`

## 契约与安全

### 内容质量与知识依据

- 单事件结论和排查任务必须由大模型结合本次异常事件证据及 profile 经 catalog 解析出的当前设备知识库正文生成；确定性脚本只准备证据、校验和发布，不能以固定模板派生内容。按异常对象选择并实际读取相关专题，不得只输出“部件状态偏离健康基线”等通用占位文案。
- `analysis_conclusion.summary` 至少覆盖：事件工况和持续时间、统计分数与门槛的正确含义、当前设备知识包中的工程机理、可能后果、结论边界和下一步。统计分数不得当作物理量或真实故障概率。
- `analysis_basis[]` 必须同时包含事件持续性、健康基线比较、工况识别、配置知识包依据和训练数据边界。
- `fault_causes[]` 根据本次事件和知识给出 2～5 个有区别的候选原因；测量链路仍未排除且与现象有关时保留该替代解释，不机械限定各类原因数量。每个原因要写清“为什么与当前现象有关、尚缺什么现场证据、持续存在有什么后果”。
- 排查采用“候选原因 → 不同排查方向 → 具体操作或检查事项”的三级结构：一级任务通过 `cause_id` 对应原因，二级 `action` 区分该原因下的部件或故障环节，三级 `content` 写具体执行方法和结果判断。不得用准备、检查、复测等通用流程阶段替代二级方向，或复制内容凑数。
- 模型根据事件证据、操作依赖和风险安排事项顺序；试验或拆检须有知识和现场条件支持。安全要求写入 `safety_notes`；知识库未给出的限值、扭矩、备件号或现场读数不得编造。

- 输入遵循 `template/input.schema.json`。
- 定时结果、事件主文件、分析结果、活动事件索引、清理报告和 NF 训练 JSON 必须在写入或返回前通过各自 schema；禁止输出 `schema_version`。
- 文件引用一律使用工作空间相对路径。
- 单事件分析包含 2～5 个 `diagnostic_plans[]`，每个任务有 2～4 个 `steps[]`，每步由模型按需要编写 2～4 个 `inspection_items[]`。事项必填简短 `title`、具体 `content` 和 `item_type`；`operation` 不带选项或答案，`inspection` 必填 `options`。选项保持 `code=normal/abnormal` 与 `abnormal=false/true`，具体 `label` 由模型按该事项判断生成；发布器仅为 inspection 补齐 `single_choice`、必填和空答案。
- 顶层 `workflow_state` 由检测器初始化为 `event_overview/ready`；后续只有 `ship-event-workflow` 可以更新。
- 事件排查步骤必须输出 `reference_images[]`。仅当配置知识包中的图片与当前异常对象或排查操作强相关时才写入知识包 `images` 目录下的相对路径；否则输出空数组。
- `fault_causes[].probability_score` 是前端百分比和排序的必填数值；`basis` 固定只输出一条合并后的主要依据，前端不需要再从多条依据中选择。
- 排查任务不接受 `tools/prerequisites`，步骤不接受 `method/acceptance_criteria/evidence_to_record`，事项不接受 `question`。必要执行细节、工具、判断和记录要求写入 `content`，安全条件写入 `safety_notes`；整体完成要求保留在任务 `completion_criteria`。生成、发布及消费统一使用当前合同，出现旧字段即拒绝。
- 清理只允许作用于固定的原始输入目录和普通输出目录，事件目录不在清理范围内。
- 事件结论必须写成“算法异常已确认、真实故障仍需现场确认”，不能用健康数据直接推断根因已成立。
- `anomaly_type` 是供前端直接展示的中文完整短句，应简洁表达；包含传感器时仅保留完整中文名称，禁止填写 `a1-ch1_inter_cyl` 等内部编码；内部编码只允许保留在 `event_id` 中用于事件身份和兼容匹配。
- `event_title` 必须从中文 `anomaly_type` 生成，使用“异常待确认”等面向船员的标题，不得暴露 `cylinder_2`、`ch3_dt_ar` 等对象或通道内部编码。

生成排查任务前读取 [references/output/diagnostic-writing.md](references/output/diagnostic-writing.md)，按本次证据选择任务方向并明确测点、操作和判断依据。

事件建议摘要仅保留当前判断边界与下一步行动，完整证据与推断保留在对应字段。事件概览及排查正文中的传感器仅使用本船分析映射的中文 `display_name`，不拼接英文名称，也不能使用编号、ID 或采集 key。标题应简短，保留识别对象所需的完整中文名称。

数据概览使用独立名称字段：`data_query_requests[].points[].pointName` 输出英文名称，`pointName_ch` 输出中文名称，由发布器从显示名称映射生成，详见 [Agent 内容候选契约](references/output/agent-content-contract.md)。正文中的传感器仅使用中文名称，不再拼接英文；数据概览的独立名称字段保持原契约。

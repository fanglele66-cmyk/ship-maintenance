---
name: ship-engine-health
description: 可配置船舶设备健康分析与船端态势对话消息。消费标准 pointDataList，运行 profile 配置的健康分析器并输出既有 result 和前端消息 Schema；不得创建报警事件或生成维修方案。
---

# 船舶设备健康分析

本 skill 消费 `input/sensor-raw-data/` 中已经准备好的传感器原始数据 JSON，并只读 `result/ai-anomaly/active-events.json`、`result/oem-alarm/active-events.json` 统计每个设备当前有效事件数。它可以和 `ship-anomaly-detection` 使用同一批原始数据，但不负责查询数据库或调用 API。

## 船端 2.0 本地适配（本项目优先入口）

本目录完整复制自 `ship-changhangbiyu/.claude/skills/ship-engine-health`，保留原分析器、Schema、回归和旧船端卡片分支。以下本地入口优先于后文旧船端消息展示约定。

- 后端每次启动立即执行，之后以本次启动时间为基准每隔一小时执行 `scripts/run_local_health.py --data-dir <数据目录> --cutoff <北京时间>`。
- 适配器只读本项目数据库副本，截取截止时刻之前 6 小时，生成 12 个半小时 `pointDataList` 文件，再调用原 `run_engine_health.run`。不会改动源数据库或读取未来样本。
- 分析完整六小时连续窗口。源时间与拼接点只保留在内部追溯元数据中，不裁剪为最后一个源片段；面向人员的报告按当前工况表述。
- 原始输入与结果存放 `<数据目录>/workspace/`，与演示事件、原船端工作空间隔离。旧输入每轮替换，Skill 原目录保留最新 6 份；完整产物另存 `health-history/<启动标识-轮次>/`，同样只保留最新 6 份，包含输入、Skill 结果和最终报告。
- 不导入前端预置报警/预警。空事件索引仅代表未导入，不能解释为原船无报警。
- 原统计和物理关系由确定性脚本计算。模型只按 [本地研判约定](references/local-report.md) 整理摘要、关注建议和 Markdown；本地页面不使用旧 `card` 信封。
- 同时以真实样本间最大间隔评估覆盖；不得把 12 个文件等同完整 6 小时。原始 result 的文件数量口径保留，前端使用适配器 coverage。
- 后端发布 `health-latest.json` 与 `health-latest.md`，页面读取已完成产物，禁止把数据刷新时间冒充分析完成时间。
- 原厂家参考数值及型号归属保持来源可追溯，适用性未复核；本次不将参考值转为自动报警事件。

## 态势会话欢迎分支

用户点击船端“态势”且会话无历史记录时，前端发送：

```text
检查船舶状态
<yincang>
action=situation_welcome
shipId=<data/ship-profile.json.shipId>
shipName=<data/ship-profile.json.shipName>
Skill：$ship-engine-health
</yincang>
```

首行是前端可展示的自然语言动作；`action/shipId/shipName/Skill` 必须全部位于消息末尾唯一的 `<yincang>` 块中，`Skill：$ship-engine-health` 使用全角冒号并作为隐藏块最后一项。Agent 正常读取隐藏块并执行：

```powershell
python .claude/skills/ship-engine-health/scripts/build_situation_welcome.py --workspace .
```

该命令是只读分支：

- 仅在新建态势会话时执行一次。
- 输出含 `shipName/title/metrics/summary/suggestedQuestions`。
- `workspace` 只用于 Agent 绑定运行目录，不是前端字段。
- 只读 `result/engine-health/outputs/` 中按文件名最新且通过 `template/result.schema.json` 的健康 result，将 `overview` 映射为 `metrics`；前端不传这些统计值。
- 不运行 `run_engine_health.py`，不创建、覆盖或清理任何 result。
- 找不到合法健康 result 时，四项 `metrics` 返回 `null` 并在 `summary` 中说明暂无可用统计，不使用演示值。
- 欢迎语不返回在线状态或全船健康分；在线状态由后端连接状态接口提供。
- 最终消息的中间 JSON 必须通过 `template/situation-message.schema.json`，且回复中原样保留命令输出的完整三行 `card` 信封。
- 完整性、JSON 和 schema 校验必须是完全静默的内部门禁，检查过程及成功结论都不得形成 assistant 内容。唯一用户可见文本必须是该信封，前后不得附加任何解释、标题、额外 Markdown 围栏或数据缺失说明；尤其禁止输出“Script stdout 完整性检查通过”“JSON 合法”“直接返回信封”“Schema 校验通过”或任何同义前缀。
- “猜你想问”只由本 Skill 的 `situationWelcome` 和 `deviceDetail` 返回，前端不得维护另一份固定文案。
- 态势会话内的普通追问直接返回自然语言或 Markdown 裸文本；不得包装为 `type=text` 或其他 `type/data` JSON。

## 态势单设备展示边界

用户点击具体设备后，前端不得直接读取工作空间 result 拼卡片，而是发送：

```text
检查<设备名称>状态
<yincang>
action=device_detail
shipId=<data/ship-profile.json.shipId>
deviceId=<deviceDataId>
Skill：$ship-engine-health
</yincang>
```

Agent 执行：

```powershell
python .claude/skills/ship-engine-health/scripts/build_device_detail.py --workspace . --device-id <deviceId>
```

该分支只读最新且通过 result schema 的健康结果，按 `deviceDataId` 唯一定位设备，返回 `deviceDetail` JSON 和设备相关 `suggestedQuestions[]`。传感器当前值与趋势仍由后端接口提供。

- 最终消息的中间 JSON 必须通过 `template/device-detail-message.schema.json`，并逐字原样保留命令 stdout 中的完整三行 `card` 信封。
- 唯一用户可见文本必须是该信封；不得翻译、改写、纠错或概括任何字符串，尤其不得改变 `context` 内的设备名、点位名、数值和单位，也不得添加说明、标题或额外 Markdown 代码围栏。
- 如果认为脚本正文存在数据或措辞问题，仍须先原样返回本次脚本结果；问题修复必须回到分析脚本和 result 重新生成，禁止在对话层擅自修改。

### 态势特殊消息输出硬约束

- `build_situation_welcome.py` 和 `build_device_detail.py` 成功时均输出精确三行 `card` 信封：首行是三个 ASCII 反引号紧接 `card`，中间一行是紧凑 JSON，末行是三个 ASCII 反引号。这是标准 Markdown `card` 围栏，同时作为前端传输标记；不得改成 `json` 或其他语言标记。
- 工作空间船舶名称与业务船舶 ID 统一读取根目录 `data/ship-profile.json`。`--ship-name` / `--ship-id` 仅保留为兼容校验参数；省略时使用配置值，显式值与配置不一致时必须失败。
- 两个卡片分支的第一个非空 assistant `output_text` 必须从字节 0 开始就是上述首行；其前禁止空 `output_text`、空白、BOM、过程说明或其他 assistant 内容块。底层可以拆分此前缀，前端按累计字符判断。
- 前端流式接收时必须跨 delta 累计识别“三个 ASCII 反引号 + `card\n`”；命中后显示 loading 并静默缓存，完成时把完整快照用于校验而非再次追加，然后剥离标记、解析一次 JSON、渲染一次组件。历史回放使用同一个解析器；普通对话继续正常流式显示。
- Agent 必须逐字原样复制完整 stdout，不得解析后重新序列化，不得调整标记、换行、空格、引号或正文。唯一用户可见内容只能是一个三行卡片信封。
- 完整性门禁必须完全静默。成功分支的最终值必须满足 `final_text = captured_stdout`，禁止执行 `说明文字 + captured_stdout`、`captured_stdout + 成功说明` 或任何字符串拼接；检查成功本身不是一条需要回复用户的消息。
- 命令 stdout 只能在子进程退出码为 0 后整体捕获，禁止把工具执行中的局部 stdout 直接流入 assistant 输出。提交前必须对捕获值执行完整性门禁：精确命中首尾围栏、恰好三行、中间行以 `{` 开始并以 `}}` 结束、`json.loads` 成功且再次通过对应消息 schema；不能从异步 UI 状态或尚未完成的 delta 缓冲读取待提交文本。
- 任一围栏、UTF-8、JSON、schema 或末尾双闭合检查失败都视为截断/损坏：不得展示、不得调用前端 `JSON.parse`、不得手工补 `}`。只允许使用完全相同的确定性命令重新执行一次；第二次仍失败时停止卡片交付并报告生成失败，绝不能返回半个 JSON。
- 最终 assistant 只能用一个 `final/output_text` 内容块提交已经通过上述门禁的完整 stdout 快照。不得让模型重新键入 JSON，不得从命令输出中复制字段后自行拼装，也不得为缩短长 `context` 而截掉尾部字符。
- 命令退出码为 0 后立即停止业务推理，不得另行总结设备状态，不得只提取 `data.summary`、`data.context` 或任一内部字段。前端显示完整原始 JSON 而未渲染组件时仍须保持原样，禁止为追求渲染而改写输出。
- JSON 结构标点和语法引号必须保持脚本输出的标准半角字符，属性名与字符串使用 ASCII 双引号 `U+0022`；不得以中文弯引号替换语法引号。
- `deviceDetail.context` 在消息构造阶段将半角范围符号 `~` 统一规范为中文 `～`，防止 Claude Code 或前端 Markdown 渲染器把多个范围符号错误配对成删除线；健康数值和范围端点不变。
- 在内存中完全静默检查：第一行精确为三个 ASCII 反引号紧接 `card`，第二行首字符为 `{`、尾字符为 `}`，第三行精确为三个 ASCII 反引号；除首尾围栏外不得包含其他围栏。检查成功后立即把捕获的 stdout 快照作为唯一最终内容，不得先说检查通过；检查失败时重新从 stdout 原样取得完整信封，不得手工重建 JSON。
- OpenClaw/前端必须先确认完整文本 `startsWith("```card\\n")` 且 `endsWith("\\n```")`，再按这两个标记的实际长度取中间正文并执行一次 `JSON.parse`；禁止先按固定猜测长度切片。完成事件携带的完整快照是解析依据，delta 缓冲只用于 loading；不得在异步状态尚未落定时用旧缓冲解析。解析失败时保留 loading/错误态并请求重新生成，不显示残缺正文。

只有提示词明确要求 `action=run_analysis`、`action=situation_welcome` 或 `action=device_detail` 才进入对应流程。

## 职责

1. 浏览 `input/sensor-raw-data/` 下最新 12 份 `*__raw-data.json` 文件。
2. 读取 `pointDataList[]` 中 profile 所配置设备和点数的时间序列，通过配置的 mapping 补齐点位名和设备名。
3. 按设备绑定的 analyzer 动态运行 `healthEntrypoint`，输出该分析器定义的工况、统计和物理关系证据。
4. 每次触发生成一次健康分析 result。
5. 只读 AI/OEM 活跃事件索引，按 `equipment_name` 匹配设备、按 `event_id` 去重并排除 `status=closed`，写入设备的 `event_count`。`abnormal_parts` 作为前端“关注点（事件）”字段，合并未闭环事件标题/异常描述和结构化传感器异常，去重后保留 0～3 条；只要 `event_count > 0` 就至少保留一条事件关注点。只要 `event_count > 0`，该设备就必须判为 `health_status=abnormal`，并在分数、结论、建议、设备正文及总览中体现未闭环事件；不得同时输出“正常”或“未检测到激活报警/故障”。
6. 对能从 `data/sensor-point-mapping.json.systemTypeMapping` 解析到非零系统的未闭环事件或异常测点，生成 `analysis_highlights[]`。普通结论不强制高亮；每项固定包含系统、研判结论、候选可能原因和证据。前端按系统名称精确高亮，不使用特殊符号解析。
7. 输出到 `result/engine-health/outputs/engine-health-<created_YYYYMMDD_HHMMSS>__result.json`。
8. 运行结束后按产物时间从最旧开始清理 `result/engine-health/outputs/`，固定保护最新 6 份；不足 6 份时不删除，超过 6 份时即使产物仍在 12 小时内也清理到 6 份。

## 不负责

- 不查询本地数据库。
- 不调用本地 API 或真实接口。
- 不直接生成报警/异常事件目录。
- 不更新 `active-events.json`。
- 不把已关闭事件或历史事件总数写入 `event_count`。
- 不生成维修建议；维修建议仍由 `ship-maintenance-advisor` 在报警/异常事件闭环中处理。
- 不删除 `input/sensor-raw-data/` 中的原始数据。

## 工作空间约定

- 触发消息可提供 `workspace`；提供时 Agent 使用该目录，省略时使用当前工作目录。多船或跨工作空间调度时应显式提供。
- `input/`、`result/` 和 `.claude/skills/` 等业务路径及本文命令均相对于 `workspace` 解析，禁止写死本机盘符或用户目录。
- Agent 如需调用 Python 辅助脚本，应从工作空间根目录以独立进程启动，无需额外设置 `PYTHONPATH`。

## 执行方式

加载本 Skill 后必须直接调用唯一正式分析和发布入口：

```powershell
python .claude/skills/ship-engine-health/scripts/run_engine_health.py --workspace .
```

该脚本确定性读取最新 12 份 raw-data，在同一计算对象中生成 `generated_at`、`analysis_window`、`data_quality`、总体 `context`、设备状态和设备 `context`，先通过 `template/result.schema.json`，再原子替换唯一目标文件。校验失败不得写正式文件。

Agent 不得在工作空间根目录、`tmp/` 或 Skill 源目录新建健康分析辅助脚本，不得自行拼装第二份正式 result，也不得重复调用发布入口来“补写”正文。需要重试时使用同一个 `--created-at`，确保覆盖同一路径。

结果校验：

```bash
python .claude/skills/ship-engine-health/scripts/validate_result.py [--workspace <WORKSPACE>] result/engine-health/outputs/<result_file>.json
```

`--workspace` 省略时使用当前目录。校验器读取本 Skill 的最新 `template/result.schema.json`，不再使用旧版 `{context, devices}` 两字段判断。

## Skill 文件结构

以下路径均相对于 `workspace`：

```text
.claude/skills/ship-engine-health/
├── SKILL.md        # Agent 主入口、职责和边界
├── agents/         # Skill 展示与消息调用元数据
├── references/     # 数据契约和 Agent 分析工作流
├── template/       # 运行参数及 result schema 和示例
└── scripts/        # 结果校验及确定性回归入口
```

## 输入数据

输入目录：

```text
input/sensor-raw-data/
```

推荐文件名：

```text
sensor-raw-<collect_YYYYMMDD_HHMMSS>__raw-data.json
```

每份文件直接使用 `point-data-list` 接口落盘的新格式，与 `ship-anomaly-detection` 共用：

```json
{
  "total": 37800,
  "pageCount": 1,
  "pointDataList": [
    {
      "shipId": "CHBY",
      "dataId": "...",
      "deviceDataId": "980000000000000001",
      "pointDataId": "...",
      "collectTime": "2026-07-07 18:30:10",
      "value": "0.3"
    }
  ],
  "_fetchMetadata": {
    "source": "point-data-list",
    "collectTimeStart": "2026-07-07 18:30:00",
    "collectTimeEnd": "2026-07-07 19:00:00",
    "collectTimeTimezone": "Asia/Shanghai",
    "recordCount": 37800,
    "recordsPath": "pointDataList"
  }
}
```

其中 `pointDataList[].value` 是接口已完成点位放大/缩小系数换算后的最终工程值，健康分析直接使用该值，禁止再次除以 `scale`。只有兼容旧 `points[]` 且明确提供 `raw_value/scale` 时才执行旧换算；指定有符号16位点仍需完成补码回绕解码。

健康分析不依赖文件行数；当前是一台主机、每个完整采样 59 点。正式接口替换 ID 后仍按 mapping 中的 `deviceDataId + pointDataId` 聚合。

详细契约见：

- `references/data-contract.md`
- `references/workflow.md`

## 输出规则

输出 result 同时提供机器可读事实和 Markdown 展示正文：

- `generated_at`：脚本注入的北京时间无时区生成时间。
- `analysis_window`：结构化起止时间和小时数；无数据时起止时间为 `null`。
- `data_quality`：已使用文件数、期望文件数、可用设备数和 `sufficient/partial/insufficient` 状态。
- `overview`：周期设备健康结果自身的重点设备数、设备总数、异常数和预警数；新建态势会话时由欢迎分支读取并映射为 `situationWelcome.data.metrics`。
- 顶层 `context`：总览报告。
- `devices`：按设备名称提供映射表主键 `deviceDataId`、显式 `device_name`、当前有效 `event_count`、运行状态、健康状态、设备健康度、当前工况、异常部位、分析结论、建议操作和独立 `context`。每个设备必须从 `data/sensor-point-mapping.json` 唯一解析一个 `deviceDataId`，不得仅返回名称。

健康状态采用保守合并规则：传感器结构化检查和当前有效事件任一发现异常，都必须将设备判为异常。`event_count > 0` 时至少扣除一个异常项对应的 20 分；事件数量只表示未闭环事件数，不按数量重复扣分。即使传感器未发现额外超限，只要 `event_count > 0`，`abnormal_parts` 也必须至少保留一条未闭环事件标题或异常描述，事件结论和排查建议同样不得省略。

运行参数和结果契约示例位于：

- `template/input.schema.json` / `template/input.example.json`
- `template/result.schema.json` / `template/result.example.json`

```json
{
  "generated_at": "2026-07-11T08:05:00",
  "analysis_window": {
    "start_time": "2026-07-11T07:00:00",
    "end_time": "2026-07-11T08:00:00",
    "duration_hours": 1.0
  },
  "data_quality": {
    "status": "partial",
    "used_file_count": 3,
    "expected_file_count": 12,
    "available_device_count": 1
  },
  "overview": {
    "key_device_count": 1,
    "total_device_count": 1,
    "abnormal_count": 1,
    "warning_count": 0
  },
  "context": "面向轮机长的 Markdown 格式设备健康分析总览报告",
  "devices": {
    "主机": {
      "deviceDataId": "980000000000000001",
      "device_name": "主机",
      "event_count": 1,
      "status": "running",
      "data_quality": "available",
      "is_key_device": true,
      "health_status": "abnormal",
      "health_score": 80,
      "health_label": "存在异常",
      "operating_condition": "运行中",
      "abnormal_parts": ["冷却水温"],
      "analysis_highlights": [
        {
          "systemType": 3,
          "system_name": "冷却水系统",
          "analysis_conclusion": "冷却水系统存在需关注证据：冷却水温。",
          "possible_causes": ["冷却水泵、阀门或流量状态异常", "换热器换热面结垢或堵塞"],
          "evidence": [{"source": "sensor_point", "id": "<pointDataId>", "label": "冷却水温"}]
        }
      ],
      "analysis_conclusion": "主机当前存在异常，重点关注冷却水温；重点关注系统：冷却水系统。",
      "recommendations": ["复核冷却水温对应的传感器当前值和状态。"],
      "context": "面向轮机长的 Markdown 格式单设备健康分析报告"
    }
  }
}
```

注意：

- 顶层字段和设备字段严格遵循 schema，不允许模型另增调试字段。
- `analysis_highlights=[]` 表示本次没有需要结构化高亮的系统；不得为了视觉效果补造高亮。非空时 `system_name` 必须在设备 `analysis_conclusion` 中原样出现，供前端精确定位。
- 总览和单设备 `context` 都按 `## 结论`、`## 运行信息`、`## 环境状态`、`## 备注` 四段组织。
- `## 结论` 只写健康/运行状态判断，不列读取文件、文件路径或采集时间。
- `context` 正文面向轮机长等使用人员，不写 `devices`、`context`、字段结构、点位数量、原始编码、校验结果等开发/调试信息。
- 调试信息、读取了哪些 raw-data 文件、清理了哪些旧产物，只从脚本 stdout 返回，不写入 result 文件。
- 即使没有找到 raw-data 文件，也要输出一次 result，说明数据不足。

## 清理规则

每次运行结束后，检查：

```text
result/engine-health/outputs/
```

只处理文件名匹配 `engine-health-*__result.json` 的本 skill 产物。先按文件名时间排序，时间无法解析时使用文件修改时间；最新 6 份构成固定保护集，不因超过 12 小时而删除。目录不足 6 份时全部保留；超过 6 份时，从时间最早的文件开始删除，直到只剩最新 6 份，即使被删除文件仍在 12 小时内也一样执行。不删除 `input/`，不影响 AI 异常检测、OEM 报警或维修事件目录。

---
name: ship-health-score
description: 船端2.0长周期健康基线异动跟踪。显式要求分析全部历史或转换既有健康评分产物时使用；生成异动跟踪事件、趋势和核实建议，不属于启动或每小时任务。
---
# 船端2.0异动跟踪

默认不运行。未注册启动任务、每小时调度或网络API；仅按明确的单次调用执行。不要因健康分析、短窗口检测或普通对话自动扫描全历史。

## 来源与计算

迁入自 `ship_sop/ship-health-score`：评分核心、固定中位数/MAD基线、结果Schema和原Skill契约。来源与哈希见 [source-manifest.json](references/source-manifest.json)，原算法见 [original-method.md](references/original-method.md)。保留按转速区间计算残差、EWMA、7/30天累计偏离和五层健康分的方法。日常评分只读固化基线，不执行 `fit` 或 `fit-score`。

船端适配入口为 `scripts/run_tracking.py`。全量模式流式读取本地SQLite全部记录，按30分钟聚合实测值；有效占比不足70%的测点窗口保留缺测。时序和压力单位沿用本项目映射，不将燃油指令当作实测负荷。评分使用全部窗口，页面曲线最多保留480点并保留起止点。

## 两种显式调用

以下命令均在 `phase2-demo` 目录执行，默认只输出候选，不创建正式事件。

转换已经生成的评分结果，不重算历史：

```powershell
python .claude/skills/ship-health-score/scripts/run_tracking.py --result-dir <评分结果目录> --output .local-data/tracking-runs/<本轮编号>
```

明确需要全量分析时才执行：

```powershell
python .claude/skills/ship-health-score/scripts/run_tracking.py --run-all-history --data-dir .local-data --output .local-data/tracking-runs/<本轮编号>
```

生成船端事件文件预览（不进入正式事件中心）：

```powershell
node scripts/import-health-tracking.mjs --input .local-data/tracking-runs/<本轮编号>/tracking-candidates.json --output .local-data/tracking-preview/<本轮编号>
```

以后明确要求将本轮结果发布到事件中心时，在上一条命令后增加 `--publish --data-dir .local-data`。不要在仅复制、适配或验证Skill时使用正式发布。

## 事件语义与约束

- 人工上报为报警事件；每小时短窗口异常检测为预警事件；本Skill为异动跟踪。健康分中的“预警/严重”是评分等级，不改变本Skill事件类型。
- 候选规则：匹配运行工况基线至少30个基线窗口；同工况有效历史至少30窗口且跨度7天；最近连续3窗口健康分低于80、绝对标准化残差至少2、窗口间隔不超过24小时。它们是当前软件候选策略，不是厂家报警值；完整规则记录在产物 `policy`。
- 停机、缺测、未知工况、基线不匹配或历史不足均不生成候选；原因写入 `skipped`。累计面积只代表实际覆盖的输入历史，不宣称不足30天的历史已经覆盖30天。
- 每个测点形成独立待决策事件，第一责任人为轮机长。同测点、同工况、同基线的未闭环事件更新证据，保留已有任务、备注和会话；重复导入、已关闭或删除的旧证据不重新建卡。
- 区分持续偏离、工况变化与部件故障。不将评分直接转成维修指令，不自动派工或闭环。核实后走现有事件助手、排查、提前维保和效果观察流程。

产物字段和页面映射见 [ship2-contract.md](references/ship2-contract.md)。当前没有全量分析结果，不得声称已经完成实船长周期检测。改造验收使用小样本及隔离事件目录，不启动定时任务。

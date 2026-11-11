# 船端2.0产物契约

## 入口状态

异动跟踪仅由命令行显式执行。`server/local-server.mjs`、`health-scheduler.mjs`和`workflow-service.mjs`均不导入或调度该模块。转换及导入回执固定记录 `schedulerEnabled: false`。已有两个小时任务保持独立。

## 产物

| 产物 | 用途 |
|---|---|
| windows.csv（全量模式） | 只读数据库导出的30分钟实测均值，附窗口真实首末时间和样本数 |
| score/result.json | 原版 `ship-health-score.result.v1` 的整机/系统/缸/局部组/点位健康快照 |
| score/point_metrics_long.csv | 每测点窗口原值、基线、残差、z、EWMA、累计面积和健康分 |
| tracking-candidates.json | `ship2.health-tracking.v1`，候选、跳过原因、基线/结果SHA与策略 |
| tracking-receipt.json | 新建、更新、无变化、抑制的事件ID和是否正式发布 |

原始评分结果文件遵循 `schemas/result.schema.json`。原脚本可额外生成PNG和健康时序CSV；这些属于运行产物，不提交到Git。

每个候选包含 `pointCode/name/unit/start/end/zone/direction/validWindows/spanDays/latest/series`。序列时间为UTC毫秒，展示为北京时间。`latest`与序列末点必须对应窗口结束时间；缺测不可补零。历史跨转速分区时，基线曲线随对应分区显示，不将分区变化当作同工况漂移。

## 事件页面

`server/health-tracking.mjs`将候选转成现有事件模型：

- `type=异动跟踪`、`tracking=true`、`phase=reminder`、`responsible=轮机长`；编号包含`-TR-`，ID使用现有路由支持的`detected-tracking-`前缀。
- `brief`提供来源、结论、适用解释、建议核实事项；`detectionReport.kind=health-tracking`复用现有时间、证据及助手上下文契约。
- `trackingReport`保存独立基线证据、策略、健康快照和曲线；普通页面提交不能修改原始证据。
- 初始建议有“核实测点与现场读数”“核实同工况偏离与调整记录”两步。尚未派发任务，任务/报告数组初始为空；事件对话带初始说明。
- 数据观测提供原始值与固定基线、残差与EWMA、7/30天累计偏离及健康分四个嵌入式Tab。

每个事件输出 `event.json`、`analysis.json`、`evidence.json`、`tasks.json`、`reports.json`、`conversations.json`。`event.json`保留完整trackingReport；`analysis.json`包含分析和追踪数据。正式发布走同一个事件仓库，不新建平行权限或会话机制。

## 依赖与边界

评分依赖Python的numpy、pandas、Pillow；SQLite/候选转换仅用标准库。Node使用项目已有环境。迁入文件源清单记录原件SHA，`health_score.py`只增加窗口CSV输入支持，原评分公式保持不变。试验环境校正、旧输出目录和旧项目数据库路径不纳入本入口；环境校正尚未被宣称为本次可用功能。

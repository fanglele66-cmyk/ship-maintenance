# 任务原始观测窗口

更新：2026-10-26。原始传感器采样均以只读数据库为准，保留时刻、行号、数值与间隔，不插值。

| 案例 | 截止时刻 | 1H / 6H / 24H 条数 |
|---|---|---|
| 二缸报警 | 2026-04-30 23:33:00 | 288 / 1725 / 6976 |
| 控制空气预警 | 2026-05-23 21:28:40 | 194 / 1106 / 5825 |
| 一缸长期基线核实 | 2026-08-04 23:00:00 | 233 / 1179 / 5806 |
| 四缸长期基线检查 | 2026-08-07 14:20:00 | 283 / 1736 / 6888 |

长期统计另见 [长期基线案例](long-term-baseline-cases.md)。月度统计不是上述短窗的外推；四缸任务与父跟踪共用 0807 采样，数据角色是 `baseline-source-history`，不是修后验证。

数据位于 `src/mock/realObservationHistory.json`，月度数据位于 `src/mock/baselineHistory.json`。导出脚本分别为 `scripts/export-real-observation-history.py`、`scripts/export-baseline-history.py`，均支持 `--database ... --check` 只读复核。

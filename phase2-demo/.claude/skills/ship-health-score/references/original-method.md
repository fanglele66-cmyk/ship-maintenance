# ship-health-score

这是一个独立的船舶设备健康度评分原型目录，当前用于验证健康基线、残差趋势图、
EWMA/CUSUM 健康度指标和 `result.json` 输出结构。

## 当前口径

健康基线固化为单独文件，日常评分不重新拟合：

- 默认基线文件：`ship-health-score/baselines/health_baseline_median_mad.json`
- 健康基线：每个点位、每个 RPM 工况的历史中位数 `median`
- 健康波动：输出 `MAD`、`std`、`IQR`，评分尺度优先使用 `MAD`
- 当前基线拟合样本：2026-03、2026-04、2026-05，排除 2026-04-30

健康信号：

```text
residual_raw = raw_value - baseline_median
z = residual_raw / baseline_scale_mad
EWMA = abs(z) 的指数滑动平均
D_t = max(0, abs(z_t) - 0.5)
CUSUM_7d_area = 最近 7 天 D_t 累计面积
CUSUM_30d_area = 最近 30 天 D_t 累计面积
```

滚动基线当前不参与评分，也不在图上绘制。

## 运行方式

首次生成或需要重建健康基线时：

```powershell
python ship-health-score\health_score.py --mode fit-score --input tmp\raw_json\cruise --output ship-health-score\output
```

日常评分只读取已固化基线：

```powershell
python ship-health-score\health_score.py --mode score --input tmp\raw_json\cruise --output ship-health-score\output
```

生成冷却系统和轴系系统图集：

```powershell
python ship-health-score\scripts\generate_system_examples.py --mode score --input tmp\raw_json\cruise --output ship-health-score\output-system-examples --systems cooling_system,shafting_system
```

## 输出文件

主入口输出：

- `output/result.json`：整机、系统、局部组、缸、点位健康度分析结果。
- `output/health_timeseries.csv`：整机、系统、局部组健康度时间序列。
- `output/point_metrics_long.csv`：每个窗口、每个点位的原始值、残差、基线、EWMA、CUSUM 面积和健康分。
- `output/health_score_overview.png`：整机及系统健康度总览图。
- `output/health_detail_<scope>_<target>.png`：点位/系统/局部组/缸的健康明细图。
- `output/health_detail_cylinder_6.png`：默认额外输出的 6 缸整缸明细图，覆盖排气、扫气、活塞冷却油、缸套水等缸相关点位。
- `baselines/health_baseline_median_mad.json`：固化健康基线。
- `schemas/result.schema.json`：`result.json` schema。

两系统图集输出：

- `output-system-examples/whole_engine_health.png`：整机健康度趋势图。
- `output-system-examples/systems/<system>/system_health.png`：单系统健康度趋势图。
- `output-system-examples/systems/<system>/points/*.png`：每个点位一张明细图。
- `output-system-examples/manifest.json`：图集清单、基线来源、RPM 工况分布。

## 明细图含义

单点位明细图分为四块：

```text
上图：
  左轴：标准化残差 z（σ）、EWMA |z|（σ）、参考线 |z|=2
  z 趋势虚线，并在图上标记趋势总偏移量

中图：
  7 天累计偏离面积、30 天累计偏离面积

下图：
  原始残差 residual_raw，单位沿用传感器原始单位
  0 参考线
  原始残差趋势虚线，并在图上标记趋势总偏移量

第四图：
  原始传感器值 raw_value，单位沿用传感器原始单位
  健康基线 baseline_median，作为原始值曲线的固定参考线
```

健康趋势图不绘制趋势虚线；残差明细图保留趋势虚线，便于判断单点位偏离方向和速度。
参考线使用橙色，趋势虚线使用大红色，以便和累计偏离曲线区分。

## 健康度打分标准

打分标准固化在 `ship-health-score/health_score.py`，并写入 `result.json` 的
`method.scoring_standard`：

- 分项风险通过 `smoothstep` 从低阈值映射到高阈值：低于低阈值为 0 风险，高于高阈值为 1 风险。
- 点位风险公式：`0.15 * instant_abs_z_risk + 0.25 * ewma_abs_z_risk + 0.30 * cusum_7d_area_risk + 0.30 * cusum_30d_area_risk`。
- 点位健康分：`health_score = 100 * (1 - risk)`。
- 层级聚合：`aggregated_risk = min(1, 0.25 * max(child_risks) + 0.75 * mean(child_risks))`。
- 状态分档：优秀 `>=90`，良好 `>=80`，关注 `>=65`，预警 `>=45`，严重 `<45`。

阈值策略常量包括：

- `POINT_RISK_WEIGHTS`
- `POINT_RISK_THRESHOLD_POLICY`
- `LEVEL_RISK_WEIGHTS`
- `HEALTH_SCORE_BANDS`

## 层级

健康度按五类输出：

1. 点位：单个 DC key。
2. 局部组：例如轴承组、活塞冷却油、缸套水出口。
3. 系统：例如冷却系统、轴系系统。
4. 缸：按 `cyl1` 到 `cyl6` 相关点位聚合。
5. 整机：由系统健康风险聚合。

聚合口径使用温和的 max-plus-average 风险聚合，避免单点瞬时尖峰直接把整机打成严重状态。

## 可复用 skill

仓库内固化了两份 skill：

- `skills/ship-health-score-analysis`：健康基线、评分和 `result.json` 工作流。
- `skills/ship-health-plotting`：点位/系统/缸健康图绘制工作流。

正式接入线上流程前，还需要结合真实案例、人工标注、维修记录和业务阈值做回放验证。

---
name: ship-health-score-analysis
description: Analyze ship equipment health in D:\zstech\ship_sop\ship-health-score. Use when building or reusing fixed median+MAD health baselines, scoring raw DC key JSON windows, producing result.json for whole engine, systems, cylinders, local groups, and sensors, or validating the ship-health-score result schema.
---

# Ship Health Score Analysis

## Workflow

Use `ship-health-score/health_score.py` from the repository root.

Fit the fixed health baseline only when the user asks to build or refresh the baseline:

```powershell
python ship-health-score\health_score.py --mode fit-score --input tmp\raw_json\cruise --output ship-health-score\output
```

Default baseline fitting uses March 2026, April 2026 excluding April 30, and May 2026:

```text
--baseline-months 2026-03,2026-04,2026-05
--baseline-exclude-dates 2026-04-30
```

For ordinary health analysis, score against the existing fixed baseline:

```powershell
python ship-health-score\health_score.py --mode score --input tmp\raw_json\cruise --output ship-health-score\output
```

## Contract

- Default fixed baseline: `ship-health-score/baselines/health_baseline_median_mad.json`.
- Result artifact: `ship-health-score/output/result.json`.
- Result schema: `ship-health-score/schemas/result.schema.json`.
- Do not recompute or overwrite the baseline during routine `score` runs.
- Treat `ship-health-score/output*` as generated artifacts unless the user explicitly asks to include them.

## Health Method

- Healthy baseline equals historical median per sensor and RPM zone.
- Healthy fluctuation records MAD, standard deviation, and IQR; scoring uses the MAD-derived robust scale.
- Residual uses raw units: `raw_value - baseline_median`.
- Standardized residual uses `z = residual_raw / baseline_scale_mad`.
- EWMA is based on `abs(z)`.
- CUSUM for health is cumulative deviation area, not a hard alarm threshold:

```text
D_t = max(0, abs(z_t) - 0.5)
cusum_7d_area = recent 7-day sum of D_t
cusum_30d_area = recent 30-day sum of D_t
```

## Scoring Standard

Keep the scoring standard synchronized across `health_score.py`, `README.md`, `schemas/result.schema.json`, and `result.json -> method.scoring_standard`.

- Component risk mapping: smoothstep from low threshold to high threshold; below low is 0 risk, above high is 1 risk.
- Point risk: `0.15 * instant_abs_z_risk + 0.25 * ewma_abs_z_risk + 0.30 * cusum_7d_area_risk + 0.30 * cusum_30d_area_risk`.
- Health score: `health_score = round(100 * (1 - clipped_risk), 1)`.
- Level aggregation: `aggregated_risk = min(1, 0.25 * max(child_risks) + 0.75 * mean(child_risks))`.
- Score bands: excellent `>=90`, good `>=80`, watch `>=65`, warning `>=45`, critical `<45`.

## Validation

After code or schema changes, run:

```powershell
python -m py_compile ship-health-score\health_score.py ship-health-score\scripts\generate_system_examples.py
python ship-health-score\health_score.py --mode fit-score --input tmp\raw_json\cruise --output ship-health-score\output
```

Check that `result.json` includes `schema_version`, `source`, `method`, `latest`, `health`, `diagnostics`, `groups`, and `artifacts`.

# Result Contract

`result.json` must follow `ship-health-score/schemas/result.schema.json`.

Required top-level sections:

- `schema_version`: must be `ship-health-score.result.v1`.
- `source`: input windows, time coverage, RPM zone counts, and fixed baseline metadata.
- `method`: baseline, residual, EWMA, CUSUM health-area definitions, plus `scoring_standard`.
- `latest`: latest whole-engine score plus top system, cylinder, local-group, and sensor risks.
- `health`: whole-engine, system, local-group, cylinder, and sensor latest health snapshots.
- `diagnostics`: lowest whole-engine window and optional date-specific windows.
- `groups`: system/local-group/cylinder membership used for aggregation.
- `artifacts`: generated CSV, PNG, baseline, and result paths.

Generated `output*` folders are analysis artifacts; do not commit them by default.

`method.scoring_standard` records the point-risk formula, risk-to-score formula, smoothstep threshold policy, level aggregation formula, and score bands. Keep this object valid against `schemas/result.schema.json`.

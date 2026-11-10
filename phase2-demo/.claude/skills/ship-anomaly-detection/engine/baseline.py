from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from .math_utils import feature_vector, predict


SKILL_DIR = Path(__file__).resolve().parents[1]
BASELINE_PATH = SKILL_DIR / "data" / "main_engine_baselines.json"


@lru_cache(maxsize=1)
def load_baselines(path: str | Path | None = None) -> dict[str, Any]:
    baseline_path = Path(path) if path else BASELINE_PATH
    if not baseline_path.is_file():
        raise FileNotFoundError(
            f"Missing configured statistical baseline: {baseline_path}. "
            "Run scripts/calibrate_main_engine.py against the historical SQLite dataset."
        )
    return json.loads(baseline_path.read_text(encoding="utf-8"))


def predict_model(values: dict[str, float], feature_spec: dict, model: dict) -> float | None:
    features = feature_vector(values, feature_spec)
    if features is None:
        return None
    coefficients = model.get("coefficients", [])
    if len(coefficients) != len(features):
        return None
    return predict(coefficients, features)


def clear_baseline_cache() -> None:
    load_baselines.cache_clear()

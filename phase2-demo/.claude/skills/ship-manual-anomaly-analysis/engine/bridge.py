from __future__ import annotations

import importlib
import importlib.util
import sys
from functools import lru_cache
from pathlib import Path
from types import ModuleType


SKILL_DIR = Path(__file__).resolve().parents[1]
ANOMALY_SKILL_DIR = SKILL_DIR.parent / "ship-anomaly-detection"
ANOMALY_ENGINE_DIR = ANOMALY_SKILL_DIR / "engine"
ANOMALY_PACKAGE = "_ship_anomaly_detection_engine"


def _expose_anomaly_skill_dependencies() -> None:
    """Make sibling detector packages importable in the bridged runtime."""
    skill_path = str(ANOMALY_SKILL_DIR)
    if skill_path not in sys.path:
        sys.path.insert(0, skill_path)


@lru_cache(maxsize=1)
def _load_package() -> ModuleType:
    _expose_anomaly_skill_dependencies()
    init_path = ANOMALY_ENGINE_DIR / "__init__.py"
    if not init_path.is_file():
        raise RuntimeError(f"ship-anomaly-detection engine is missing: {init_path}")
    existing = sys.modules.get(ANOMALY_PACKAGE)
    if existing is not None:
        return existing
    spec = importlib.util.spec_from_file_location(
        ANOMALY_PACKAGE,
        init_path,
        submodule_search_locations=[str(ANOMALY_ENGINE_DIR)],
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load ship-anomaly-detection engine package")
    package = importlib.util.module_from_spec(spec)
    sys.modules[ANOMALY_PACKAGE] = package
    spec.loader.exec_module(package)
    return package


def anomaly_module(name: str) -> ModuleType:
    _load_package()
    return importlib.import_module(f"{ANOMALY_PACKAGE}.{name}")

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any


LIB_DIR = Path(__file__).resolve().parents[3] / "lib"
if str(LIB_DIR) not in sys.path:
    sys.path.insert(0, str(LIB_DIR))

from ship_workspace_config import (  # noqa: E402,F401
    ShipWorkspaceConfigError as ShipProfileError,
    analyzable_devices,
    analyzer_profile,
    collect_device_data_ids,
    device_for_data_id,
    devices_for_analyzer,
    import_entrypoint,
    knowledge_package,
    load_ship_profile,
    primary_analyzer,
)


def validate_profile_registry(
    profile: dict[str, Any],
    registry: dict[str, Any],
    analyzer: str | None = None,
) -> None:
    selected = analyzer or str(registry.get("analyzer") or "").strip()
    if not selected:
        selected = primary_analyzer(profile)
    profile_ids = set(devices_for_analyzer(profile, selected))
    registry_ids = set(registry.get("devices", {}))
    if profile_ids != registry_ids:
        raise ShipProfileError(
            f"ship profile devices for analyzer {selected!r} must exactly match "
            "the algorithm registry; "
            f"profile={sorted(profile_ids)}, registry={sorted(registry_ids)}"
        )

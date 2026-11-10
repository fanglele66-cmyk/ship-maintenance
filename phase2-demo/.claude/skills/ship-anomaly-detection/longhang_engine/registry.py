"""
Sensor Registry — V7.0 rewrite
================================
Three-layer architecture:
  External input (DC Key / Chinese name / encoding)
      ↓  EXTERNAL_TO_INTERNAL
  Internal standard name (internal_name)   ← code-level canonical key
      ↓  INTERNAL_TO_DISPLAY
  Display layer (display_name)

Usage:
  resolve('1缸排气温度')   → 'exh_cyl1'
  get_display('exh_cyl1') → '1缸排气温度'
  get_group('exh_cyl1')   → 'exhaust_temp'
  SENSOR_GROUPS['exhaust_temp'] → ['exh_cyl1', ..., 'exh_cyl6']

To switch vessels: swap the mapping JSON only — zero code changes.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

# ── Path config ──────────────────────────────────────────────────────────────
_SKILL_DIR = Path(__file__).resolve().parent.parent
_MAPPING_DIR = _SKILL_DIR / "data" / "mappings"
_DEFAULT_MAPPING = next(
    iter(sorted(_MAPPING_DIR.glob("*_mapping.json"))),
    _MAPPING_DIR / "sensor_mapping.json",
)


# ── Internal helpers ─────────────────────────────────────────────────────────
def _name_to_group(iname: str) -> str:
    """Infer detection group from internal_name."""
    if iname in ("rpm", "turbo_rpm"):
        return "rpm"
    if iname.startswith("exh_dev_"):
        return "exhaust_dev"
    if iname.startswith("exh_cyl") or iname in ("exh_before_turbo", "exh_after_turbo"):
        return "exhaust_temp"
    if iname.startswith("scav_cyl"):
        return "scavenge_temp"
    if iname == "scav_air_press":
        return "scavenge_press"
    if iname.startswith("piston_lo_cyl"):
        return "piston_lo"
    if iname.startswith("cfw_out_cyl"):
        return "cfw_outlet"
    if iname in ("cfw_in_press", "cfw_in_temp"):
        return "cfw_inlet"
    if iname in ("ac_in_temp", "ac_out_temp"):
        return "air_cooler"
    if iname.startswith("lo_turbo_"):
        return "turbo_lo"
    if iname.startswith(("lo_fwd_damper", "lo_aft_damper")):
        return "damper_lo"
    if iname in ("lo_main_press", "lo_main_temp", "lo_thrust_temp"):
        return "lo_main"
    if iname in ("start_air_press", "ctrl_air_press", "ctrl_air_press_safety"):
        return "control_air"
    if iname in ("shaft_aft_bearing_temp", "shaft_mid_bearing_temp"):
        return "bearing_temp"
    if iname.startswith("fo_"):
        return "fuel_oil"
    if iname.startswith("servo_"):
        return "servo_oil"
    return "other"


def _load_mapping(mapping_path: Optional[str | Path] = None) -> dict:
    """Load mapping JSON and build all index structures."""
    path = Path(mapping_path) if mapping_path else _DEFAULT_MAPPING
    if not path.exists():
        fallback = sorted((_SKILL_DIR / "data" / "mappings").glob("*_mapping.json"))
        if fallback:
            path = fallback[0]
        else:
            raise FileNotFoundError(
                f"No sensor mapping found: {_DEFAULT_MAPPING} not found "
                f"and no *_mapping.json in {_SKILL_DIR / 'data' / 'mappings'}"
            )

    with open(path, encoding="utf-8") as f:
        raw = json.load(f)

    # Core indices
    registry: dict[str, dict] = {}
    ext2int: dict[str, str] = {}
    int2display: dict[str, str] = {}
    sensor_groups: dict[str, list[str]] = {}
    int2group: dict[str, str] = {}
    int2unit: dict[str, str] = {}
    int2cid: dict[str, Optional[int]] = {}

    for entry in raw["mappings"]:
        iname: str = entry["internal_name"]
        display: str = entry["display_name"]
        unit: str = entry["unit"]
        cid: Optional[int] = entry.get("cid")

        registry[iname] = entry
        int2display[iname] = display
        int2unit[iname] = unit
        int2cid[iname] = cid

        grp = _name_to_group(iname)
        int2group[iname] = grp
        sensor_groups.setdefault(grp, []).append(iname)

        for key in entry["external_keys"]:
            ext2int[key] = iname
        ext2int[iname] = iname  # self-map

    return {
        "vessel": raw.get("vessel", "unknown"),
        "n_cylinders": raw.get("n_cylinders", 6),
        "SENSOR_REGISTRY": registry,
        "EXTERNAL_TO_INTERNAL": ext2int,
        "INTERNAL_TO_DISPLAY": int2display,
        "SENSOR_GROUPS": sensor_groups,
        "INTERNAL_TO_GROUP": int2group,
        "INTERNAL_TO_UNIT": int2unit,
        "INTERNAL_TO_CID": int2cid,
    }


# ── Module-level singleton (auto-loaded on first import) ─────────────────────
_MAP = _load_mapping()

SENSOR_REGISTRY: dict[str, dict] = _MAP["SENSOR_REGISTRY"]
EXTERNAL_TO_INTERNAL: dict[str, str] = _MAP["EXTERNAL_TO_INTERNAL"]
INTERNAL_TO_DISPLAY: dict[str, str] = _MAP["INTERNAL_TO_DISPLAY"]
SENSOR_GROUPS: dict[str, list[str]] = _MAP["SENSOR_GROUPS"]
INTERNAL_TO_GROUP: dict[str, str] = _MAP["INTERNAL_TO_GROUP"]

VESSEL: str = _MAP["vessel"]
N_CYLINDERS: int = _MAP["n_cylinders"]


# ── Query functions ──────────────────────────────────────────────────────────
def resolve(key: str) -> Optional[str]:
    """Resolve any external key / internal name → canonical internal_name.

    Supports compound keys split by '/', '\\\\', or '_'.
    """
    if key in EXTERNAL_TO_INTERNAL:
        return EXTERNAL_TO_INTERNAL[key]
    for sep in ("/", "\\"):
        if sep in key:
            for part in key.split(sep):
                if part in EXTERNAL_TO_INTERNAL:
                    return EXTERNAL_TO_INTERNAL[part]
    return None


def get_display(name: str) -> str:
    """internal_name → Chinese display name."""
    return INTERNAL_TO_DISPLAY.get(name, name)


def get_group(name: str) -> str:
    """internal_name → detection group."""
    return INTERNAL_TO_GROUP.get(name, "other")


def find_cyl_sensors(prefix: str, n: Optional[int] = None) -> list[str]:
    """Find per-cylinder sensors, e.g. find_cyl_sensors('exh_cyl') → ['exh_cyl1', ..., 'exh_cyl6']."""
    count = n or N_CYLINDERS
    return [f"{prefix}{i}" for i in range(1, count + 1) if f"{prefix}{i}" in SENSOR_REGISTRY]


# ── Reload helper (for vessel switching) ─────────────────────────────────────
def build_registry(mapping_path: Optional[str | Path] = None) -> dict:
    """Reload mapping from a different JSON (call when switching vessels)."""
    m = _load_mapping(mapping_path)
    globals().update({
        "SENSOR_REGISTRY": m["SENSOR_REGISTRY"],
        "EXTERNAL_TO_INTERNAL": m["EXTERNAL_TO_INTERNAL"],
        "INTERNAL_TO_DISPLAY": m["INTERNAL_TO_DISPLAY"],
        "SENSOR_GROUPS": m["SENSOR_GROUPS"],
        "INTERNAL_TO_GROUP": m["INTERNAL_TO_GROUP"],
        "VESSEL": m["vessel"],
        "N_CYLINDERS": m["n_cylinders"],
    })
    return m

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from .ship_profile import (
    analyzer_profile,
    devices_for_analyzer,
    load_ship_profile,
    primary_analyzer,
    validate_profile_registry,
)
from .types import PointSpec


SKILL_DIR = Path(__file__).resolve().parents[1]
FORBIDDEN_IDENTITY_FIELDS = {
    "ship_id",
    "ship_name",
    "shipId",
    "shipName",
    "sensorApiShipId",
}


def _format(template: str | None, **values: Any) -> str | None:
    return template.format(**values) if template else None


def _point_from_dict(raw: dict[str, Any], **values: Any) -> PointSpec:
    return PointSpec(
        index=int(raw["index"]),
        key=str(_format(raw["key"], **values)),
        group=str(_format(raw.get("group", "other"), **values)),
        unit=str(raw.get("unit", "raw")),
        kind=str(raw.get("kind", "continuous")),
        object_id=_format(raw.get("object_id"), **values),
        bank=values.get("bank") or raw.get("bank"),
        cylinder=values.get("cylinder") or raw.get("cylinder"),
        signed_16=bool(raw.get("signed_16", False)),
        ch2=bool(raw.get("ch2", raw.get("kind", "continuous") == "continuous")),
        iqr=bool(raw.get("iqr", raw.get("kind", "continuous") == "continuous")),
        stopped=bool(raw.get("stopped", False)),
    )


def _mapping_group(key: str) -> str:
    if key in {"rpm", "turbo_rpm"}:
        return "rpm"
    if key.startswith("exh_dev_"):
        return "exhaust_dev"
    if key.startswith("exh_cyl") or key in {"exh_before_turbo", "exh_after_turbo"}:
        return "exhaust_temp"
    if key.startswith("scav_cyl"):
        return "scavenge_temp"
    if key == "scav_air_press":
        return "scavenge_press"
    if key.startswith("piston_lo_cyl"):
        return "piston_lo"
    if key.startswith("cfw_out_cyl"):
        return "cfw_outlet"
    if key in {"cfw_in_press", "cfw_in_temp"}:
        return "cfw_inlet"
    if key in {"ac_in_temp", "ac_out_temp"}:
        return "air_cooler"
    if key.startswith("lo_turbo_"):
        return "turbo_lo"
    if key.startswith(("lo_fwd_damper", "lo_aft_damper")):
        return "damper_lo"
    if key in {"lo_main_press", "lo_main_temp", "lo_thrust_temp"}:
        return "lo_main"
    if key in {"start_air_press", "ctrl_air_press", "ctrl_air_press_safety"}:
        return "control_air"
    if key in {"shaft_aft_bearing_temp", "shaft_mid_bearing_temp"}:
        return "bearing_temp"
    if key.startswith("fo_"):
        return "fuel_oil"
    if key.startswith("servo_"):
        return "servo_oil"
    return "other"


def _points_from_mapping(
    raw: dict[str, Any], mapping_path: Path | None = None
) -> list[PointSpec]:
    mapping_value = raw.get("mapping_file")
    if mapping_path is None and not mapping_value:
        return []
    active_mapping_path = (
        mapping_path.resolve()
        if mapping_path is not None
        else (SKILL_DIR / str(mapping_value)).resolve()
    )
    mapping = json.loads(active_mapping_path.read_text(encoding="utf-8"))
    points: list[PointSpec] = []
    for index, item in enumerate(mapping.get("mappings", [])):
        key = str(item["internal_name"])
        cylinder = item.get("cid")
        points.append(
            PointSpec(
                index=index,
                key=key,
                group=_mapping_group(key),
                unit=str(item.get("unit") or "raw"),
                object_id=(f"cylinder_{int(cylinder)}" if cylinder is not None else key),
                cylinder=(int(cylinder) if cylinder is not None else None),
                ch2=key != "rpm",
                iqr=key != "rpm",
                stopped=key.startswith("exh_cyl") or "bearing_temp" in key,
            )
        )
    if not points:
        raise ValueError(f"mapping_file contains no mappings: {active_mapping_path}")
    return points


def _expand_template(template: dict[str, Any]) -> list[PointSpec]:
    points: list[PointSpec] = []
    start = int(template["start"])
    numbers = list(
        range(
            int(template.get("number_start", 0)),
            int(template.get("number_end", -1)) + 1,
        )
    )
    if numbers:
        for offset, number in enumerate(numbers):
            raw = dict(template)
            raw["index"] = start + offset
            points.append(
                _point_from_dict(
                    raw,
                    bank=None,
                    cylinder=None,
                    position=None,
                    number=number,
                )
            )
        return points

    offset = 0
    banks = list(template.get("banks", [None]))
    cylinders = list(range(1, int(template.get("cylinders", 1)) + 1))
    positions = list(range(1, int(template.get("positions", 1)) + 1))
    for bank in banks:
        for cylinder in cylinders:
            for position in positions:
                values = {
                    "bank": bank,
                    "cylinder": cylinder,
                    "position": position,
                    "number": None,
                }
                raw = dict(template)
                raw["index"] = start + offset
                points.append(_point_from_dict(raw, **values))
                offset += 1
    return points


@lru_cache(maxsize=8)
def _load_registry_files(registry_path_text: str, mapping_path_text: str) -> dict[str, Any]:
    registry_path = Path(registry_path_text)
    mapping_path = Path(mapping_path_text)
    raw = json.loads(registry_path.read_text(encoding="utf-8"))
    forbidden = sorted(set(raw) & FORBIDDEN_IDENTITY_FIELDS)
    if forbidden:
        raise ValueError(
            "main_engine_registry.json must not define ship identity fields "
            f"{forbidden}; use workspace data/ship-profile.json"
        )
    points = _points_from_mapping(raw, mapping_path)
    if not points:
        points = [_point_from_dict(item) for item in raw.get("points", [])]
        for template in raw.get("point_templates", []):
            points.extend(_expand_template(template))
    points.sort(key=lambda point: point.index)
    if [point.index for point in points] != list(range(len(points))):
        raise ValueError(
            "main_engine_registry.json must define contiguous model indices from zero"
        )
    raw["point_specs"] = points
    raw["points_by_index"] = {point.index: point for point in points}
    raw["points_by_key"] = {point.key: point for point in points}
    return raw


def load_registry(workspace: str | Path = ".") -> dict[str, Any]:
    root = Path(workspace).resolve()
    profile, _ = load_ship_profile(root)
    analyzer = primary_analyzer(profile)
    config = analyzer_profile(profile, analyzer)
    return _load_registry_files(
        str(root / config["registryPath"]),
        str(root / config["mappingPath"]),
    )


def point_specs() -> list[PointSpec]:
    return list(load_registry()["point_specs"])


def point_by_index(index: int) -> PointSpec | None:
    return load_registry()["points_by_index"].get(index)


def point_by_key(key: str) -> PointSpec | None:
    return load_registry()["points_by_key"].get(key)


def group_members(group_config: dict[str, Any]) -> list[str]:
    if "members" in group_config:
        return list(group_config["members"])
    template = str(group_config["member_template"])
    return [
        template.format(bank=group_config.get("bank", ""), cylinder=cylinder)
        for cylinder in range(1, int(group_config.get("cylinders", 6)) + 1)
    ]


def delta_pairs() -> list[dict[str, Any]]:
    pairs: list[dict[str, Any]] = []
    for raw in load_registry().get("ch3_pairs", []):
        if not raw.get("template"):
            pairs.append(dict(raw))
            continue
        for bank in raw.get("banks", [None]):
            for cylinder in range(1, int(raw.get("cylinders", 1)) + 1):
                values = {"bank": bank, "cylinder": cylinder}
                pairs.append(
                    {
                        "id": str(raw["id"]).format(**values),
                        "a": str(raw["a_template"]).format(**values),
                        "b": str(raw["b_template"]).format(**values),
                        "group": raw["group"],
                        "object_id": str(raw["object_template"]).format(**values),
                        "bank": bank,
                        "cylinder": cylinder,
                        "meaning": raw.get("meaning", ""),
                    }
                )
    return pairs


def device_config(
    equipment_id: str,
    workspace: str | Path = ".",
) -> dict[str, Any]:
    devices = load_registry(workspace).get("devices", {})
    if equipment_id not in devices:
        raise KeyError(f"Unsupported equipment_id: {equipment_id}")
    profile, _ = load_ship_profile(workspace)
    registry = load_registry(workspace)
    validate_profile_registry(profile, registry)
    analyzer = str(registry.get("analyzer") or primary_analyzer(profile))
    configured = devices_for_analyzer(profile, analyzer)[equipment_id]
    return {
        **devices[equipment_id],
        "device_name": configured["deviceName"],
        "device_data_id": configured["deviceDataId"],
    }


def equipment_id_for_name(
    device_name: str,
    workspace: str | Path = ".",
) -> str | None:
    profile, _ = load_ship_profile(workspace)
    registry = load_registry(workspace)
    validate_profile_registry(profile, registry)
    analyzer = str(registry.get("analyzer") or primary_analyzer(profile))
    for equipment_id, config in devices_for_analyzer(
        profile, analyzer
    ).items():
        if config.get("deviceName") == device_name:
            return equipment_id
    return None

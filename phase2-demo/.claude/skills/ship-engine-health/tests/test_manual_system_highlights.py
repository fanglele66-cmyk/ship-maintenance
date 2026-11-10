"""Manual symbolic systems resolve only through the current ship's configuration."""
from __future__ import annotations

import importlib.util
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parents[1]
WORKSPACE = SKILL_DIR.parents[2]
spec = importlib.util.spec_from_file_location("health_manual_system_highlights", SKILL_DIR / "scripts/run_engine_health.py")
assert spec is not None and spec.loader is not None
health = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = health
spec.loader.exec_module(health)

PROFILE_REF = ".claude/skills/ship-engine-health/data/system-profiles.json"


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def event(**fields: object) -> dict:
    return {"event_id": "manual-multiple", "equipment_name": "主机", "status": "active",
            "event_title": "主机人工上报异常", "systemType": "fuel_oil",
            "systemTypes": ["fuel_oil", "cooling_water"], **fields}


def write_events(root: Path, item: dict) -> None:
    # A duplicated index entry must still count as the same event.
    for ref in health.ACTIVE_EVENT_INDEXES:
        write_json(root / ref, {"events": [item]})


def device_result(events: list[dict], mapping: dict[int, str]) -> dict:
    return health._build_device_result(
        "主机", [{"timestamp": datetime(2026, 9, 15, 10), "points": [
            {"device": "主机", "name": "主机转速", "value": 85, "deviceDataId": "10"},
        ]}], active_events=events, system_type_mapping=mapping, key_device_names={"主机"},
    )


def test_symbolic_arrays_expand_ship_specific_numeric_types_without_double_count(tmp_path: Path) -> None:
    write_json(tmp_path / PROFILE_REF, {"system_aliases": [
        {"system_id": "fuel_oil", "system_types": ["21", "22"]},
        {"system_id": "cooling_water", "system_types": ["22", "31"]},
    ]})
    write_events(tmp_path, event())
    items = health._active_events_by_device(tmp_path)["主机"]
    assert len(items) == 1
    assert items[0]["system_types"] == ["21", "22", "31"]
    result = device_result(items, {21: "燃油供给", 22: "关联介质", 31: "冷却水"})
    assert result["event_count"] == 1
    assert [item["systemType"] for item in result["analysis_highlights"]] == [21, 22, 31]
    assert all(len(item["evidence"]) == 1 for item in result["analysis_highlights"])


@pytest.mark.parametrize("fields", [{"systemType": "3", "systemTypes": None},
                                    {"systemType": 3, "systemTypes": [1, "3", "3"]}])
def test_legacy_numeric_events_work_without_manual_configuration(tmp_path: Path, fields: dict) -> None:
    write_events(tmp_path, event(**fields))
    items = health._active_events_by_device(tmp_path)["主机"]
    result = device_result(items, {1: "燃油", 3: "冷却"})
    assert result["event_count"] == 1
    assert [item["systemType"] for item in result["analysis_highlights"]] == (
        [3] if fields["systemTypes"] is None else [1, 3]
    )


def test_point_code_only_ship_does_not_borrow_numeric_ids_from_other_ships(tmp_path: Path) -> None:
    write_json(tmp_path / PROFILE_REF, {"system_aliases": [
        {"system_id": "fuel_oil", "point_codes": ["DC0041"]},
        {"system_id": "cooling", "point_codes": ["DC0031"]},
    ]})
    write_events(tmp_path, event(systemTypes=["fuel_oil", "cooling"]))
    items = health._active_events_by_device(tmp_path)["主机"]
    assert items[0]["system_types"] == ["fuel_oil", "cooling"]
    result = device_result(items, {1: "燃油", 3: "冷却"})
    assert result["event_count"] == 1
    assert result["analysis_highlights"] == []


def test_current_ship_real_manual_aliases_drive_highlights(tmp_path: Path) -> None:
    source = WORKSPACE / PROFILE_REF
    aliases = json.loads(source.read_text(encoding="utf-8"))["system_aliases"]
    by_id = {item["system_id"]: item for item in aliases}
    cooling = "cooling_water" if "cooling_water" in by_id else "cooling"
    selected = ["fuel_oil", cooling]
    destination = tmp_path / PROFILE_REF
    destination.parent.mkdir(parents=True)
    shutil.copy2(source, destination)
    write_events(tmp_path, event(systemTypes=selected))
    items = health._active_events_by_device(tmp_path)["主机"]
    expected = sorted({int(value) for key in selected for value in by_id[key].get("system_types", [])})
    result = device_result(items, {value: f"本船系统{value}" for value in expected})
    assert result["event_count"] == 1
    assert [item["systemType"] for item in result["analysis_highlights"]] == expected
    if not expected:
        # The current Changhang configuration defines DC groups but no numeric IDs.
        assert items[0]["system_types"] == selected

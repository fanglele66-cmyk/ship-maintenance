from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parents[1]
WORKSPACE = SKILL_DIR.parents[2]
if str(SKILL_DIR) not in sys.path:
    sys.path.insert(0, str(SKILL_DIR))

from engine import mapping  # noqa: E402
from engine.bridge import anomaly_module  # noqa: E402
from engine.contracts import ManualContractError, validate_report  # noqa: E402
from engine.prompt import PromptContractError, parse_fixed_prompt  # noqa: E402


@pytest.fixture
def catalog() -> tuple[dict, dict, dict]:
    profile = json.loads((WORKSPACE / "data/ship-profile.json").read_text(encoding="utf-8"))
    devices = anomaly_module("ship_profile").analyzable_devices(profile)
    device = next(iter(devices.values()))
    point_mapping = json.loads(
        (WORKSPACE / profile["dataSource"]["pointMappingPath"]).read_text(encoding="utf-8")
    )
    profiles = json.loads((SKILL_DIR / "data/system-profiles.json").read_text(encoding="utf-8"))
    by_system: dict[str, list[dict]] = {}
    system_names: dict[str, str] = {}
    for system in profiles["system_aliases"]:
        system_id = system["system_id"]
        system_names[system_id] = system["names"][0]
        by_system[system_id] = [
            row for row in point_mapping["pointList"]
            if str(row.get("deviceDataId")) == str(device["deviceDataId"])
            and int(row.get("dataType") or 0) == 1
            and (
                str(row.get("systemType")) in system.get("system_types", [])
                or row.get("pointCode") in system.get("point_codes", [])
            )
        ]
    report = {
        "ship_id": str(profile["shipId"]), "ser_no": "multi-system-regression",
        "equipment_name": device["deviceName"], "system_name": "主机系统",
        "sensor_names": [by_system["main_engine"][0]["pointName"]],
        "time_window": {"start_time": "2026-09-08T10:17:37", "end_time": "2026-09-09T12:17:37"},
        "description": "人工报告测试，不执行取数或发布。", "image_ids": [],
    }
    return report, by_system, system_names


def _prompt(report: dict, systems: str, sensors: list[str]) -> str:
    return "\n".join([
        "提交异常报告", f"船舶ID：{report['ship_id']}", f"ser_no：{report['ser_no']}",
        f"设备：{report['equipment_name']}", f"系统：{systems}",
        "关联传感器：" + "、".join(sensors),
        f"异常开始时间：{report['time_window']['start_time']}",
        f"异常结束时间：{report['time_window']['end_time']}",
        f"异常描述：{report['description']}", "图片：无",
        "Skill：$ship-manual-anomaly-analysis",
    ])


@pytest.mark.parametrize("separator", ["、", ",", "，", ";", "；"])
def test_prompt_resolves_all_systems_and_sensor_points(catalog, separator: str) -> None:
    report, rows, _ = catalog
    sensors = [rows["main_engine"][0]["pointName"], rows["fuel_oil"][0]["pointName"]]
    parsed = parse_fixed_prompt(_prompt(report, separator.join(["主机系统", "燃油系统", "主机系统"]), sensors))
    assert parsed["system_name"] == "主机系统"
    assert parsed["system_names"] == ["主机系统", "燃油系统"]
    resolved = mapping.resolve_report(WORKSPACE, parsed)
    assert resolved.system_ids == ("main_engine", "fuel_oil")
    assert resolved.system_names == ("主机系统", "燃油系统")
    assert resolved.system_id == "main_engine"
    assert resolved.system_name == "主机系统"
    assert [sensor["pointDataId"] for sensor in resolved.sensors] == [
        str(rows["main_engine"][0]["pointDataId"]), str(rows["fuel_oil"][0]["pointDataId"])
    ]
    assert {sensor["system_id"] for sensor in resolved.sensors} == {"main_engine", "fuel_oil"}
    assert set(sensor["pointDataId"] for sensor in resolved.sensors) <= {
        sensor["pointDataId"] for sensor in resolved.query_sensors
    }
    assert resolved.mechanism_profile["related_system"] == "主机系统、燃油系统"


def test_legacy_single_system_and_scalar_multi_system_input(catalog) -> None:
    report, rows, _ = catalog
    validate_report(report)
    single = mapping.resolve_report(WORKSPACE, report)
    assert single.system_ids == ("main_engine",)
    assert single.system_id == "main_engine"
    report["system_name"] = "主机系统、燃油系统"
    report["sensor_names"].append(rows["fuel_oil"][0]["pointName"])
    validate_report(report)
    assert mapping.resolve_report(WORKSPACE, report).system_ids == ("main_engine", "fuel_oil")


def test_array_only_report_contract_and_conflicting_scalar(catalog) -> None:
    report, rows, _ = catalog
    report.pop("system_name")
    report["system_names"] = ["主机系统", "燃油系统"]
    report["sensor_names"].append(rows["fuel_oil"][0]["pointName"])
    validate_report(report)
    assert mapping.resolve_report(WORKSPACE, report).system_ids == ("main_engine", "fuel_oil")
    report["system_name"] = "排气系统"
    with pytest.raises(ManualContractError, match="system_name 必须"):
        validate_report(report)


def test_more_than_six_selected_points_are_preserved(catalog) -> None:
    report, rows, names = catalog
    selected = rows["exhaust"][:7]
    assert len(selected) == 7
    report["system_name"] = names["exhaust"]
    report["sensor_names"] = [row["pointName"] for row in selected]
    parsed = parse_fixed_prompt(_prompt(report, report["system_name"], report["sensor_names"]))
    resolved = mapping.resolve_report(WORKSPACE, parsed)
    expected = [str(row["pointDataId"]) for row in selected]
    assert [sensor["pointDataId"] for sensor in resolved.sensors] == expected
    assert [sensor["pointDataId"] for sensor in resolved.query_sensors] == expected


def test_selected_system_without_reported_point_is_not_discarded(catalog) -> None:
    report, rows, _ = catalog
    report["system_names"] = ["主机系统", "排气系统"]
    report["sensor_names"] = [rows["exhaust"][0]["pointName"]]
    resolved = mapping.resolve_report(WORKSPACE, report)
    assert resolved.system_ids == ("main_engine", "exhaust")
    assert resolved.system_name == "主机系统"


def test_point_outside_selected_systems_is_rejected(catalog) -> None:
    report, rows, _ = catalog
    report["system_names"] = ["主机系统", "燃油系统"]
    report["sensor_names"].append(rows["exhaust"][0]["pointName"])
    with pytest.raises(mapping.MappingError, match="所属系统不一致"):
        mapping.resolve_report(WORKSPACE, report)


def test_unknown_later_system_is_not_silently_dropped(catalog) -> None:
    report, _, _ = catalog
    report["system_names"] = ["主机系统", "不存在的系统"]
    with pytest.raises(mapping.MappingError, match="不存在的系统"):
        mapping.resolve_report(WORKSPACE, report)


def test_sensor_uniqueness_is_checked_within_selected_systems(catalog, monkeypatch) -> None:
    report, rows, _ = catalog
    conflicting_names = {rows["main_engine"][0]["pointName"], rows["fuel_oil"][0]["pointName"]}
    original = mapping._sensor_aliases

    def with_collision(point_name, equipment_name):
        aliases = original(point_name, equipment_name)
        if point_name in conflicting_names:
            aliases.add(mapping._normalize("共享测点"))
        return aliases

    monkeypatch.setattr(mapping, "_sensor_aliases", with_collision)
    report["system_name"] = "燃油系统"
    report["sensor_names"] = ["共享测点"]
    resolved = mapping.resolve_report(WORKSPACE, report)
    assert resolved.sensors[0]["pointDataId"] == str(rows["fuel_oil"][0]["pointDataId"])
    report["system_name"] = "主机系统"
    report["system_names"] = ["主机系统", "燃油系统"]
    with pytest.raises(mapping.MappingError, match="唯一解析"):
        mapping.resolve_report(WORKSPACE, report)


def test_ambiguous_system_alias_is_rejected(catalog) -> None:
    report, _, _ = catalog
    profiles = {"system_aliases": [
        {"system_id": "one", "names": ["主机系统"]},
        {"system_id": "two", "names": ["主机系统"]},
    ]}
    with pytest.raises(mapping.MappingError, match="无法唯一映射"):
        mapping._resolve_system_selection(report, profiles)


def test_separator_only_system_is_rejected(catalog) -> None:
    report, _, _ = catalog
    with pytest.raises(PromptContractError, match="至少包含"):
        parse_fixed_prompt(_prompt(report, "、；", report["sensor_names"]))

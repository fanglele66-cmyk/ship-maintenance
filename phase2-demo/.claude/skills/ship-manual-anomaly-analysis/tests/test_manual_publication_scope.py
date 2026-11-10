"""Regressions for complete manual event scope and shared output contracts."""
from __future__ import annotations

import copy
import importlib.util
import json
import sys
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

import pytest
from jsonschema import Draft202012Validator

SKILL_DIR = Path(__file__).resolve().parents[1]
ROOT = SKILL_DIR.parents[2]
sys.path.insert(0, str(SKILL_DIR))

from engine.bridge import anomaly_module
from engine.mapping import ResolvedReport
from engine.scope import matches_scope, scope_fields
from engine.workflow import _analysis


def resolved_report(count=8):
    sensors = tuple({
        "pointDataId": str(100 + i), "deviceDataId": "123", "pointName": f"测点{i}",
        "internal_key": f"sensor_{i}", "dataType": 1, "unit": "bar",
        "systemType": "1" if i == 0 else "2", "group": "fuel_oil",
    } for i in range(count))
    return ResolvedReport(
        report={"image_ids": []}, equipment_id="left_main_engine", equipment_name="主机",
        device_data_id="123", source_ship_id="101", system_id="1", system_name="主机系统",
        system_ids=("1", "2"), system_names=("主机系统", "燃油系统"),
        sensors=sensors, query_sensors=sensors, mechanism_profile={},
    )


def example():
    base = SKILL_DIR.parent / "ship-anomaly-detection/template"
    return (
        json.loads((base / "event-analysis-result.example.json").read_text(encoding="utf-8")),
        json.loads((base / "event-analysis-result.schema.json").read_text(encoding="utf-8")),
    )


def test_complete_manual_points_reach_request_and_schema():
    resolved = resolved_report()
    event = SimpleNamespace(
        details={"sourcePoints": list(resolved.sensors), "manualReport": {}},
        time_start=datetime(2026, 9, 8, 10), time_end=datetime(2026, 9, 8, 11),
    )
    workspace = anomaly_module("workspace")
    config = {"baseUrl": "https://example.invalid", "endpoints": {"pointDataList": "/points"}}
    requests = workspace._data_query_requests(event, source_ship_id="101", api_config=config)
    assert len(requests) == 1
    assert requests[0]["api"]["body"]["pointDataIdList"] == [str(100+i) for i in range(8)]
    assert len(requests[0]["points"]) == 8
    payload, schema = example()
    payload.update(scope_fields(resolved), event_type="ship-manual", data_query_requests=requests)
    Draft202012Validator(schema).validate(payload)
    payload["event_type"] = "ai-anomaly"
    assert list(Draft202012Validator(schema).iter_errors(payload))
    event.details.pop("manualReport")
    assert len(workspace._source_points(event)) == 6


def test_publication_keeps_systems_and_submitted_points(monkeypatch):
    resolved = resolved_report()
    payload, schema = example()
    point = copy.deepcopy(payload["data_query_requests"][0]["points"][0])
    points = [dict(point, pointDataId=sensor["pointDataId"]) for sensor in resolved.sensors]
    payload["data_query_requests"][0]["points"] = points
    payload["data_query_requests"][0]["api"]["body"]["pointDataIdList"] = [p["pointDataId"] for p in points]
    payload["analysis_basis"][0]["description"] += "。该事件为人工上报，真实根因仍待核实。"
    monkeypatch.setattr(anomaly_module("workspace"), "_analysis_payload", lambda *a, **kw: payload)
    result = _analysis(
        None, resolved, event_id=payload["event_id"], ser_no=payload["ser_no"],
        created_at=payload["created_at"], ship_id="101", ship_name="测试船",
        title=payload["event_title"], anomaly_type=payload["anomaly_type"], api_config={},
        trends={}, raw_count=1, algorithm_candidate_used=False, fallback_used=False,
        manual_event_type="ship-manual", root=ROOT, agent_content={"event_id": payload["event_id"]},
    )
    assert result["systemType"] == "1"
    assert result["systemTypes"] == ["1", "2"]
    assert result["systemNames"] == ["主机系统", "燃油系统"]
    assert result["reportedPointIds"] == [str(100+i) for i in range(8)]
    Draft202012Validator(schema).validate(result)


def test_scope_compares_full_sets_without_order_dependence():
    resolved = resolved_report()
    payload = dict(scope_fields(resolved), equipment_id=resolved.equipment_id, deviceDataId="123")
    assert matches_scope(payload, resolved)
    payload["systemTypes"].reverse()
    payload["reportedPointIds"].reverse()
    assert matches_scope(payload, resolved)
    payload["reportedPointIds"].pop()
    assert not matches_scope(payload, resolved)


@pytest.mark.parametrize("change", [
    {"systemTypes": ["1"]}, {"equipment_id": "right_main_engine"},
    {"deviceDataId": "124"}, {"reportedPointIds": ["999"]},
    {"systemTypes": None}, {"reportedPointIds": None},
])
def test_scope_rejects_different_or_legacy_unproven_selection(change):
    resolved = resolved_report()
    payload = dict(scope_fields(resolved), equipment_id=resolved.equipment_id, deviceDataId="123")
    payload.update(change)
    assert not matches_scope(payload, resolved)


def test_health_highlights_include_all_systems_once():
    path = SKILL_DIR.parent / "ship-engine-health/scripts/run_engine_health.py"
    spec = importlib.util.spec_from_file_location("manual_scope_health", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    events = [{"event_id": "event", "title": "人工事件", "system_type": "1", "system_types": ["1", "2", "2"]}]
    result = module._analysis_highlights(events, [], {1: "主机系统", 2: "燃油系统"})
    assert [item["systemType"] for item in result] == [1, 2]
    assert all(len(item["evidence"]) == 1 for item in result)

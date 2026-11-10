"""Exercise real publication contracts and writes with isolated synthetic evidence."""
from __future__ import annotations

import copy
import json
import shutil
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest

SKILL_DIR = Path(__file__).resolve().parents[1]
WORKSPACE = SKILL_DIR.parents[2]
if str(SKILL_DIR) not in sys.path:
    sys.path.insert(0, str(SKILL_DIR))

from engine import workflow  # noqa: E402
from engine.bridge import anomaly_module  # noqa: E402
from engine.contracts import ManualContractError  # noqa: E402
from engine.mapping import resolve_report  # noqa: E402


@pytest.fixture
def publication(monkeypatch):
    temporary_root = Path(tempfile.gettempdir())
    with tempfile.TemporaryDirectory(prefix="i-", dir=temporary_root) as directory:
        root = Path(directory).resolve()
        assert root.parent == temporary_root.resolve()
        profile = json.loads((WORKSPACE / "data/ship-profile.json").read_text(encoding="utf-8"))
        refs = {"data/ship-profile.json", profile["dataSource"]["pointMappingPath"],
                profile["dataSource"]["configPath"]}
        for analyzer in profile["analyzerProfiles"].values():
            refs.update([analyzer["registryPath"], analyzer["mappingPath"]])
        oem = profile["knowledge"].get("oem") or {}
        if oem:
            refs.update([oem["mappingPath"], oem["thresholdPath"]])
            refs.update(oem["systemPages"].values())
        for ref in refs:
            destination = root / ref
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(WORKSPACE / ref, destination)
        monkeypatch.chdir(root)
        devices = anomaly_module("ship_profile").analyzable_devices(profile)
        device = next(iter(devices.values()))
        points = json.loads((root / profile["dataSource"]["pointMappingPath"]).read_text(encoding="utf-8"))
        systems = json.loads((SKILL_DIR / "data/system-profiles.json").read_text(encoding="utf-8"))
        by_system = {}
        for system in systems["system_aliases"]:
            by_system[system["system_id"]] = [
                row for row in points["pointList"]
                if str(row.get("deviceDataId")) == str(device["deviceDataId"])
                and int(row.get("dataType") or 0) == 1
                and (str(row.get("systemType")) in system.get("system_types", [])
                     or row.get("pointCode") in system.get("point_codes", []))
            ]
        report = {
            "ship_id": str(profile["shipId"]), "ser_no": "integration1", "sender": "ship",
            "equipment_name": device["deviceName"], "system_name": "主机系统",
            "system_names": ["主机系统", "燃油系统"],
            "sensor_names": [by_system["main_engine"][0]["pointName"], by_system["fuel_oil"][0]["pointName"]],
            "time_window": {"start_time": "2026-09-08T10:00:00", "end_time": "2026-09-08T11:00:00"},
            "description": "跨系统人工上报回归测试，真实根因待核实。", "image_ids": [],
        }
        example = json.loads(
            (SKILL_DIR.parent / "ship-anomaly-detection/template/event-analysis-result.example.json").read_text(encoding="utf-8")
        )
        calls = []

        def normalize(candidate, **kwargs):
            calls.append(kwargs["event_id"])
            content = {key: copy.deepcopy(example[key]) for key in
                       ("fault_causes", "engineering_inference", "analysis_basis", "diagnostic_plans")}
            content["summary"] = "该事件为人工上报，需结合原窗口数据继续排查，真实故障及根因待核实。"
            for basis in content["analysis_basis"]:
                if "point_refs" in basis:
                    basis["point_refs"] = list(kwargs["point_refs"])
            content["analysis_basis"][0]["description"] += "。该事件为人工上报，真实根因仍待核实。"
            return content

        def unexpected_online(*args, **kwargs):
            raise AssertionError("Frozen publication evidence must not trigger online acquisition")

        monkeypatch.setattr(anomaly_module("workspace"), "normalize_agent_content", normalize)
        monkeypatch.setattr(workflow, "_prepare_raw_data", unexpected_online)
        yield SimpleNamespace(root=root, report=report, rows=by_system, normalization_calls=calls)
        monkeypatch.chdir(WORKSPACE)


def _evidence(root: Path, report: dict) -> dict:
    resolved = resolve_report(root, report)
    timestamps = [datetime(2026, 9, 8, 10, 15), datetime(2026, 9, 8, 10, 45)]
    model_samples = [
        SimpleNamespace(timestamp=timestamp, values={
            sensor["internal_key"]: 80.0 + index + sample_index
            for index, sensor in enumerate(resolved.query_sensors)
        })
        for sample_index, timestamp in enumerate(timestamps)
    ]
    event, trends, chosen = workflow._manual_event(
        resolved, [], {resolved.equipment_id: model_samples},
    )
    sensor_samples = [
        {"time": sample.timestamp.isoformat(), "values": {
            sensor["pointDataId"]: sample.values[sensor["internal_key"]]
            for sensor in resolved.query_sensors
        }} for sample in model_samples
    ]
    return {
        "detector_event": event.to_dict(),
        "raw_refs": ["result/ship-manual-anomaly-analysis/raw/integration/synthetic.json"],
        "fetch_attempts": [{"status": "staged"}],
        "raw_fallback": {"used": False, "staged_refs": []}, "data_error": None,
        "trends": trends, "algorithm_candidate_used": chosen, "detections": [],
        "related_trends": trends, "sensor_samples": sensor_samples,
    }


def _publish(publication, report=None, run=0):
    current = copy.deepcopy(report or publication.report)
    return workflow.run_manual_anomaly(
        publication.root, current,
        prepared_evidence=_evidence(publication.root, current),
        agent_content={"event_id": "fixture-content"},
        created_at=datetime(2026, 9, 15, 10, 0, 0) + timedelta(seconds=run),
    )


def _read(publication, ref: str) -> dict:
    return json.loads((publication.root / ref).read_text(encoding="utf-8"))


def _business_files(root: Path) -> dict[str, bytes]:
    result = root / "result"
    return {path.relative_to(root).as_posix(): path.read_bytes() for path in result.rglob("*.json")}


def test_multisystem_eight_points_publish_full_artifacts(publication):
    report = copy.deepcopy(publication.report)
    report["system_names"] = ["主机系统", "燃油系统", "排气系统"]
    report["sensor_names"].extend(row["pointName"] for row in publication.rows["exhaust"][:6])
    outcome = _publish(publication, report)
    assert outcome["stage"] == "published"
    assert outcome["contract_validation"]["ok"] is True
    assert set(outcome["contract_validation"]["validated_schemas"]) == {
        "event.schema.json", "event-analysis-result.schema.json", "active-events.schema.json", "manual-result",
    }
    assert outcome["periodic_detection_guard"]["ok"] is True
    analysis = _read(publication, outcome["analysis_result_ref"])
    assert analysis["manual_follow_up_feedback"] is None
    event = _read(publication, outcome["event_ref"])
    active = _read(publication, "result/ai-anomaly/active-events.json")
    result = _read(publication, outcome["result_ref"])
    expected = [sensor["pointDataId"] for sensor in resolve_report(publication.root, report).sensors]
    assert len(expected) == 8
    assert analysis["systemTypes"] == ["main_engine", "fuel_oil", "exhaust"]
    assert analysis["systemNames"] == report["system_names"]
    assert analysis["reportedPointIds"] == expected
    assert analysis["systemType"] == "main_engine"
    assert len(analysis["data_query_requests"]) == 1
    request = analysis["data_query_requests"][0]
    assert [point["pointDataId"] for point in request["points"]] == expected
    assert request["api"]["body"]["pointDataIdList"] == expected
    assert request["time_window"] == report["time_window"]
    assert active["events"][0]["reportedPointIds"] == expected
    assert active["events"][0]["systemTypes"] == analysis["systemTypes"]
    assert len(active["events"]) == 1
    assert len(list((publication.root / "result/ai-anomaly/events").iterdir())) == 1
    assert event["event_id"] == analysis["event_id"] == active["events"][0]["event_id"]
    assert result["summary"]["new_events"] == 1
    assert len(result["created_event_ids"]) == 1
    coverage = outcome["fetch"]["data_coverage"]
    assert coverage["ratio"] == 0.5
    assert len(coverage["sensors"]) == 8
    basis = next(row for row in analysis["analysis_basis"] if row["basis_id"] == "basis_manual_data_coverage")
    assert basis["point_refs"] == expected
    assert basis["time_window"] == {"start_time": "2026-09-08T10:15:00", "end_time": "2026-09-08T10:45:00"}


def test_multisystem_report_with_one_uncovered_point_creates_zero_events(publication):
    report = copy.deepcopy(publication.report)
    report["system_names"] = ["主机系统", "燃油系统", "排气系统"]
    report["sensor_names"].extend(row["pointName"] for row in publication.rows["exhaust"][:6])
    evidence = _evidence(publication.root, report)
    missing_point = resolve_report(publication.root, report).sensors[-1]["pointDataId"]
    evidence["sensor_samples"][-1]["values"].pop(missing_point)
    with pytest.raises(ManualContractError, match="未创建事件"):
        workflow.run_manual_anomaly(
            publication.root, report, prepared_evidence=evidence, agent_content={"event_id": "fixture-content"},
            created_at=datetime(2026, 9, 15, 10, 0, 0),
        )
    assert not (publication.root / "result/ai-anomaly/events").exists()
    assert not (publication.root / "result/ai-anomaly/active-events.json").exists()
    assert _business_files(publication.root) == {}
    assert publication.normalization_calls == []


@pytest.mark.parametrize("reordered", [False, True])
def test_new_serial_creates_event_even_with_same_scope_and_keeps_feedback(publication, reordered):
    first = _publish(publication)
    event = _read(publication, first["event_ref"])
    event["status"] = "confirmed"
    event_path = publication.root / first["event_ref"]
    event_path.write_text(json.dumps(event, ensure_ascii=False), encoding="utf-8")
    analysis = _read(publication, first["analysis_result_ref"])
    analysis["diagnostic_plans"][0]["steps"][0]["feedback_text"] = "已有船端排查记录"
    analysis_path = publication.root / first["analysis_result_ref"]
    analysis_path.write_text(json.dumps(analysis, ensure_ascii=False), encoding="utf-8")
    original_event, original_analysis = event_path.read_bytes(), analysis_path.read_bytes()
    repeated = copy.deepcopy(publication.report)
    repeated["ser_no"] = "integration2"
    if reordered:
        repeated["system_names"].reverse()
        repeated["system_name"] = repeated["system_names"][0]
        repeated["sensor_names"].reverse()
    second = _publish(publication, repeated, run=1)
    assert second["result"]["summary"]["new_events"] == 1
    assert second["result"]["updated_event_ids"] == []
    assert second["result"]["events"][0]["ser_no"] == repeated["ser_no"]
    assert second["result"]["created_event_ids"] != first["result"]["created_event_ids"]
    assert (publication.root / second["event_ref"]).is_file()
    assert (publication.root / second["analysis_result_ref"]).is_file()
    assert event_path.read_bytes() == original_event
    assert analysis_path.read_bytes() == original_analysis
    assert len(_read(publication, "result/ai-anomaly/active-events.json")["events"]) == 2
    assert len(publication.normalization_calls) == 2


def test_same_serial_reuses_its_event_when_report_start_changes(publication):
    first = _publish(publication)
    repeated = copy.deepcopy(publication.report)
    repeated["time_window"]["start_time"] = "2026-09-08T10:01:00"
    second = _publish(publication, repeated, run=1)
    assert second["result"]["summary"]["new_events"] == 0
    assert second["result"]["summary"]["updated_events"] == 1
    assert second["result"]["updated_event_ids"] == first["result"]["created_event_ids"]
    assert second["event_ref"] == first["event_ref"]
    assert len(list((publication.root / "result/ai-anomaly/events").rglob("*__event.json"))) == 1


def test_prepare_only_new_serial_does_not_return_previous_active_event(publication, monkeypatch):
    _publish(publication)
    repeated = copy.deepcopy(publication.report)
    repeated["ser_no"] = "integration2"
    from engine import preparation
    monkeypatch.setattr(
        preparation, "write_preparation",
        lambda *args, **kwargs: {
            "stage": "analysis_required", "event_id": kwargs["event_id"],
        },
    )
    outcome = workflow.run_manual_anomaly(
        publication.root, repeated, prepare_only=True,
        prepared_evidence=_evidence(publication.root, repeated),
        created_at=datetime(2026, 9, 15, 10, 0, 1),
    )
    assert outcome["stage"] == "analysis_required"
    assert "integration2" in outcome["event_id"]


def test_same_serial_with_missing_event_file_does_not_create_another(publication):
    first = _publish(publication)
    (publication.root / first["event_ref"]).unlink()
    before = _business_files(publication.root)
    with pytest.raises(ManualContractError, match="事件文件缺失"):
        _publish(publication, run=1)
    assert _business_files(publication.root) == before


@pytest.mark.parametrize("changed_scope", ["systems", "points"])
def test_different_scope_is_not_reused(publication, changed_scope):
    first = _publish(publication)
    changed = copy.deepcopy(publication.report)
    changed["ser_no"] = "integration2"
    if changed_scope == "systems":
        changed["system_names"].append("排气系统")
    else:
        changed["sensor_names"].append(publication.rows["fuel_oil"][1]["pointName"])
    original = (publication.root / first["analysis_result_ref"]).read_bytes()
    second = _publish(publication, changed, run=1)
    assert second["result"]["summary"]["new_events"] == 1
    assert second["result"]["created_event_ids"] != first["result"]["created_event_ids"]
    assert second["result"]["updated_event_ids"] == []
    assert len(_read(publication, "result/ai-anomaly/active-events.json")["events"]) == 2
    assert (publication.root / first["analysis_result_ref"]).read_bytes() == original


@pytest.mark.parametrize("changed_scope", ["systems", "points"])
def test_same_id_with_different_scope_cannot_overwrite(publication, changed_scope):
    _publish(publication)
    changed = copy.deepcopy(publication.report)
    if changed_scope == "systems":
        changed["system_names"].append("排气系统")
    else:
        changed["sensor_names"].append(publication.rows["fuel_oil"][1]["pointName"])
    before = _business_files(publication.root)
    with pytest.raises(ManualContractError, match="不能复用该事件"):
        _publish(publication, changed, run=1)
    assert _business_files(publication.root) == before


@pytest.mark.parametrize("legacy", [False, True])
def test_short_directory_keeps_full_identity_and_reuses_layout(publication, legacy):
    first = _publish(publication)
    event_id = first["result"]["created_event_ids"][0]
    short_name = f"ai-{publication.report['ship_id']}-{publication.report['ser_no']}"
    event_path = publication.root / first["event_ref"]
    assert event_path.parent.name == short_name
    assert event_path.name == f"{event_id}__event.json"
    assert (publication.root / first["analysis_result_ref"]).name == f"{event_id}__anomaly-analysis-result.json"
    assert workflow._snapshot_periodic_boundary(publication.root)["event_ids"] == [event_id]
    if legacy:
        # Only relocate this isolated fixture to exercise historical workspaces.
        destination = event_path.parent.with_name(event_id)
        event_path.parent.rename(destination)
        active_path = publication.root / "result/ai-anomaly/active-events.json"
        active = json.loads(active_path.read_text(encoding="utf-8"))
        active["events"][0]["event_dir"] = destination.relative_to(publication.root).as_posix()
        active_path.write_text(json.dumps(active), encoding="utf-8")
        event_path = destination / event_path.name
    before = event_path.read_bytes()
    second = _publish(publication, run=1)
    assert publication.root / second["event_ref"] == event_path
    assert event_path.read_bytes() == before
    assert second["periodic_detection_guard"]["ok"] is True
    assert second["result"]["created_event_ids"] == []
    assert second["result"]["updated_event_ids"] == [event_id]

_SCOPE_FIELDS = ("systemTypes", "systemNames", "reportedPointIds")


def _legacy_record(publication, retained_fields=()):
    outcome = _publish(publication)
    event = _read(publication, outcome["event_ref"])
    event["status"] = "confirmed"
    analysis = _read(publication, outcome["analysis_result_ref"])
    analysis["diagnostic_plans"][0]["steps"][0]["feedback_text"] = "旧事件已有排查反馈"
    for key in _SCOPE_FIELDS:
        if key not in retained_fields:
            analysis.pop(key, None)
        event.pop(key, None)
    active = _read(publication, "result/ai-anomaly/active-events.json")
    for item in active["events"]:
        for key in _SCOPE_FIELDS:
            item.pop(key, None)
    for ref, payload in (
        (outcome["event_ref"], event),
        (outcome["analysis_result_ref"], analysis),
        ("result/ai-anomaly/active-events.json", active),
    ):
        (publication.root / ref).write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return outcome


@pytest.mark.parametrize("retained_fields", [(), ("systemTypes",), ("reportedPointIds",)])
def test_exact_legacy_retry_preserves_existing_records(publication, retained_fields):
    first = _legacy_record(publication, retained_fields)
    event_path = publication.root / first["event_ref"]
    analysis_path = publication.root / first["analysis_result_ref"]
    before = event_path.read_bytes(), analysis_path.read_bytes()
    second = _publish(publication, run=1)
    assert second["result"]["created_event_ids"] == []
    assert second["result"]["updated_event_ids"] == first["result"]["created_event_ids"]
    assert (event_path.read_bytes(), analysis_path.read_bytes()) == before
    assert len(publication.normalization_calls) == 1
    active = _read(publication, "result/ai-anomaly/active-events.json")["events"]
    assert len(active) == 1
    assert all(key not in active[0] for key in _SCOPE_FIELDS)


@pytest.mark.parametrize("record", ["event_ref", "analysis_result_ref"])
def test_exact_legacy_retry_rejects_every_identity_conflict(publication, record):
    first = _legacy_record(publication)
    path = publication.root / first[record]
    original = _read(publication, first[record])
    conflicts = {
        "event_id": "ai-other-integration1-20260908_100000",
        "ser_no": "different",
        "event_type": "shore-manual",
        "ship_id": "different",
        "deviceDataId": "different",
        "equipment_id": "different",
    }
    for field, value in conflicts.items():
        payload = copy.deepcopy(original)
        payload[field] = value
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        before = _business_files(publication.root)
        with pytest.raises(ManualContractError, match="不能复用该事件"):
            _publish(publication, run=1)
        assert _business_files(publication.root) == before, (record, field)


def test_exact_legacy_retry_rejects_present_invalid_scope_and_conflicting_scalar(publication):
    first = _legacy_record(publication)
    path = publication.root / first["analysis_result_ref"]
    original = _read(publication, first["analysis_result_ref"])
    changes = [(field, value) for field in _SCOPE_FIELDS for value in (None, [], ["different"], [{}])]
    changes.append(("systemType", "exhaust"))
    for field, value in changes:
        payload = copy.deepcopy(original)
        payload[field] = value
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        before = _business_files(publication.root)
        with pytest.raises(ManualContractError, match="不能复用该事件"):
            _publish(publication, run=1)
        assert _business_files(publication.root) == before, (field, value)


def test_new_serial_does_not_merge_with_legacy_event(publication):
    first = _legacy_record(publication)
    old_event = (publication.root / first["event_ref"]).read_bytes()
    old_analysis = (publication.root / first["analysis_result_ref"]).read_bytes()
    report = copy.deepcopy(publication.report)
    report["ser_no"] = "integration2"
    second = _publish(publication, report, run=1)
    assert second["result"]["summary"]["new_events"] == 1
    assert second["result"]["updated_event_ids"] == []
    assert second["result"]["created_event_ids"] != first["result"]["created_event_ids"]
    assert len(_read(publication, "result/ai-anomaly/active-events.json")["events"]) == 2
    assert (publication.root / first["event_ref"]).read_bytes() == old_event
    assert (publication.root / first["analysis_result_ref"]).read_bytes() == old_analysis


def test_exact_legacy_retry_still_requires_original_window_coverage(publication):
    _legacy_record(publication)
    evidence = _evidence(publication.root, publication.report)
    evidence["sensor_samples"][-1]["values"].clear()
    before = _business_files(publication.root)
    with pytest.raises(ManualContractError, match="未创建事件"):
        workflow.run_manual_anomaly(
            publication.root, publication.report, prepared_evidence=evidence,
            agent_content={"event_id": "fixture-content"},
            created_at=datetime(2026, 9, 15, 10, 0, 1),
        )
    assert _business_files(publication.root) == before

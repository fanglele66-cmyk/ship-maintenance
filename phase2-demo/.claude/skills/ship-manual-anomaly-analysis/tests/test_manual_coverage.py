"""Coverage gates use synthetic local data and never call the online API."""
from __future__ import annotations

import copy
import json
import sys
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

import pytest

SKILL_DIR = Path(__file__).resolve().parents[1]
if str(SKILL_DIR) not in sys.path:
    sys.path.insert(0, str(SKILL_DIR))

from engine import workflow  # noqa: E402
from engine.contracts import ManualContractError  # noqa: E402


@pytest.fixture
def resolved() -> SimpleNamespace:
    report = {
        "sender": "ship", "ser_no": "coverage-test",
        "time_window": {"start_time": "2026-09-08T10:00:00", "end_time": "2026-09-08T11:00:00"},
    }
    sensors = [
        {"pointDataId": "1", "pointName": "转速", "internal_key": "rpm"},
        {"pointDataId": "2", "pointName": "燃油压力", "internal_key": "fuel"},
    ]
    return SimpleNamespace(report=report, sensors=sensors, query_sensors=sensors,
                           equipment_id="engine", device_data_id="10", source_ship_id="101")


def samples(*, end: str = "10:30:00", second: object = 5.0) -> list[dict]:
    return [
        {"time": "2026-09-08T10:00:00", "values": {"1": 85.0, "2": 5.0}},
        {"time": f"2026-09-08T{end}", "values": {"1": 86.0, "2": second}},
    ]


def raw_payload(items: list[dict]) -> dict:
    return {
        "_fetchMetadata": {"recordsPath": "pointDataList"},
        "pointDataList": [
            {"shipId": "101", "deviceDataId": "10", "pointDataId": point,
             "collectTime": sample["time"], "value": value}
            for sample in items for point, value in sample["values"].items()
        ],
    }


def stage_source(root: Path, items: list[dict], name: str = "raw.json") -> str:
    path = root / "input" / "sensor-raw-data" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(raw_payload(items)), encoding="utf-8")
    return path.relative_to(root).as_posix()


def patch_workflow(monkeypatch: pytest.MonkeyPatch, root: Path, resolved: SimpleNamespace) -> bytes:
    monkeypatch.setattr(workflow, "validate_report", lambda report: None)
    monkeypatch.setattr(workflow, "resolve_report", lambda *args: resolved)
    active = root / "result" / "ai-anomaly" / "active-events.json"
    active.parent.mkdir(parents=True)
    active.write_text('{"updated_at":"before","events":[]}', encoding="utf-8")
    return active.read_bytes()


def assert_no_publish(root: Path, active_before: bytes) -> None:
    assert (root / "result" / "ai-anomaly" / "active-events.json").read_bytes() == active_before
    assert not (root / "result" / "ai-anomaly" / "events").exists()
    assert not (root / "result" / "ship-manual-anomaly-analysis" / "outputs").exists()
    assert not list((root / "result" / "ship-manual-anomaly-analysis").rglob("*.json"))
    assert not list((root / "tmp").glob("*preparation*.json"))


def prepared(resolved: SimpleNamespace) -> dict:
    return {
        "raw_fallback": {"used": False}, "data_error": None, "raw_refs": ["raw.json"],
        "detector_event": {"time_start": resolved.report["time_window"]["start_time"],
                           "time_end": resolved.report["time_window"]["end_time"]},
        "sensor_samples": samples(), "data_coverage": {"ratio": 1.0},
    }


def test_exact_half_window_is_accepted_for_each_reported_sensor(resolved: SimpleNamespace) -> None:
    coverage = workflow._coverage_for_sensor_samples(resolved, samples())
    assert coverage["ratio"] == 0.5
    assert [item["sample_count"] for item in coverage["sensors"]] == [2, 2]
    assert coverage["requested_window"] == resolved.report["time_window"]
    assert coverage["actual_window"]["end_time"] == "2026-09-08T10:30:00"
    assert workflow._validate_prepared_evidence(resolved, prepared(resolved))["ratio"] == 0.5


@pytest.mark.parametrize("bad_value", [None, "", "bad", float("nan"), float("inf"), True])
def test_other_sensor_span_cannot_hide_missing_numeric_sensor(
    resolved: SimpleNamespace, bad_value: object,
) -> None:
    with pytest.raises(ManualContractError, match="每个关联传感器") as error:
        workflow._coverage_for_sensor_samples(resolved, samples(end="11:00:00", second=bad_value))
    assert '"pointDataId":"2"' in str(error.value)
    assert '"ratio":0.0' in str(error.value)


def test_coverage_below_half_fails_and_timezone_is_normalized(resolved: SimpleNamespace) -> None:
    with pytest.raises(ManualContractError, match="50%"):
        workflow._coverage_for_sensor_samples(resolved, samples(end="10:29:59"))
    utc = samples()
    utc[0]["time"] = "2026-09-08T02:00:00Z"
    utc[1]["time"] = "2026-09-08T02:30:00+00:00"
    assert workflow._coverage_for_sensor_samples(resolved, utc)["ratio"] == 0.5


def test_offline_crops_before_loading_without_changing_source(tmp_path: Path, resolved: SimpleNamespace) -> None:
    items = samples() + [
        {"time": "2026-09-01T00:00:00", "values": {"1": 1, "2": 1}},
        {"time": "2026-09-15T00:00:00", "values": {"1": 99, "2": 99}},
    ]
    source = stage_source(tmp_path, items)
    original = (tmp_path / source).read_bytes()
    refs, _, _, fallback = workflow._prepare_raw_data(
        tmp_path, resolved, run_id="offline", raw_inputs=[source], max_window_attempts=3,
    )
    assert (tmp_path / source).read_bytes() == original
    staged = json.loads((tmp_path / refs[0]).read_text(encoding="utf-8"))
    assert {row["collectTime"] for row in staged["pointDataList"]} == {
        "2026-09-08T10:00:00", "2026-09-08T10:30:00",
    }
    assert fallback["used"] is False


def test_offline_coverage_combines_same_window_files(tmp_path: Path, resolved: SimpleNamespace) -> None:
    first, last = samples()
    refs = [stage_source(tmp_path, [first], "first.json"), stage_source(tmp_path, [last], "last.json")]
    staged, _, _, _ = workflow._prepare_raw_data(
        tmp_path, resolved, run_id="union", raw_inputs=refs, max_window_attempts=3,
    )
    assert len(staged) == 2


@pytest.mark.parametrize("prepare_only", [True, False])
@pytest.mark.parametrize("dry_run", [True, False])
def test_wrong_window_offline_never_prepares_or_publishes(
    tmp_path: Path, resolved: SimpleNamespace, monkeypatch: pytest.MonkeyPatch,
    prepare_only: bool, dry_run: bool,
) -> None:
    before = patch_workflow(monkeypatch, tmp_path, resolved)
    wrong = [{**sample, "time": sample["time"].replace("09-08", "09-15")} for sample in samples()]
    source = stage_source(tmp_path, wrong)
    with pytest.raises(ManualContractError, match="未创建事件"):
        workflow.run_manual_anomaly(
            tmp_path, resolved.report, raw_inputs=[source], prepare_only=prepare_only,
            dry_run=dry_run, agent_content={} if not prepare_only else None,
        )
    assert_no_publish(tmp_path, before)
    assert (tmp_path / source).is_file()


@pytest.mark.parametrize("fetch_error", [True, False])
def test_online_retries_without_historical_fallback(
    tmp_path: Path, resolved: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, fetch_error: bool,
) -> None:
    before = patch_workflow(monkeypatch, tmp_path, resolved)
    source = stage_source(tmp_path, samples())
    original = (tmp_path / source).read_bytes()
    calls = []

    def fetch(root: Path, **kwargs: object) -> dict:
        calls.append(kwargs)
        if fetch_error:
            raise RuntimeError("coverage=34.71%, minimum=50.00%")
        destination = root / str(kwargs["output_path"])
        destination.write_text(json.dumps(raw_payload(samples(end="11:00:00", second=None))), encoding="utf-8")
        return {"coverage": {"ratio": 1.0}}

    monkeypatch.setattr(workflow, "anomaly_module", lambda name: SimpleNamespace(fetch_sensor_raw_data=fetch))
    with pytest.raises(ManualContractError, match="不使用历史 raw 替代") as error:
        workflow.run_manual_anomaly(tmp_path, resolved.report, prepare_only=True)
    assert len(calls) == 3
    assert all(call["minimum_coverage_ratio"] == 0.5 for call in calls)
    assert ('34.71%' if fetch_error else 'pointDataId') in str(error.value)
    assert_no_publish(tmp_path, before)
    assert (tmp_path / source).read_bytes() == original


@pytest.mark.parametrize("reason", ["fallback", "data_error", "no_raw", "missing_point", "outside", "wrong_event"])
def test_legacy_preparation_cannot_bypass_gate(
    tmp_path: Path, resolved: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, reason: str,
) -> None:
    before = patch_workflow(monkeypatch, tmp_path, resolved)
    evidence = copy.deepcopy(prepared(resolved))
    if reason == "fallback":
        evidence["raw_fallback"]["used"] = True
    elif reason == "data_error":
        evidence["data_error"] = "loader failed"
    elif reason == "no_raw":
        evidence["raw_refs"] = []
    elif reason == "missing_point":
        evidence["sensor_samples"][-1]["values"].pop("2")
    elif reason == "outside":
        evidence["sensor_samples"][0]["time"] = "2026-09-01T10:00:00"
    elif reason == "wrong_event":
        evidence["detector_event"]["time_start"] = "2026-09-01T10:00:00"
    with pytest.raises(ManualContractError, match="未创建事件"):
        workflow.run_manual_anomaly(tmp_path, resolved.report, prepared_evidence=evidence, agent_content={})
    assert_no_publish(tmp_path, before)


@pytest.mark.parametrize("loader_error", [True, False])
def test_model_sample_failure_does_not_build_manual_event(
    tmp_path: Path, resolved: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, loader_error: bool,
) -> None:
    before = patch_workflow(monkeypatch, tmp_path, resolved)
    source = stage_source(tmp_path, samples())

    def load(*args: object, **kwargs: object) -> tuple:
        if loader_error:
            raise RuntimeError("no complete model samples")
        model = [SimpleNamespace(timestamp=datetime.fromisoformat(item["time"]), values={"rpm": 85.0})
                 for item in samples()]
        return {"engine": model}, [], {}

    monkeypatch.setattr(workflow, "anomaly_module", lambda name: SimpleNamespace(load_sensor_raw_data=load))
    with pytest.raises(ManualContractError, match="未创建事件"):
        workflow.run_manual_anomaly(tmp_path, resolved.report, raw_inputs=[source], prepare_only=True)
    assert_no_publish(tmp_path, before)

"""Runtime contract and publication regressions for model-authored diagnostics."""
from __future__ import annotations

import copy
import importlib
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from datetime import datetime
from unittest.mock import patch
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[4]
SKILLS = ROOT / ".claude/skills"


def load_engine(skill: str, module: str):
    package_name = "diagnostic_test_" + skill.replace("-", "_")
    engine = SKILLS / skill / "engine"
    sys.path.insert(0, str(engine.parent))
    if package_name not in sys.modules:
        spec = importlib.util.spec_from_file_location(package_name, engine / "__init__.py", submodule_search_locations=[str(engine)])
        package = importlib.util.module_from_spec(spec)
        sys.modules[package_name] = package
        spec.loader.exec_module(package)
    return importlib.import_module(package_name + "." + module)


diagnostics = load_engine("ship-anomaly-detection", "diagnostic_plans")
DiagnosticPlanError = diagnostics.DiagnosticPlanError
normalize_diagnostic_plans = diagnostics.normalize_diagnostic_plans


def example_plans(skill="ship-anomaly-detection"):
    filename = "event-analysis-result.example.json" if skill == "ship-anomaly-detection" else "result.example.json"
    result = json.loads((SKILLS / skill / "template" / filename).read_text(encoding="utf-8"))
    plans = copy.deepcopy(result["diagnostic_plans"])
    for plan in plans:
        for step in plan["steps"]:
            for key in ("order", "feedback_text", "feedback_image_ids"):
                step.pop(key, None)
            for item in step["inspection_items"]:
                for key in ("answer_type", "required", "answer"):
                    item.pop(key, None)
    return plans


def normalize(plans):
    return normalize_diagnostic_plans(plans, cause_ids={p["cause_id"] for p in plans}, validate_images=lambda images, field: copy.deepcopy(images))


class DiagnosticGenerationTests(unittest.TestCase):
    def test_model_items_and_specific_options_survive_without_truncation(self):
        for skill in ("ship-anomaly-detection", "ship-oem-alarm-analysis"):
            with self.subTest(skill=skill):
                source = example_plans(skill)
                result = normalize(source)
                counts = {len(s["inspection_items"]) for p in result for s in p["steps"]}
                self.assertTrue(counts <= {2, 3, 4})
                self.assertIn(4, counts)
                for before, after in zip(source, result):
                    self.assertEqual(before["schemeTitle"], after["schemeTitle"])
                    for a, b in zip(before["steps"], after["steps"]):
                        self.assertEqual(a["action"], b["action"])
                        self.assertEqual(len(a["inspection_items"]), len(b["inspection_items"]))
                        for c, d in zip(a["inspection_items"], b["inspection_items"]):
                            self.assertEqual(c["content"], d["content"])
                            if c["item_type"] == "operation":
                                self.assertEqual(c, d)
                            else:
                                self.assertEqual(c["options"], d["options"])
                                self.assertIsNone(d["answer"])
                                self.assertTrue(d["required"])

    def test_old_fields_are_rejected_instead_of_silently_rewritten(self):
        for target, key in (("plan", "tools"), ("plan", "prerequisites"), ("step", "method"), ("step", "acceptance_criteria"), ("step", "evidence_to_record"), ("item", "question")):
            with self.subTest(key=key):
                plans = example_plans()
                row = {"plan": plans[0], "step": plans[0]["steps"][0], "item": plans[0]["steps"][0]["inspection_items"][0]}[target]
                row[key] = "legacy content"
                with self.assertRaises(DiagnosticPlanError):
                    normalize(plans)

    def test_invalid_cardinality_is_rejected_not_padded_or_truncated(self):
        for count in (0, 1, 5):
            plans = example_plans()
            items = plans[0]["steps"][0]["inspection_items"]
            plans[0]["steps"][0]["inspection_items"] = [copy.deepcopy(items[0]) for _ in range(count)]
            with self.subTest(count=count), self.assertRaises(DiagnosticPlanError):
                normalize(plans)

    def test_result_options_required_and_semantically_consistent(self):
        for mutation in ("missing", "empty", "reversed", "duplicate"):
            plans = example_plans()
            item = next(i for p in plans for s in p["steps"] for i in s["inspection_items"] if i["item_type"] == "inspection")
            if mutation == "missing":
                item.pop("options")
            elif mutation == "empty":
                item["options"] = []
            elif mutation == "reversed":
                item["options"][0]["abnormal"] = not item["options"][0]["abnormal"]
            else:
                item["options"][1] = copy.deepcopy(item["options"][0])
            with self.subTest(mutation=mutation), self.assertRaises(DiagnosticPlanError):
                normalize(plans)

    def test_operation_only_step_allowed_but_plan_needs_a_result(self):
        plans = example_plans()
        for item in plans[0]["steps"][0]["inspection_items"]:
            item["item_type"] = "operation"
            item.pop("options", None)
        normalize(plans)
        for step in plans[0]["steps"]:
            for item in step["inspection_items"]:
                item["item_type"] = "operation"
                item.pop("options", None)
        with self.assertRaises(DiagnosticPlanError):
            normalize(plans)

    def test_duplicate_direction_or_ids_cannot_be_repaired_by_publisher(self):
        for mutation in ("direction", "step_id", "item_id", "cause"):
            plans = example_plans()
            a, b = plans[0]["steps"][:2]
            if mutation == "direction":
                b["action"] = a["action"]
            elif mutation == "step_id":
                b["step_id"] = a["step_id"]
            elif mutation == "item_id":
                b["inspection_items"][0]["inspection_item_id"] = a["inspection_items"][0]["inspection_item_id"]
            else:
                plans[1]["cause_id"] = plans[0]["cause_id"]
            with self.subTest(mutation=mutation), self.assertRaises(DiagnosticPlanError):
                normalize(plans)

    def test_all_explicit_fallback_entries_fail_before_reading_or_writing(self):
        anomaly = load_engine("ship-anomaly-detection", "workspace")
        oem = load_engine("ship-oem-alarm-analysis", "workspace")
        manual = load_engine("ship-manual-anomaly-analysis", "preparation")
        with self.assertRaises(ValueError):
            anomaly.run_workspace_detection(ROOT / "does-not-exist", ser_no="test", allow_analysis_fallback=True)
        with self.assertRaises(oem.OEMAlarmError):
            oem.process_oem_alarm(ROOT / "does-not-exist", "absent.json", allow_analysis_fallback=True)
        with self.assertRaises(manual.ManualContractError):
            manual.publish_manual_analysis(ROOT / "does-not-exist", "absent.json", fallback=True)
        legacy = load_engine("ship-anomaly-detection", "analysis_content")
        with self.assertRaises(ValueError):
            legacy.build_analysis_content(None, workspace=ROOT, system_type=None, anomaly_type="test", event_start="", event_end="", point_refs=[])

    def test_oem_publication_preserves_model_topology(self):
        module = load_engine("ship-oem-alarm-analysis", "workspace")
        plans = normalize(example_plans("ship-oem-alarm-analysis"))
        authored = {"diagnostic_plans": plans, "summary": "模型生成的排查建议"}
        source = json.loads((SKILLS / "ship-oem-alarm-analysis/template/result.example.json").read_text(encoding="utf-8"))
        api = {"baseUrl": "https://example.invalid", "endpoints": {"pointDataList": "/points"},
               "sensorApiShipId": source["ship_id"], "_configRef": "data/test-api.json"}
        point = {"deviceDataId": source["deviceDataId"], "pointDataId": "test-point"}
        with patch.object(module, "_sensor_api_context", return_value=(api, point, point, [])), patch.object(module, "normalize_agent_content", return_value=authored), patch.object(module, "_assign_priority_score"), patch.object(module, "format_sensor_display", side_effect=lambda root, result: result):
            result = module._prepare_analysis(source, {"event_id": source["event_id"]}, None, datetime(2026, 9, 10), ROOT)
        self.assertEqual(result["diagnostic_plans"], plans)
        self.assertEqual(result["content_source"], "agent_knowledge")
        self.assertIsNone(result["manual_follow_up_feedback"])
        with self.assertRaises(module.OEMAlarmError):
            module._prepare_analysis({}, None, None, datetime(2026, 9, 10), ROOT)

    def test_ai_publisher_initializes_manual_feedback_without_model_content(self):
        module = load_engine("ship-anomaly-detection", "workspace")
        example = json.loads((SKILLS / "ship-anomaly-detection/template/event-analysis-result.example.json").read_text(encoding="utf-8"))
        authored = {key: copy.deepcopy(example[key]) for key in (
            "fault_causes", "engineering_inference", "analysis_basis", "diagnostic_plans",
        )}
        authored["summary"] = example["analysis_conclusion"]["summary"]
        source_copy = copy.deepcopy(authored)
        now = datetime(2026, 9, 17, 10, 0)
        event = SimpleNamespace(time_start=now, time_end=now, confidence_score=0.8,
                                equipment_id="main-engine", equipment_name="主机")
        point = {"deviceDataId": "device", "pointDataId": "point", "systemType": "air"}
        with patch.object(module, "_source_points", return_value=[point]), patch.object(module, "_data_query_requests", return_value=[]), patch.object(module, "normalize_agent_content", return_value=authored), patch.object(module, "_assign_priority_score"), patch.object(module, "format_sensor_display", side_effect=lambda root, result: result):
            result = module._analysis_payload(
                event, event_id="ai-test", ser_no="test", created_at=now.isoformat(),
                ship_id="test", source_ship_id="test", ship_name="测试船", title="温度异常",
                anomaly_type="温度异常", api_config={}, workspace=ROOT, agent_content={"event_id": "ai-test"},
            )
        self.assertIsNone(result["manual_follow_up_feedback"])
        self.assertEqual(authored, source_copy)


if __name__ == "__main__":
    unittest.main()

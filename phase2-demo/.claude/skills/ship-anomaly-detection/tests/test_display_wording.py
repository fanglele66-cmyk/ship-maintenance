"""Chinese narrative labels and noun-only diagnostic names, with stable identities."""
from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path
import unittest

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[4]
SKILLS = ROOT / ".claude/skills"


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


config = load_module("display_wording_config", ROOT / ".claude/lib/ship_workspace_config.py")
diagnostics = load_module("display_wording_diagnostics", SKILLS / "ship-anomaly-detection/engine/diagnostic_plans.py")


class DisplayWordingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = config.sensor_display_catalog(ROOT)
        assert cls.catalog, "Tests must exercise this vessel's actual sensor mapping"
        cls.row = cls.catalog[0]

    def test_catalog_names_are_chinese_and_idempotent_in_prose(self):
        cases = []
        for row in self.catalog:
            for value in (row["english"], row["chinese"], row["display"],
                          f"{row['english']}({row['chinese']})",
                          f"{row['english']} \n（ {row['chinese']} ）"):
                cases.append((value, row["chinese"]))
        result = config.format_sensor_display(ROOT, [{"content": value} for value, expected in cases])
        for (value, expected), actual in zip(cases, result):
            with self.subTest(sensor=value):
                self.assertEqual(actual["content"], expected)
        self.assertEqual(config.format_sensor_display(ROOT, result), result)

    def test_all_generated_narrative_fields_include_options_and_maintenance(self):
        row = self.row
        fields = ("summary", "event_title", "anomaly_type", "cause_name", "basis",
                  "observation", "inference", "schemeTitle", "action", "title", "content",
                  "label", "safety_notes", "completion_criteria", "method", "expected_result",
                  "acceptance_criteria", "purpose", "decision_basis")
        original = {field: row["display"] for field in fields}
        saved = copy.deepcopy(original)
        result = config.format_sensor_display(ROOT, original)
        self.assertEqual(result, {field: row["chinese"] for field in fields})
        self.assertEqual(original, saved)

    def test_ids_query_labels_paths_and_user_feedback_are_preserved(self):
        row = self.row
        identifier = next(value for value in row["identifiers"] if value)
        original = {
            "event_id": identifier, "pointDataId": identifier, "plan_id": identifier,
            "data_query_requests": [{"api": {"pointName": row["display"]}, "points": [
                {"pointDataId": identifier, "pointName": row["chinese"], "unit": "RPM"}
            ]}],
            "feedback_text": row["display"], "answer": row["display"],
            "history": [{"detail": row["display"], "title": row["display"]}],
            "manual_follow_up_feedback": {"note": row["display"], "submitted_at": "2026-09-17T12:00:00"},
            "reference_images": [{"title": row["display"], "path": "wiki/images/example.png"}],
            "content": f"{row['display']}；转速105 rpm；详见wiki/主机转速说明.md。",
        }
        saved = copy.deepcopy(original)
        result = config.format_sensor_display(ROOT, original)
        for field in ("event_id", "pointDataId", "plan_id", "feedback_text", "answer", "history",
                      "manual_follow_up_feedback", "reference_images"):
            self.assertEqual(result[field], original[field], field)
        query = result["data_query_requests"][0]
        self.assertEqual(query["api"], original["data_query_requests"][0]["api"])
        self.assertEqual(query["points"][0], {"pointDataId": identifier,
                         "pointName": row["english"], "pointName_ch": row["chinese"], "unit": "RPM"})
        self.assertEqual(result["content"], f"{row['chinese']}；转速105 rpm；详见wiki/主机转速说明.md。")
        self.assertEqual(original, saved)

    def test_model_titles_are_noun_phrases_in_ai_and_oem_contracts(self):
        for skill, filename in (("ship-anomaly-detection", "event-analysis-result.example.json"),
                                ("ship-oem-alarm-analysis", "result.example.json")):
            folder = SKILLS / skill / "template"
            example = json.loads((folder / filename).read_text(encoding="utf-8"))
            plans = copy.deepcopy(example["diagnostic_plans"])
            for plan in plans:
                for step in plan["steps"]:
                    for key in ("order", "feedback_text", "feedback_image_ids"):
                        step.pop(key, None)
                    for item in step["inspection_items"]:
                        for key in ("answer_type", "required", "answer"):
                            item.pop(key, None)
            schema = json.loads((folder / "agent-analysis-content.schema.json").read_text(encoding="utf-8"))
            validator = Draft202012Validator(schema["properties"]["diagnostic_plans"])
            for title in ("油路", "控制空气泄漏", "1缸温度测量链路", "停机前温度趋势"):
                with self.subTest(skill=skill, title=title):
                    plans[0]["schemeTitle"] = title
                    validator.validate(plans)
                    result = diagnostics.normalize_diagnostic_plans(plans,
                        cause_ids={plan["cause_id"] for plan in plans}, validate_images=lambda images, field: images)
                    self.assertEqual(result[0]["schemeTitle"], title)
            for title in ("排查控制空气泄漏", "核实1缸温度测量链路", "1缸活塞热状态检查", "调取停机前趋势"):
                with self.subTest(skill=skill, title=title):
                    plans[0]["schemeTitle"] = title
                    self.assertFalse(validator.is_valid(plans))
                    with self.assertRaises(diagnostics.DiagnosticPlanError):
                        diagnostics.normalize_diagnostic_plans(plans,
                            cause_ids={plan["cause_id"] for plan in plans}, validate_images=lambda images, field: images)
                    self.assertEqual(plans[0]["schemeTitle"], title, "Do not silently rewrite model titles")

    def test_published_historical_titles_remain_readable(self):
        for skill, result in (("ship-anomaly-detection", "event-analysis-result"), ("ship-oem-alarm-analysis", "result")):
            folder = SKILLS / skill / "template"
            schema = json.loads((folder / (result + ".schema.json")).read_text(encoding="utf-8"))
            value = json.loads((folder / (result + ".example.json")).read_text(encoding="utf-8"))
            value["diagnostic_plans"][0]["schemeTitle"] = "核实历史事件测量链路"
            Draft202012Validator(schema).validate(value)


if __name__ == "__main__":
    unittest.main()

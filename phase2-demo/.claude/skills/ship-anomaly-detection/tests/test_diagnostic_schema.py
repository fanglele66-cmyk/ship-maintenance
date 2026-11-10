"""Validate generated diagnostic plans independently of event-generation code."""

import copy
import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator


SKILLS = Path(__file__).resolve().parents[2]
CASES = (
    ("ship-anomaly-detection", "event-analysis-result.schema.json", "event-analysis-result.example.json"),
    ("ship-oem-alarm-analysis", "result.schema.json", "result.example.json"),
)


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def operation(item_id):
    return {
        "inspection_item_id": item_id,
        "title": "记录现场观察数据",
        "content": "记录当前管段编号、现场观察到的现象和对应检查时间。",
        "item_type": "operation",
    }


class DiagnosticSchemaTests(unittest.TestCase):
    def plan_cases(self):
        for skill, result_schema, example_file in CASES:
            directory = SKILLS / skill / "template"
            example = load_json(directory / example_file)
            for filename in ("agent-analysis-content.schema.json", result_schema):
                schema = load_json(directory / filename)
                Draft202012Validator.check_schema(schema)
                plans = copy.deepcopy(example["diagnostic_plans"])
                if filename.startswith("agent-"):
                    for plan in plans:
                        for step in plan["steps"]:
                            for key in ("order", "feedback_text", "feedback_image_ids"):
                                step.pop(key, None)
                            for item in step["inspection_items"]:
                                for key in ("answer_type", "required", "answer"):
                                    item.pop(key, None)
                yield f"{skill}/{filename}", Draft202012Validator(schema["properties"]["diagnostic_plans"]), plans

    def assert_rejected(self, validator, plans):
        self.assertFalse(validator.is_valid(plans))

    def test_published_examples_validate(self):
        for skill, result_schema, example_file in CASES:
            directory = SKILLS / skill / "template"
            with self.subTest(skill=skill):
                Draft202012Validator(load_json(directory / result_schema)).validate(load_json(directory / example_file))

    def test_business_and_result_plans_validate(self):
        for name, validator, plans in self.plan_cases():
            with self.subTest(schema=name):
                validator.validate(plans)

    def test_two_three_and_four_items_are_allowed(self):
        for name, validator, plans in self.plan_cases():
            for count in (2, 3, 4):
                with self.subTest(schema=name, count=count):
                    candidate = copy.deepcopy(plans)
                    items = candidate[0]["steps"][0]["inspection_items"]
                    candidate[0]["steps"][0]["inspection_items"] = [items[1]] + [operation(f"operation_{i}") for i in range(count - 1)]
                    validator.validate(candidate)

    def test_one_or_five_items_are_rejected(self):
        for name, validator, plans in self.plan_cases():
            for count in (1, 5):
                with self.subTest(schema=name, count=count):
                    candidate = copy.deepcopy(plans)
                    candidate[0]["steps"][0]["inspection_items"] = [copy.deepcopy(candidate[0]["steps"][0]["inspection_items"][1]) for _ in range(count)]
                    self.assert_rejected(validator, candidate)

    def test_legacy_fields_are_rejected(self):
        for name, validator, plans in self.plan_cases():
            for level, fields in (("plan", ("tools", "prerequisites")), ("step", ("method", "acceptance_criteria", "evidence_to_record")), ("item", ("question",))):
                for field in fields:
                    with self.subTest(schema=name, field=field):
                        candidate = copy.deepcopy(plans)
                        target = candidate[0]
                        if level in ("step", "item"):
                            target = target["steps"][0]
                        if level == "item":
                            target = target["inspection_items"][0]
                        target[field] = "legacy"
                        self.assert_rejected(validator, candidate)

    def test_inspection_requires_result_options(self):
        for name, validator, plans in self.plan_cases():
            with self.subTest(schema=name):
                candidate = copy.deepcopy(plans)
                candidate[0]["steps"][0]["inspection_items"][1].pop("options")
                self.assert_rejected(validator, candidate)

    def test_option_codes_and_abnormal_flags_remain_consistent(self):
        for name, validator, plans in self.plan_cases():
            for position, wrong_flag in ((0, True), (1, False)):
                with self.subTest(schema=name, position=position):
                    candidate = copy.deepcopy(plans)
                    candidate[0]["steps"][0]["inspection_items"][1]["options"][position]["abnormal"] = wrong_flag
                    self.assert_rejected(validator, candidate)
            candidate = copy.deepcopy(plans)
            candidate[0]["steps"][0]["inspection_items"][1]["options"].reverse()
            with self.subTest(schema=name, field="option order"):
                self.assert_rejected(validator, candidate)

    def test_operations_do_not_have_result_fields(self):
        for name, validator, plans in self.plan_cases():
            for field, value in (("options", []), ("answer_type", "single_choice"), ("required", True), ("answer", None)):
                with self.subTest(schema=name, field=field):
                    candidate = copy.deepcopy(plans)
                    candidate[0]["steps"][0]["inspection_items"][0][field] = value
                    self.assert_rejected(validator, candidate)

    def test_operation_only_step_is_allowed_but_plan_needs_a_result(self):
        for name, validator, plans in self.plan_cases():
            with self.subTest(schema=name):
                candidate = copy.deepcopy(plans)
                candidate[0]["steps"][0]["inspection_items"] = [operation("operation_1"), operation("operation_2")]
                validator.validate(candidate)
                for step in candidate[0]["steps"]:
                    step["inspection_items"] = [operation("operation_1"), operation("operation_2")]
                self.assert_rejected(validator, candidate)

    def test_result_interaction_fields_are_required_only_for_inspections(self):
        for name, validator, plans in self.plan_cases():
            if "agent-analysis-content" in name:
                continue
            for field in ("answer_type", "required", "answer"):
                with self.subTest(schema=name, field=field):
                    candidate = copy.deepcopy(plans)
                    candidate[0]["steps"][0]["inspection_items"][1].pop(field)
                    self.assert_rejected(validator, candidate)

    def test_new_output_source_cannot_be_deterministic_fallback(self):
        for skill, result_schema, _ in CASES:
            with self.subTest(skill=skill):
                source_schema = load_json(SKILLS / skill / "template" / result_schema)["properties"]["content_source"]
                validator = Draft202012Validator(source_schema)
                validator.validate("agent_knowledge")
                self.assertFalse(validator.is_valid("deterministic_fallback"))


if __name__ == "__main__":
    unittest.main()

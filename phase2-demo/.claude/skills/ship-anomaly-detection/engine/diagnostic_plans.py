"""Validate model-authored cause / direction / execution-item trees.

This module never invents, duplicates, truncates, or rewrites task content.
Only ordering and empty frontend feedback state are added by the publisher.
"""
from __future__ import annotations

import re
from typing import Any, Callable


class DiagnosticPlanError(ValueError):
    pass


PLAN_TITLE_PATTERN = r"^(?![\s\S]*(?:排查|检查|核实|核对|复核|验证|确认|检测|检验|校验))(?!\s*(?:调取|查看|记录|对比|比对|复测))"


def _plan_title(value: Any, field: str) -> str:
    title = _text(value, field, 2)
    if not re.search(PLAN_TITLE_PATTERN, title):
        raise DiagnosticPlanError(
            f"{field} 必须是简短名词短语，例如‘控制空气泄漏’或‘1缸温度测量链路’；"
            "不要包含排查、检查、核实等动作词，请由模型重新编写任务名称"
        )
    return title


def _object(value: Any, field: str, allowed: set[str]) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise DiagnosticPlanError(f"{field} must be an object")
    extra = sorted(set(value) - allowed)
    if extra:
        raise DiagnosticPlanError(f"{field} contains removed, managed or unknown fields: {extra}")
    return value


def _array(value: Any, field: str, minimum: int, maximum: int) -> list[Any]:
    if not isinstance(value, list) or not minimum <= len(value) <= maximum:
        raise DiagnosticPlanError(f"{field} must contain between {minimum} and {maximum} items")
    return value


def _text(value: Any, field: str, minimum: int) -> str:
    if not isinstance(value, str) or len(value.strip()) < minimum:
        raise DiagnosticPlanError(f"{field} must contain at least {minimum} characters")
    for phrase in ("现场复测并记录处理前后状态", "由另一名值班人员按原方法复核", "排查项1", "排查项2"):
        if phrase in value:
            raise DiagnosticPlanError(f"{field} contains generic placeholder wording: {phrase}")
    return value.strip()


def _unique(value: str, seen: set[str], field: str) -> str:
    key = re.sub(r"\s+", "", value)
    if key in seen:
        raise DiagnosticPlanError(f"{field} must be distinct; duplicate: {value}")
    seen.add(key)
    return value


def normalize_diagnostic_plans(
    value: Any,
    *,
    cause_ids: set[str],
    validate_images: Callable[[Any, str], list[dict[str, str]]],
) -> list[dict[str, Any]]:
    plans: list[dict[str, Any]] = []
    plan_ids: set[str] = set()
    step_ids: set[str] = set()
    item_ids: set[str] = set()
    planned_causes: set[str] = set()
    for plan_index, raw in enumerate(_array(value, "diagnostic_plans", 2, 5)):
        field = f"diagnostic_plans[{plan_index}]"
        plan = _object(raw, field, {
            "plan_id", "cause_id", "schemeTitle", "related_system", "steps",
            "safety_notes", "completion_criteria",
        })
        plan_id = _unique(_text(plan.get("plan_id"), f"{field}.plan_id", 3), plan_ids, "plan_id")
        cause_id = _text(plan.get("cause_id"), f"{field}.cause_id", 3)
        if cause_id not in cause_ids:
            raise DiagnosticPlanError(f"{field}.cause_id references unknown fault cause: {cause_id}")
        _unique(cause_id, planned_causes, "plan cause_id")
        steps = []
        directions: set[str] = set()
        result_count = 0
        for step_index, raw_step in enumerate(_array(plan.get("steps"), f"{field}.steps", 2, 4)):
            step_field = f"{field}.steps[{step_index}]"
            step = _object(raw_step, step_field, {"step_id", "action", "reference_images", "inspection_items"})
            step_id = _unique(_text(step.get("step_id"), f"{step_field}.step_id", 3), step_ids, "step_id")
            action = _unique(_text(step.get("action"), f"{step_field}.action", 6), directions, "step.action")
            titles: set[str] = set()
            contents: set[str] = set()
            items = []
            for item_index, raw_item in enumerate(_array(step.get("inspection_items"), f"{step_field}.inspection_items", 2, 4)):
                item_field = f"{step_field}.inspection_items[{item_index}]"
                item = _object(raw_item, item_field, {"inspection_item_id", "title", "item_type", "content", "options"})
                item_type = item.get("item_type")
                if item_type not in ("operation", "inspection"):
                    raise DiagnosticPlanError(f"{item_field}.item_type must be operation or inspection")
                normalized = {
                    "inspection_item_id": _unique(_text(item.get("inspection_item_id"), f"{item_field}.inspection_item_id", 3), item_ids, "inspection_item_id"),
                    "title": _unique(_text(item.get("title"), f"{item_field}.title", 3), titles, "item.title"),
                    "item_type": item_type,
                    "content": _unique(_text(item.get("content"), f"{item_field}.content", 12), contents, "item.content"),
                }
                if item_type == "operation":
                    if "options" in item:
                        raise DiagnosticPlanError(f"{item_field}: operation must omit options")
                else:
                    options = []
                    codes: set[str] = set()
                    labels: set[str] = set()
                    for option_index, raw_option in enumerate(_array(item.get("options"), f"{item_field}.options", 2, 2)):
                        option = _object(raw_option, f"{item_field}.options[]", {"code", "label", "abnormal"})
                        code = option.get("code")
                        if code != ("normal", "abnormal")[option_index] or option.get("abnormal") is not (code == "abnormal"):
                            raise DiagnosticPlanError(f"{item_field}.options must map normal/false and abnormal/true")
                        options.append({
                            "code": _unique(code, codes, "option.code"),
                            "label": _unique(_text(option.get("label"), "option.label", 1), labels, "option.label"),
                            "abnormal": option["abnormal"],
                        })
                    normalized.update(answer_type="single_choice", required=True, options=options, answer=None)
                    result_count += 1
                items.append(normalized)
            steps.append({
                "step_id": step_id, "order": step_index + 1, "action": action,
                "reference_images": validate_images(step.get("reference_images"), f"{step_field}.reference_images"),
                "feedback_text": None, "feedback_image_ids": [], "inspection_items": items,
            })
        if not result_count:
            raise DiagnosticPlanError(f"{field} must contain at least one inspection with result options")
        plans.append({
            "plan_id": plan_id, "cause_id": cause_id,
            "schemeTitle": _plan_title(plan.get("schemeTitle"), f"{field}.schemeTitle"),
            "related_system": _text(plan.get("related_system"), f"{field}.related_system", 3),
            "steps": steps,
            "safety_notes": [_text(note, f"{field}.safety_notes", 8) for note in _array(plan.get("safety_notes"), "safety_notes", 1, 8)],
            "completion_criteria": [_text(note, f"{field}.completion_criteria", 12) for note in _array(plan.get("completion_criteria"), "completion_criteria", 1, 8)],
        })
    return plans


def diagnostic_display_text(plan: dict[str, Any]) -> list[str]:
    texts = [plan["schemeTitle"], plan["related_system"], *plan["safety_notes"], *plan["completion_criteria"]]
    for step in plan["steps"]:
        texts.append(step["action"])
        for item in step["inspection_items"]:
            texts.extend([item["title"], item["content"]])
            texts.extend(option["label"] for option in item.get("options", []))
    return texts

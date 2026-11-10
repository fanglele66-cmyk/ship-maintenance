from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import json
import re
import sys
from typing import Any


LIB_DIR = Path(__file__).resolve().parents[3] / "lib"
if str(LIB_DIR) not in sys.path:
    sys.path.insert(0, str(LIB_DIR))

from ship_workspace_config import knowledge_package, load_ship_profile, format_sensor_display, concise_analysis_advice  # noqa: E402
from .diagnostic_plans import DiagnosticPlanError, normalize_diagnostic_plans, diagnostic_display_text


AGENT_CONTENT_FIELDS = {
    "event_id",
    "summary",
    "fault_causes",
    "engineering_inference",
    "analysis_basis",
    "diagnostic_plans",
}

PROBABILITY_SCORES = {"low": 0.25, "medium": 0.5, "high": 0.75}
REQUIRED_BASIS_TYPES = {
    "sensor_trend",
    "baseline_comparison",
    "operating_condition",
    "knowledge",
    "rule",
}
GENERIC_PHRASES = (
    "现场复测并记录处理前后状态",
    "由另一名值班人员按原方法复核",
    "验收项1",
    "验收项2",
    "排查项1",
    "排查项2",
)


class AgentContentError(ValueError):
    """Raised when Agent-authored business content violates its boundary or quality gate."""


def _object(value: Any, field: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise AgentContentError(f"{field} must be an object")
    return value


def _array(value: Any, field: str, minimum: int, maximum: int) -> list[Any]:
    if not isinstance(value, list) or not minimum <= len(value) <= maximum:
        raise AgentContentError(
            f"{field} must contain between {minimum} and {maximum} items"
        )
    return value


def _text(value: Any, field: str, minimum: int) -> str:
    if not isinstance(value, str) or len(value.strip()) < minimum:
        raise AgentContentError(f"{field} must contain at least {minimum} characters")
    text = value.strip()
    for phrase in GENERIC_PHRASES:
        if phrase in text:
            raise AgentContentError(f"{field} contains forbidden generic wording: {phrase}")
    return text


def _exact_keys(payload: dict[str, Any], allowed: set[str], field: str) -> None:
    unexpected = sorted(set(payload) - allowed)
    if unexpected:
        raise AgentContentError(
            f"{field} contains system-managed or unknown fields: {unexpected}"
        )


def _validate_reference_images(
    value: Any,
    *,
    field: str,
    workspace: Path,
) -> list[dict[str, str]]:
    knowledge = knowledge_package(workspace)
    image_root = knowledge["images"]
    images = _array(value, field, 0, 3)
    result: list[dict[str, str]] = []
    seen: set[str] = set()
    for index, raw in enumerate(images):
        image = _object(raw, f"{field}[{index}]")
        _exact_keys(image, {"title", "path"}, f"{field}[{index}]")
        title = _text(image.get("title"), f"{field}[{index}].title", 2)
        path = _text(image.get("path"), f"{field}[{index}].path", 10)
        if not path.startswith(f"{image_root}/"):
            raise AgentContentError(
                f"{field}[{index}].path must point into the configured Wiki images"
            )
        resolved = (workspace / path).resolve()
        try:
            resolved.relative_to((workspace / image_root).resolve())
        except ValueError:
            raise AgentContentError(f"{field}[{index}].path resolves outside Wiki images") from None
        if not resolved.is_file():
            raise AgentContentError(f"{field}[{index}].path does not exist: {path}")
        if path in seen:
            raise AgentContentError(f"{field} contains duplicate image path: {path}")
        seen.add(path)
        result.append({"title": title, "path": path})
    return result


def normalize_agent_content(
    payload: dict[str, Any],
    *,
    event_id: str,
    workspace: str | Path,
    point_refs: list[str],
    event_start: str,
    event_end: str,
) -> dict[str, Any]:
    """Validate Agent-only fields and inject deterministic subfields.

    Identity, timestamps, workflow state, query descriptors, frontend answer state,
    ordering and numeric probability scores are deliberately not accepted from the Agent.
    """

    workspace_path = Path(workspace).resolve()
    profile, _ = load_ship_profile(workspace_path)
    knowledge = knowledge_package(workspace_path, profile=profile)
    knowledge_prefix = f"{knowledge['root']}/"
    candidate = deepcopy(_object(payload, "agent_content"))
    _exact_keys(candidate, AGENT_CONTENT_FIELDS, "agent_content")
    missing = sorted(AGENT_CONTENT_FIELDS - set(candidate))
    if missing:
        raise AgentContentError(f"agent_content is missing required fields: {missing}")
    if candidate.get("event_id") != event_id:
        raise AgentContentError(
            f"agent_content.event_id must copy the prepared event id {event_id!r}"
        )

    summary = concise_analysis_advice(_text(candidate.get("summary"), "summary", 20))

    causes: list[dict[str, Any]] = []
    cause_ids: set[str] = set()
    for index, raw in enumerate(_array(candidate.get("fault_causes"), "fault_causes", 2, 5)):
        cause = _object(raw, f"fault_causes[{index}]")
        _exact_keys(
            cause,
            {
                "cause_id",
                "cause_name",
                "related_system",
                "probability",
                "basis",
                "direct_consequences",
            },
            f"fault_causes[{index}]",
        )
        cause_id = _text(cause.get("cause_id"), f"fault_causes[{index}].cause_id", 3)
        if cause_id in cause_ids:
            raise AgentContentError(f"fault_causes contains duplicate cause_id: {cause_id}")
        cause_ids.add(cause_id)
        probability = cause.get("probability")
        if probability not in PROBABILITY_SCORES:
            raise AgentContentError(
                f"fault_causes[{index}].probability must be low, medium or high"
            )
        basis = _array(cause.get("basis"), f"fault_causes[{index}].basis", 1, 1)
        causes.append(
            {
                "cause_id": cause_id,
                "cause_name": _text(cause.get("cause_name"), f"fault_causes[{index}].cause_name", 6),
                "related_system": _text(cause.get("related_system"), f"fault_causes[{index}].related_system", 3),
                "probability": probability,
                "probability_score": PROBABILITY_SCORES[probability],
                "basis": [_text(basis[0], f"fault_causes[{index}].basis[0]", 30)],
                "direct_consequences": _text(
                    cause.get("direct_consequences"),
                    f"fault_causes[{index}].direct_consequences",
                    20,
                ),
            }
        )

    basis_rows: list[dict[str, Any]] = []
    basis_ids: set[str] = set()
    basis_types: set[str] = set()
    for index, raw in enumerate(_array(candidate.get("analysis_basis"), "analysis_basis", 5, 8)):
        basis = _object(raw, f"analysis_basis[{index}]")
        _exact_keys(
            basis,
            {"basis_id", "basis_type", "title", "description"},
            f"analysis_basis[{index}]",
        )
        basis_id = _text(basis.get("basis_id"), f"analysis_basis[{index}].basis_id", 3)
        if basis_id in basis_ids:
            raise AgentContentError(f"analysis_basis contains duplicate basis_id: {basis_id}")
        basis_ids.add(basis_id)
        basis_type = basis.get("basis_type")
        if basis_type not in REQUIRED_BASIS_TYPES | {"cross_signal"}:
            raise AgentContentError(f"analysis_basis[{index}].basis_type is invalid")
        basis_types.add(str(basis_type))
        description = _text(
            basis.get("description"), f"analysis_basis[{index}].description", 30
        )
        if basis_type == "knowledge" and not (
            knowledge_prefix in description and ".md" in description
        ):
            raise AgentContentError(
                "knowledge basis description must cite a concrete configured Wiki Markdown source"
            )
        normalized_basis: dict[str, Any] = {
            "basis_id": basis_id,
            "basis_type": basis_type,
            "title": _text(basis.get("title"), f"analysis_basis[{index}].title", 4),
            "description": description,
        }
        if basis_type != "knowledge":
            normalized_basis["point_refs"] = list(point_refs)
            normalized_basis["time_window"] = {
                "start_time": event_start,
                "end_time": event_end,
            }
        basis_rows.append(normalized_basis)
    missing_basis = sorted(REQUIRED_BASIS_TYPES - basis_types)
    if missing_basis:
        raise AgentContentError(f"analysis_basis is missing required types: {missing_basis}")

    inference = _object(candidate.get("engineering_inference"), "engineering_inference")
    _exact_keys(inference, {"summary", "steps"}, "engineering_inference")
    inference_steps: list[dict[str, Any]] = []
    for index, raw in enumerate(
        _array(inference.get("steps"), "engineering_inference.steps", 3, 6), start=1
    ):
        step = _object(raw, f"engineering_inference.steps[{index - 1}]")
        _exact_keys(
            step,
            {"observation", "inference", "basis_ids"},
            f"engineering_inference.steps[{index - 1}]",
        )
        referenced = _array(
            step.get("basis_ids"),
            f"engineering_inference.steps[{index - 1}].basis_ids",
            1,
            len(basis_ids),
        )
        unknown = sorted(set(referenced) - basis_ids)
        if unknown:
            raise AgentContentError(
                f"engineering_inference.steps[{index - 1}] references unknown basis ids: {unknown}"
            )
        inference_steps.append(
            {
                "order": index,
                "observation": _text(
                    step.get("observation"),
                    f"engineering_inference.steps[{index - 1}].observation",
                    20,
                ),
                "inference": _text(
                    step.get("inference"),
                    f"engineering_inference.steps[{index - 1}].inference",
                    25,
                ),
                "basis_ids": list(dict.fromkeys(str(value) for value in referenced)),
            }
        )

    try:
        plans = normalize_diagnostic_plans(
            candidate.get("diagnostic_plans"),
            cause_ids=cause_ids,
            validate_images=lambda images, field: _validate_reference_images(images, field=field, workspace=workspace_path),
        )
    except DiagnosticPlanError as exc:
        raise AgentContentError(str(exc)) from exc

    point_mapping = json.loads(
        (workspace_path / profile["dataSource"]["pointMappingPath"]).read_text(encoding="utf-8-sig")
    )
    point_identifiers = {
        str(point[key]): str(point["pointName"])
        for point in point_mapping["pointList"]
        for key in ("pointDataId", "pointCode")
        if point.get(key) and point.get("pointName")
    }
    for plan in plans:
        display_text = diagnostic_display_text(plan)
        if any(re.search(r"\bdiag_[A-Za-z0-9_]+", text) for text in display_text):
            raise AgentContentError("排查正文出现内部检查项编号；请使用中文测点、部件或检查项名称")
        for identifier, point_name in point_identifiers.items():
            pattern = rf"(?<![A-Za-z0-9_]){re.escape(identifier)}(?![A-Za-z0-9_])"
            if any(re.search(pattern, text) for text in display_text):
                raise AgentContentError(
                    f"排查正文出现内部点位编号 {identifier}；请改用本船中文测点名“{point_name}”，"
                    "中文名称后也不要附带映射编号；编号仅保留在结构化引用和取数参数中"
                )

    return format_sensor_display(workspace_path, {
        "summary": summary,
        "fault_causes": causes,
        "engineering_inference": {
            "summary": _text(inference.get("summary"), "engineering_inference.summary", 60),
            "steps": inference_steps,
        },
        "analysis_basis": basis_rows,
        "diagnostic_plans": plans,
    })


__all__ = [
    "AGENT_CONTENT_FIELDS",
    "AgentContentError",
    "normalize_agent_content",
]

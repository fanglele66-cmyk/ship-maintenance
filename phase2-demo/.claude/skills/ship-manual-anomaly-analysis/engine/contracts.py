from __future__ import annotations

import copy
import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

from jsonschema import Draft202012Validator, FormatChecker

from .bridge import ANOMALY_SKILL_DIR, anomaly_module


SKILL_DIR = Path(__file__).resolve().parents[1]


class ManualContractError(RuntimeError):
    """Raised before publishing an invalid manual anomaly artifact."""


def _messages(validator: Draft202012Validator, payload: Any, name: str) -> None:
    errors = sorted(validator.iter_errors(payload), key=lambda item: list(item.absolute_path))
    if not errors:
        return
    details: list[str] = []
    for error in errors[:20]:
        path = "$" + "".join(
            f"[{part}]" if isinstance(part, int) else f".{part}"
            for part in error.absolute_path
        )
        details.append(f"{path}: {error.message}")
    raise ManualContractError(f"{name} validation failed: " + "; ".join(details))


@lru_cache(maxsize=1)
def _report_validator() -> Draft202012Validator:
    schema = json.loads((SKILL_DIR / "template" / "report.schema.json").read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=FormatChecker())


@lru_cache(maxsize=1)
def _manual_result_validator() -> Draft202012Validator:
    source = ANOMALY_SKILL_DIR / "template" / "result.schema.json"
    schema = copy.deepcopy(json.loads(source.read_text(encoding="utf-8")))
    run_id = schema["properties"]["run_id"]
    run_id["pattern"] = "^manual-[0-9]{8}_[0-9]{6}$"
    run_id["description"] = "格式为 manual-<created_YYYYMMDD_HHMMSS>。"
    input_refs = schema["properties"]["input_refs"]
    input_refs["minItems"] = 0
    input_refs["items"]["pattern"] = (
        "^result/ship-manual-anomaly-analysis/raw/.+\\.json$"
    )
    schema["title"] = "Ship Manual Anomaly Run Result"
    schema["description"] = "人工异常上报运行结果；字段与AI周期结果保持一致。"
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=FormatChecker())


def validate_report(payload: Any) -> None:
    _messages(_report_validator(), payload, "report.schema.json")
    report_system_names(payload)


def report_system_names(payload: dict[str, Any]) -> list[str]:
    """Read the complete selection while retaining the legacy scalar input."""
    scalar_names = list(dict.fromkeys(
        part.strip() for part in re.split(r"[、,，;；]", payload.get("system_name", ""))
        if part.strip()
    ))
    names = payload.get("system_names")
    if names is None:
        names = scalar_names
    else:
        names = list(dict.fromkeys(name.strip() for name in names if name.strip()))
        if scalar_names and scalar_names not in (names, names[:1]):
            raise ManualContractError("system_name 必须与 system_names 的首项或完整选择一致")
    if not names:
        raise ManualContractError("system_names 至少包含一个系统名称")
    return names


def validate_manual_result(payload: Any) -> None:
    _messages(_manual_result_validator(), payload, "manual result contract")


def validate_ai_payload(payload: Any, schema_name: str) -> None:
    try:
        anomaly_module("contracts").validate_payload(payload, schema_name)
    except Exception as exc:
        raise ManualContractError(str(exc)) from exc


def validate_write_set(items: Iterable[tuple[Any, str]]) -> list[str]:
    validated: list[str] = []
    for payload, schema_name in items:
        if schema_name == "manual-result":
            validate_manual_result(payload)
        else:
            validate_ai_payload(payload, schema_name)
        if schema_name not in validated:
            validated.append(schema_name)
    return validated

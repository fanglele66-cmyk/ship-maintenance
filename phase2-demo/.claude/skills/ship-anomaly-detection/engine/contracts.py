from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

from jsonschema import Draft202012Validator, FormatChecker

from .registry import SKILL_DIR


TEMPLATE_DIR = SKILL_DIR / "template"


class ContractValidationError(RuntimeError):
    """Raised before any business JSON is written when a schema check fails."""


@lru_cache(maxsize=16)
def _validator(schema_name: str) -> Draft202012Validator:
    schema_path = TEMPLATE_DIR / schema_name
    if not schema_path.is_file():
        raise ContractValidationError(f"schema does not exist: {schema_name}")
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=FormatChecker())


def validate_payload(payload: Any, schema_name: str) -> None:
    errors = sorted(_validator(schema_name).iter_errors(payload), key=lambda item: list(item.absolute_path))
    if not errors:
        return
    messages: list[str] = []
    for error in errors[:20]:
        path = "$" + "".join(
            f"[{part}]" if isinstance(part, int) else f".{part}" for part in error.absolute_path
        )
        messages.append(f"{path}: {error.message}")
    if len(errors) > 20:
        messages.append(f"... and {len(errors) - 20} more error(s)")
    raise ContractValidationError(f"{schema_name} validation failed: " + "; ".join(messages))


def validate_payloads(items: Iterable[tuple[Any, str]]) -> list[str]:
    """Validate an entire write set before the first file is created or replaced."""
    validated: list[str] = []
    for payload, schema_name in items:
        validate_payload(payload, schema_name)
        if schema_name not in validated:
            validated.append(schema_name)
    return validated

"""Identity of the complete system and sensor selection in a manual report."""
from __future__ import annotations

from typing import Any

from .mapping import ResolvedReport


def scope_fields(resolved: ResolvedReport) -> dict[str, Any]:
    return {
        "systemTypes": list(resolved.system_ids or (resolved.system_id,)),
        "systemNames": list(resolved.system_names or (resolved.system_name,)),
        "reportedPointIds": list(dict.fromkeys(
            sensor["pointDataId"] for sensor in resolved.sensors
        )),
    }


def matches_scope(payload: dict[str, Any], resolved: ResolvedReport) -> bool:
    """Never infer the submitted point set from auxiliary chart query points."""
    expected = scope_fields(resolved)
    return (
        payload.get("equipment_id") == resolved.equipment_id
        and str(payload.get("deviceDataId") or "") == resolved.device_data_id
        and isinstance(payload.get("systemTypes"), list)
        and set(payload["systemTypes"]) == set(expected["systemTypes"])
        and isinstance(payload.get("reportedPointIds"), list)
        and set(payload["reportedPointIds"]) == set(expected["reportedPointIds"])
    )


def matches_exact_retry(
    event_master: dict[str, Any], analysis: dict[str, Any], resolved: ResolvedReport,
    *, event_id: str, ser_no: str, event_type: str, ship_id: str,
) -> bool:
    """Allow an exact-ID legacy retry without inferring or modifying missing scope."""
    identity = {
        "event_id": event_id, "ser_no": ser_no, "event_type": event_type,
        "ship_id": ship_id, "deviceDataId": resolved.device_data_id,
        "equipment_id": resolved.equipment_id,
    }
    expected_scope = scope_fields(resolved)
    for payload in (event_master, analysis):
        if any(payload.get(key) != value for key, value in identity.items()):
            return False
        for key, expected in expected_scope.items():
            if key not in payload:
                continue
            values = payload[key]
            if (
                not isinstance(values, list) or not values
                or not all(isinstance(value, str) for value in values)
                or set(values) != set(expected)
            ):
                return False
        scalar_system = payload.get("systemType")
        if scalar_system not in (None, "") and scalar_system not in expected_scope["systemTypes"]:
            return False
    return True

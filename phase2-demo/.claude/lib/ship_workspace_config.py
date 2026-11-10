from __future__ import annotations

import importlib
import json
import re
import sys
from pathlib import Path
from typing import Any, Callable


DEFAULT_PROFILE_PATH = Path("data/ship-profile.json")
DEFAULT_KNOWLEDGE_FALLBACK_ROOT = "wiki"
DEFAULT_KNOWLEDGE_CATALOG_PATH = "wiki/catalog.json"
DEFAULT_KNOWLEDGE_BINDINGS_PATH = "wiki/device-bindings.json"


def sensor_display_catalog(workspace: str | Path) -> list[dict[str, Any]]:
    """Read human-readable English labels; never infer names from point IDs."""
    root = Path(workspace).resolve()
    profile, _ = load_ship_profile(root)
    points = _read_object(root / profile["dataSource"]["pointMappingPath"], "sensor point mapping")["pointList"]
    catalog: list[dict[str, Any]] = []
    for analyzer in profile["analyzerProfiles"].values():
        mapping = _read_object(root / analyzer["mappingPath"], "sensor display mapping")
        for row in mapping.get("mappings", []):
            chinese = str(row.get("display_name") or "").strip()
            english = str(row.get("display_name_en") or "").strip()
            if not chinese or not english:
                continue
            if "_" in english or not re.search(r"[A-Za-z].*[ /].*[A-Za-z]", english):
                raise ShipWorkspaceConfigError(f"English sensor name must be a readable name: {english}")
            catalog.append({
                "chinese": chinese, "english": english,
                "display": f"{english}（{chinese}）",
                "aliases": [chinese, *row.get("display_aliases", []),
                            *[key for key in row.get("external_keys", [])
                              if not re.search(r"[\u4e00-\u9fff_]", key) and " " in key]],
                "identifiers": [row.get("internal_name", ""),
                                *[key for key in row.get("external_keys", []) if re.fullmatch(r"[A-Z]*[0-9][A-Za-z0-9-]*", key)],
                                *[str(point[key]) for point in points if point.get("pointName") == chinese
                                  for key in ("pointDataId", "pointCode") if point.get(key)]],
            })
    return catalog


def format_sensor_display(workspace: str | Path, payload: Any) -> Any:
    """Use Chinese sensor names in prose; preserve query labels, IDs and feedback."""
    catalog = sensor_display_catalog(workspace)
    replacements: dict[str, str] = {}
    point_names: dict[str, dict[str, Any]] = {}
    for row in catalog:
        label = row["chinese"]
        for key in (row["display"], row["english"], f"{row['english']}({row['chinese']})",
                    *row["aliases"], *row["identifiers"]):
            if key:
                point_names[str(key)] = row
        replacements[row["display"]] = label
        replacements[f"{row['english']}({row['chinese']})"] = label
        replacements[row["english"]] = label
        for alias in row["aliases"]:
            replacements[str(alias)] = label
        for identifier in row["identifiers"]:
            if identifier:
                replacements[identifier] = label
    if not replacements:
        return payload
    # Consume the whole bilingual label, including wrapped/spaced parentheses.
    # Replacing English alone would leave a duplicate Chinese name in brackets.
    pairs = {f"sensor_{index}": row for index, row in enumerate(catalog)}
    bilingual_names = re.compile("|".join(
        rf"(?P<{key}>(?<![A-Za-z0-9_]){re.escape(row['english'])}\s*[（(]\s*{re.escape(row['chinese'])}\s*[）)])"
        for key, row in pairs.items()
    ))
    alternatives = []
    for token in sorted(replacements, key=len, reverse=True):
        pattern = re.escape(token)
        if not re.search(r"[\u4e00-\u9fff]", token):
            pattern = rf"(?<![A-Za-z0-9_]){pattern}(?![A-Za-z0-9_])"
        alternatives.append(pattern)
    names = re.compile("|".join(alternatives))
    # A source filename is an address, even when it contains a sensor name.
    paths = re.compile(r"(?:wiki|input|result|\.claude)/[^\s，。；：、（）\"']+")
    display_fields = {
        "summary", "event_title", "anomaly_type", "title", "content", "suggestion",
        "cause_name", "related_system", "basis", "direct_consequences", "observation",
        "inference", "description", "schemeTitle", "tools", "prerequisites", "action",
        "method", "acceptance_criteria", "evidence_to_record", "safety_notes",
        "completion_criteria", "question", "name", "purpose", "specification", "details", "expected_result",
        "root_cause_summary", "possible_fault_point", "key_evidence_features",
        "verification_method", "risk_if_untreated", "requirement", "alarm_name", "pointName", "trigger_condition",
        "label", "decision_basis",
    }
    preserved = {
        "api", "point_refs", "reference_images", "feedback_state",
        "feedback_text", "feedback_image_ids", "answer", "history", "manual_follow_up_feedback",
    }

    def replace_names(fragment: str) -> str:
        fragment = bilingual_names.sub(lambda match: pairs[match.lastgroup]["chinese"], fragment)
        def replace(found: re.Match[str]) -> str:
            token = found.group()
            # rpm after a numeric reading is a unit, not the internal sensor key.
            if token.casefold() == "rpm" and re.search(r"\d\s*$", fragment[:found.start()]):
                return token
            return replacements[token]
        return names.sub(replace, fragment)

    def text(value: str) -> str:
        parts: list[str] = []
        end = 0
        for match in paths.finditer(value):
            parts.append(replace_names(value[end:match.start()]))
            parts.append(match.group())
            end = match.end()
        parts.append(replace_names(value[end:]))
        return "".join(parts)

    def visit(value: Any, display: bool = False) -> Any:
        if isinstance(value, dict):
            result = {key: item if key in preserved else visit(item, key in display_fields)
                      for key, item in value.items()}
            # The overview retains independent English/Chinese labels; prose is Chinese.
            for request in result.get("data_query_requests", []):
                for point in request.get("points", []):
                    row = (point_names.get(str(point.get("pointDataId", "")))
                           or point_names.get(str(point.get("pointName", ""))))
                    if row:
                        point["pointName"] = row["english"]
                        point["pointName_ch"] = row["chinese"]
            return result
        if isinstance(value, list):
            return [visit(item, display) for item in value]
        return text(value) if display and isinstance(value, str) else value

    return visit(payload, isinstance(payload, str))


def concise_analysis_advice(summary: str) -> str:
    """Keep the next action from older verbose candidates without losing evidence fields."""
    match = re.search(r"下一步\s*[：:]", summary)
    if match is None:
        return summary.strip()
    prefix = summary[:match.start()].strip()
    sentences = [item.strip() for item in re.split(r"[。！？；;]", prefix) if item.strip()]
    boundary = sentences[-1] if sentences else ""
    if len(boundary) > 100 or not re.search(r"待核实|待.*核实|尚未确认|无法评估", boundary):
        boundary = ""
    return (boundary + "。" if boundary else "") + "下一步：" + summary[match.end():].strip()


class ShipWorkspaceConfigError(ValueError):
    """Raised when the configured ship workspace is incomplete or inconsistent."""


def _required_text(value: Any, field: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise ShipWorkspaceConfigError(f"{field} must be a non-empty string")
    return text


def _workspace_path(workspace: Path, value: str | Path) -> Path:
    path = Path(value)
    return path.resolve() if path.is_absolute() else (workspace / path).resolve()


def _relative_workspace_path(workspace: Path, value: Any, field: str) -> str:
    text = _required_text(value, field).replace("\\", "/")
    resolved = _workspace_path(workspace, text)
    try:
        resolved.relative_to(workspace)
    except ValueError as exc:
        raise ShipWorkspaceConfigError(f"{field} must stay inside the workspace") from exc
    return resolved.relative_to(workspace).as_posix()


def _path_is_within(workspace: Path, child: str, parent: str) -> bool:
    try:
        (workspace / child).resolve().relative_to((workspace / parent).resolve())
    except ValueError:
        return False
    return True


def _read_object(path: Path, field: str) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except OSError as exc:
        raise ShipWorkspaceConfigError(f"cannot read {field}: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ShipWorkspaceConfigError(f"invalid JSON for {field}: {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise ShipWorkspaceConfigError(f"{field} root must be an object")
    return payload


def load_ship_profile(
    workspace: str | Path,
    profile_path: str | Path | None = None,
) -> tuple[dict[str, Any], Path]:
    root = Path(workspace).resolve()
    path = _workspace_path(root, profile_path or DEFAULT_PROFILE_PATH)
    payload = _read_object(path, "ship profile")
    allowed = {
        "shipId",
        "shipName",
        "sensorApiShipId",
        "dataSource",
        "knowledge",
        "analyzerProfiles",
        "devices",
        "features",
        "presentation",
    }
    unexpected = sorted(set(payload) - allowed)
    if unexpected:
        raise ShipWorkspaceConfigError(
            f"ship profile contains unsupported fields: {unexpected}"
        )
    data_source = payload.get("dataSource")
    if not isinstance(data_source, dict):
        raise ShipWorkspaceConfigError("dataSource must be an object")
    if set(data_source) - {"provider", "configPath", "pointMappingPath", "rawDataDir"}:
        raise ShipWorkspaceConfigError("dataSource contains unsupported fields")
    provider = _required_text(data_source.get("provider"), "dataSource.provider")
    if provider not in {"standard_sensor_api", "local_sqlite_replay"}:
        raise ShipWorkspaceConfigError(
            "dataSource.provider must be 'standard_sensor_api'; legacy adapters are not supported"
        )
    normalized_source = {
        "provider": provider,
        "configPath": _relative_workspace_path(
            root, data_source.get("configPath"), "dataSource.configPath"
        ),
        "pointMappingPath": _relative_workspace_path(
            root, data_source.get("pointMappingPath"), "dataSource.pointMappingPath"
        ),
        "rawDataDir": _relative_workspace_path(
            root, data_source.get("rawDataDir"), "dataSource.rawDataDir"
        ),
    }

    knowledge = payload.get("knowledge")
    if not isinstance(knowledge, dict):
        raise ShipWorkspaceConfigError("knowledge must be an object")
    if set(knowledge) - {
        "catalogPath",
        "deviceBindingsPath",
        "defaultPackageId",
        "fallbackRoot",
        "oem",
    }:
        raise ShipWorkspaceConfigError("knowledge contains unsupported fields")
    normalized_knowledge = {
        "catalogPath": _relative_workspace_path(
            root,
            knowledge.get("catalogPath") or DEFAULT_KNOWLEDGE_CATALOG_PATH,
            "knowledge.catalogPath",
        ),
        "deviceBindingsPath": _relative_workspace_path(
            root,
            knowledge.get("deviceBindingsPath") or DEFAULT_KNOWLEDGE_BINDINGS_PATH,
            "knowledge.deviceBindingsPath",
        ),
        "defaultPackageId": str(knowledge.get("defaultPackageId") or "").strip(),
        "fallbackRoot": _relative_workspace_path(
            root,
            knowledge.get("fallbackRoot") or DEFAULT_KNOWLEDGE_FALLBACK_ROOT,
            "knowledge.fallbackRoot",
        ),
    }
    for field in ("catalogPath", "deviceBindingsPath", "fallbackRoot"):
        if not _path_is_within(
            root,
            normalized_knowledge[field],
            DEFAULT_KNOWLEDGE_FALLBACK_ROOT,
        ):
            raise ShipWorkspaceConfigError(
                f"knowledge.{field} must stay inside the workspace wiki directory"
            )
    raw_oem_knowledge = knowledge.get("oem") or {}
    if not isinstance(raw_oem_knowledge, dict) or set(raw_oem_knowledge) - {
        "mappingPath",
        "thresholdPath",
        "systemPages",
        "registerFields",
    }:
        raise ShipWorkspaceConfigError("knowledge.oem contains unsupported fields")
    if raw_oem_knowledge:
        raw_system_pages = raw_oem_knowledge.get("systemPages") or {}
        if not isinstance(raw_system_pages, dict):
            raise ShipWorkspaceConfigError("knowledge.oem.systemPages must be an object")
        raw_register_fields = raw_oem_knowledge.get("registerFields") or {}
        if not isinstance(raw_register_fields, dict):
            raise ShipWorkspaceConfigError("knowledge.oem.registerFields must be an object")
        normalized_knowledge["oem"] = {
            "mappingPath": _relative_workspace_path(
                root, raw_oem_knowledge.get("mappingPath"), "knowledge.oem.mappingPath"
            ),
            "thresholdPath": _relative_workspace_path(
                root, raw_oem_knowledge.get("thresholdPath"), "knowledge.oem.thresholdPath"
            ),
            "systemPages": {
                _required_text(key, "knowledge.oem.systemPages key"): _relative_workspace_path(
                    root, value, f"knowledge.oem.systemPages.{key}"
                )
                for key, value in raw_system_pages.items()
            },
            "registerFields": {
                _required_text(key, "knowledge.oem.registerFields key"): _required_text(
                    value, f"knowledge.oem.registerFields.{key}"
                )
                for key, value in raw_register_fields.items()
            },
        }

    raw_analyzers = payload.get("analyzerProfiles")
    if not isinstance(raw_analyzers, dict) or not raw_analyzers:
        raise ShipWorkspaceConfigError("analyzerProfiles must be a non-empty object")
    if len(raw_analyzers) != 1:
        raise ShipWorkspaceConfigError(
            "the current runtime supports exactly one analyzer profile per ship workspace; "
            "multiple devices may bind to that profile"
        )
    analyzers: dict[str, dict[str, Any]] = {}
    analyzer_fields = {
        "detectionEntrypoint",
        "healthEntrypoint",
        "registryPath",
        "mappingPath",
        "detectorProfile",
        "requiredPointCount",
        "canonicalInput",
        "signed16PointNameMarkers",
    }
    for raw_name, raw_config in raw_analyzers.items():
        name = _required_text(raw_name, "analyzerProfiles key")
        if not isinstance(raw_config, dict):
            raise ShipWorkspaceConfigError(f"analyzerProfiles.{name} must be an object")
        unexpected_fields = sorted(set(raw_config) - analyzer_fields)
        if unexpected_fields:
            raise ShipWorkspaceConfigError(
                f"analyzerProfiles.{name} contains unsupported fields: {unexpected_fields}"
            )
        canonical = raw_config.get("canonicalInput") or {}
        if not isinstance(canonical, dict):
            raise ShipWorkspaceConfigError(
                f"analyzerProfiles.{name}.canonicalInput must be an object"
            )
        unexpected_canonical = sorted(
            set(canonical) - {"shipIdentifier", "serialNumber", "deviceSerialNumber"}
        )
        if unexpected_canonical:
            raise ShipWorkspaceConfigError(
                f"analyzerProfiles.{name}.canonicalInput contains unsupported fields: "
                f"{unexpected_canonical}"
            )
        required_point_count = int(raw_config.get("requiredPointCount") or 0)
        if required_point_count <= 0:
            raise ShipWorkspaceConfigError(
                f"analyzerProfiles.{name}.requiredPointCount must be positive"
            )
        raw_signed_markers = raw_config.get("signed16PointNameMarkers") or []
        if not isinstance(raw_signed_markers, list):
            raise ShipWorkspaceConfigError(
                f"analyzerProfiles.{name}.signed16PointNameMarkers must be an array"
            )
        analyzers[name] = {
            "detectionEntrypoint": _required_text(
                raw_config.get("detectionEntrypoint"),
                f"analyzerProfiles.{name}.detectionEntrypoint",
            ),
            "healthEntrypoint": str(raw_config.get("healthEntrypoint") or "").strip(),
            "registryPath": _relative_workspace_path(
                root, raw_config.get("registryPath"), f"analyzerProfiles.{name}.registryPath"
            ),
            "mappingPath": _relative_workspace_path(
                root, raw_config.get("mappingPath"), f"analyzerProfiles.{name}.mappingPath"
            ),
            "detectorProfile": _required_text(
                raw_config.get("detectorProfile"),
                f"analyzerProfiles.{name}.detectorProfile",
            ),
            "requiredPointCount": required_point_count,
            "signed16PointNameMarkers": list(
                dict.fromkeys(
                    _required_text(
                        item,
                        f"analyzerProfiles.{name}.signed16PointNameMarkers[]",
                    )
                    for item in raw_signed_markers
                )
            ),
            "canonicalInput": {
                "shipIdentifier": str(
                    canonical.get("shipIdentifier") or payload.get("sensorApiShipId") or ""
                ).strip(),
                "serialNumber": _required_text(
                    canonical.get("serialNumber"),
                    f"analyzerProfiles.{name}.canonicalInput.serialNumber",
                ),
                "deviceSerialNumber": _required_text(
                    canonical.get("deviceSerialNumber"),
                    f"analyzerProfiles.{name}.canonicalInput.deviceSerialNumber",
                ),
            },
        }

    raw_devices = payload.get("devices")
    if not isinstance(raw_devices, dict) or not raw_devices:
        raise ShipWorkspaceConfigError("devices must be a non-empty object")
    devices: dict[str, dict[str, Any]] = {}
    device_names: set[str] = set()
    device_data_ids: set[str] = set()
    device_fields = {
        "deviceName",
        "deviceDataId",
        "equipmentModel",
        "collectEnabled",
        "analyzers",
        "aliases",
        "keyDevice",
    }
    for raw_equipment_id, raw_device in raw_devices.items():
        equipment_id = _required_text(raw_equipment_id, "devices key")
        if not isinstance(raw_device, dict):
            raise ShipWorkspaceConfigError(f"devices.{equipment_id} must be an object")
        unexpected_fields = sorted(set(raw_device) - device_fields)
        if unexpected_fields:
            raise ShipWorkspaceConfigError(
                f"devices.{equipment_id} contains unsupported fields: {unexpected_fields}"
            )
        device_name = _required_text(
            raw_device.get("deviceName"), f"devices.{equipment_id}.deviceName"
        )
        device_data_id = _required_text(
            raw_device.get("deviceDataId"), f"devices.{equipment_id}.deviceDataId"
        )
        if device_name in device_names or device_data_id in device_data_ids:
            raise ShipWorkspaceConfigError(
                f"devices.{equipment_id} duplicates a deviceName or deviceDataId"
            )
        raw_device_analyzers = raw_device.get("analyzers")
        if not isinstance(raw_device_analyzers, list) or not raw_device_analyzers:
            raise ShipWorkspaceConfigError(
                f"devices.{equipment_id}.analyzers must be a non-empty array"
            )
        device_analyzers = [
            _required_text(item, f"devices.{equipment_id}.analyzers[]")
            for item in raw_device_analyzers
        ]
        unknown = sorted(set(device_analyzers) - set(analyzers))
        if unknown:
            raise ShipWorkspaceConfigError(
                f"devices.{equipment_id} references unknown analyzers: {unknown}"
            )
        aliases = raw_device.get("aliases") or []
        if not isinstance(aliases, list):
            raise ShipWorkspaceConfigError(f"devices.{equipment_id}.aliases must be an array")
        collect_enabled = raw_device.get("collectEnabled")
        if not isinstance(collect_enabled, bool):
            raise ShipWorkspaceConfigError(
                f"devices.{equipment_id}.collectEnabled must be boolean"
            )
        key_device = raw_device.get("keyDevice", False)
        if not isinstance(key_device, bool):
            raise ShipWorkspaceConfigError(
                f"devices.{equipment_id}.keyDevice must be boolean"
            )
        device_names.add(device_name)
        device_data_ids.add(device_data_id)
        devices[equipment_id] = {
            "deviceName": device_name,
            "deviceDataId": device_data_id,
            "equipmentModel": str(raw_device.get("equipmentModel") or "").strip(),
            "collectEnabled": collect_enabled,
            "keyDevice": key_device,
            "analyzers": list(dict.fromkeys(device_analyzers)),
            "aliases": list(
                dict.fromkeys(
                    _required_text(item, f"devices.{equipment_id}.aliases[]")
                    for item in aliases
                )
            ),
        }
    if not any(device["collectEnabled"] for device in devices.values()):
        raise ShipWorkspaceConfigError("at least one device must enable collection")
    oem_register_fields = normalized_knowledge.get("oem", {}).get("registerFields", {})
    unknown_oem_devices = sorted(set(oem_register_fields) - set(devices))
    if unknown_oem_devices:
        raise ShipWorkspaceConfigError(
            f"knowledge.oem.registerFields references unknown devices: {unknown_oem_devices}"
        )

    features = payload.get("features") or {}
    if not isinstance(features, dict) or set(features) - {"oemAlarmEnabled"}:
        raise ShipWorkspaceConfigError("features contains unsupported fields")
    oem_enabled = features.get("oemAlarmEnabled", False)
    if not isinstance(oem_enabled, bool):
        raise ShipWorkspaceConfigError("features.oemAlarmEnabled must be boolean")
    presentation = payload.get("presentation") or {}
    if not isinstance(presentation, dict) or set(presentation) - {"workspaceTitle"}:
        raise ShipWorkspaceConfigError("presentation contains unsupported fields")

    normalized = {
        "shipId": _required_text(payload.get("shipId"), "shipId"),
        "shipName": _required_text(payload.get("shipName"), "shipName"),
        "sensorApiShipId": _required_text(payload.get("sensorApiShipId"), "sensorApiShipId"),
        "dataSource": normalized_source,
        "knowledge": normalized_knowledge,
        "analyzerProfiles": analyzers,
        "devices": devices,
        "features": {"oemAlarmEnabled": oem_enabled},
        "presentation": {
            "workspaceTitle": str(
                presentation.get("workspaceTitle")
                or f"{payload.get('shipName')}智能体工作空间"
            ).strip()
        },
    }
    validate_workspace_assets(root, normalized)
    return normalized, path


def validate_workspace_assets(workspace: Path, profile: dict[str, Any]) -> None:
    required_paths = [
        profile["dataSource"]["configPath"],
    ]
    oem_knowledge = profile["knowledge"].get("oem") or {}
    if oem_knowledge:
        required_paths.extend(
            [oem_knowledge["mappingPath"], oem_knowledge["thresholdPath"]]
        )
        required_paths.extend(oem_knowledge["systemPages"].values())
    for analyzer in profile["analyzerProfiles"].values():
        required_paths.extend([analyzer["registryPath"], analyzer["mappingPath"]])
    missing = [value for value in required_paths if not (workspace / value).is_file()]
    if missing:
        raise ShipWorkspaceConfigError(f"configured workspace files are missing: {missing}")
    fallback_root = workspace / profile["knowledge"]["fallbackRoot"]
    if not fallback_root.is_dir():
        raise ShipWorkspaceConfigError(
            f"configured knowledge fallback directory is missing: "
            f"{profile['knowledge']['fallbackRoot']}"
        )


def collect_device_data_ids(profile: dict[str, Any]) -> list[str]:
    return [
        str(device["deviceDataId"])
        for device in profile["devices"].values()
        if device["collectEnabled"]
    ]


def devices_for_analyzer(profile: dict[str, Any], analyzer: str) -> dict[str, dict[str, Any]]:
    return {
        equipment_id: device
        for equipment_id, device in profile["devices"].items()
        if analyzer in device["analyzers"]
    }


def analyzable_devices(profile: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        equipment_id: device
        for equipment_id, device in profile["devices"].items()
        if device["collectEnabled"] and device["analyzers"]
    }


def primary_analyzer(profile: dict[str, Any], equipment_id: str | None = None) -> str:
    if equipment_id is not None:
        try:
            analyzers = profile["devices"][equipment_id]["analyzers"]
        except KeyError as exc:
            raise ShipWorkspaceConfigError(f"unknown equipment_id: {equipment_id}") from exc
        return str(analyzers[0])
    configured = list(profile["analyzerProfiles"])
    if len(configured) != 1:
        raise ShipWorkspaceConfigError(
            "an analyzer must be selected by equipment_id when multiple profiles exist"
        )
    return configured[0]


def analyzer_profile(profile: dict[str, Any], analyzer: str) -> dict[str, Any]:
    try:
        return dict(profile["analyzerProfiles"][analyzer])
    except KeyError as exc:
        raise ShipWorkspaceConfigError(f"unknown analyzer profile: {analyzer}") from exc


def device_for_data_id(
    profile: dict[str, Any], device_data_id: str | int
) -> tuple[str, dict[str, Any]] | None:
    requested = str(device_data_id).strip()
    for equipment_id, device in profile["devices"].items():
        if str(device["deviceDataId"]) == requested:
            return equipment_id, device
    return None


def knowledge_package(
    workspace: str | Path,
    *,
    profile: dict[str, Any] | None = None,
    device_data_id: str | None = None,
) -> dict[str, Any]:
    root = Path(workspace).resolve()
    active_profile = profile or load_ship_profile(root)[0]
    catalog_path = root / active_profile["knowledge"]["catalogPath"]
    catalog = (
        _read_object(catalog_path, "knowledge catalog")
        if catalog_path.exists()
        else {}
    )
    bindings_path = root / active_profile["knowledge"]["deviceBindingsPath"]
    bindings = (
        _read_object(bindings_path, "device bindings")
        if bindings_path.exists()
        else {}
    )
    if catalog_path.exists() and "packages" not in catalog:
        raise ShipWorkspaceConfigError("knowledge catalog must contain packages[]")
    if bindings_path.exists() and "bindings" not in bindings:
        raise ShipWorkspaceConfigError("device bindings must contain bindings[]")
    raw_packages = catalog.get("packages", [])
    if not isinstance(raw_packages, list):
        raise ShipWorkspaceConfigError("knowledge catalog must contain packages[]")
    raw_bindings = bindings.get("bindings", [])
    if not isinstance(raw_bindings, list):
        raise ShipWorkspaceConfigError("device bindings must contain bindings[]")

    package_id = active_profile["knowledge"]["defaultPackageId"]
    resolution_source = "default_package"
    if device_data_id:
        matches = [
            item
            for item in raw_bindings
            if isinstance(item, dict)
            and str(item.get("deviceDataId") or "") == str(device_data_id)
        ]
        if len(matches) > 1:
            raise ShipWorkspaceConfigError(
                f"device {device_data_id!r} has multiple knowledge bindings"
        )
        if len(matches) == 1:
            package_id = _required_text(
                matches[0].get("knowledgePackageId"), "knowledgePackageId"
            )
            resolution_source = "device_binding"
    packages = [
        item
        for item in raw_packages
        if isinstance(item, dict) and item.get("knowledgePackageId") == package_id
    ]
    if len(packages) > 1:
        raise ShipWorkspaceConfigError(
            f"knowledge package {package_id!r} must resolve exactly once"
        )
    if len(packages) == 1:
        package = _normalize_knowledge_package(
            root,
            active_profile["knowledge"]["fallbackRoot"],
            packages[0],
        )
        package["resolutionSource"] = resolution_source
        return package

    return _fallback_knowledge_package(
        root,
        fallback_root=active_profile["knowledge"]["fallbackRoot"],
        catalog_packages=raw_packages,
        requested_package_id=package_id,
    )


def _normalize_knowledge_package(
    workspace: Path,
    fallback_root: str,
    raw_package: dict[str, Any],
) -> dict[str, Any]:
    package = dict(raw_package)
    package_id = _required_text(
        package.get("knowledgePackageId"), "knowledgePackageId"
    )
    root_ref = _relative_workspace_path(workspace, package.get("root"), "knowledge root")
    entry_ref = _relative_workspace_path(workspace, package.get("entry"), "knowledge entry")
    if not _path_is_within(workspace, root_ref, fallback_root):
        raise ShipWorkspaceConfigError(
            f"knowledge package {package_id!r} root must stay inside {fallback_root}"
        )
    if not _path_is_within(workspace, entry_ref, root_ref):
        raise ShipWorkspaceConfigError(
            f"knowledge package {package_id!r} entry must stay inside its package root"
        )

    raw_image_directory = _required_text(
        package.get("imageDirectory"), "knowledge imageDirectory"
    ).replace("\\", "/")
    if Path(raw_image_directory).is_absolute():
        raise ShipWorkspaceConfigError("knowledge imageDirectory must be relative")
    image_directory = raw_image_directory.strip("/")
    if not image_directory:
        raise ShipWorkspaceConfigError("knowledge imageDirectory must be non-empty")
    images_ref = _relative_workspace_path(
        workspace,
        f"{root_ref}/{image_directory}",
        "knowledge images",
    )
    if not _path_is_within(workspace, images_ref, root_ref):
        raise ShipWorkspaceConfigError(
            f"knowledge package {package_id!r} images must stay inside its package root"
        )

    routing_index = str(package.get("routingIndex") or "").strip()
    if routing_index:
        routing_ref = _relative_workspace_path(
            workspace, routing_index, "knowledge routingIndex"
        )
        if not _path_is_within(workspace, routing_ref, fallback_root):
            raise ShipWorkspaceConfigError(
                f"knowledge package {package_id!r} routingIndex must stay inside "
                f"{fallback_root}"
            )
        package["routingIndex"] = routing_ref
        if not (workspace / routing_ref).is_file():
            raise ShipWorkspaceConfigError(
                f"knowledge package routing index is missing for {package_id!r}"
            )

    package.update(
        {
            "knowledgePackageId": package_id,
            "root": root_ref,
            "entry": entry_ref,
            "imageDirectory": image_directory,
            "images": images_ref,
        }
    )
    if not (workspace / root_ref).is_dir() or not (workspace / entry_ref).is_file():
        raise ShipWorkspaceConfigError(
            f"knowledge package assets are missing for {package_id!r}"
        )
    return package


def _fallback_knowledge_package(
    workspace: Path,
    *,
    fallback_root: str,
    catalog_packages: list[Any],
    requested_package_id: str,
) -> dict[str, Any]:
    catalog_candidates: list[dict[str, Any]] = []
    for item in catalog_packages:
        if not isinstance(item, dict):
            continue
        try:
            catalog_candidates.append(
                _normalize_knowledge_package(workspace, fallback_root, item)
            )
        except ShipWorkspaceConfigError:
            continue
    if len(catalog_candidates) == 1:
        package = catalog_candidates[0]
        package["resolutionSource"] = "wiki_catalog_fallback"
        return package
    if len(catalog_candidates) > 1:
        candidates = sorted(
            f"{item['knowledgePackageId']}:{item['root']}" for item in catalog_candidates
        )
        raise ShipWorkspaceConfigError(
            f"knowledge package {requested_package_id!r} is not configured and "
            f"{fallback_root} contains multiple catalog candidates: {candidates}"
        )

    fallback_path = (workspace / fallback_root).resolve()
    directory_candidates: list[dict[str, Any]] = []
    for directory in sorted(
        fallback_path.iterdir(), key=lambda path: path.name.casefold()
    ):
        if not directory.is_dir() or not (directory / "index.md").is_file():
            continue
        try:
            root_ref = directory.resolve().relative_to(workspace).as_posix()
        except ValueError:
            continue
        package = _normalize_knowledge_package(
            workspace,
            fallback_root,
            {
                "knowledgePackageId": directory.name,
                "title": directory.name,
                "root": root_ref,
                "entry": f"{root_ref}/index.md",
                "routingIndex": f"{root_ref}/index.md",
                "imageDirectory": "images",
            },
        )
        directory_candidates.append(package)
    if len(directory_candidates) == 1:
        package = directory_candidates[0]
        package["resolutionSource"] = "wiki_directory_fallback"
        return package
    if len(directory_candidates) > 1:
        candidates = sorted(item["root"] for item in directory_candidates)
        raise ShipWorkspaceConfigError(
            f"knowledge package {requested_package_id!r} is not configured and "
            f"{fallback_root} contains multiple directory candidates: {candidates}"
        )
    raise ShipWorkspaceConfigError(
        f"knowledge package {requested_package_id!r} is not configured and "
        f"{fallback_root} contains no unique package with index.md"
    )


def import_entrypoint(
    target: str,
    *,
    package: str | None = None,
    search_paths: list[str | Path] | None = None,
) -> Callable[..., Any]:
    module_name, separator, attribute = target.partition(":")
    if not separator or not module_name or not attribute:
        raise ShipWorkspaceConfigError(
            f"entrypoint must use module:callable syntax: {target!r}"
        )
    for raw_path in reversed(search_paths or []):
        path = str(Path(raw_path).resolve())
        if path not in sys.path:
            sys.path.insert(0, path)
    if module_name.startswith("."):
        if not package:
            raise ShipWorkspaceConfigError(
                f"relative entrypoint requires a package: {target!r}"
            )
        module = importlib.import_module(module_name, package)
    else:
        module = importlib.import_module(module_name)
    value = getattr(module, attribute, None)
    if not callable(value):
        raise ShipWorkspaceConfigError(f"entrypoint is not callable: {target!r}")
    return value

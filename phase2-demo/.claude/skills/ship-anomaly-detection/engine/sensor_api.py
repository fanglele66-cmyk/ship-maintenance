from __future__ import annotations

import copy
import json
import math
import os
import re
import socket
import ssl
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

from .ship_profile import (
    ShipProfileError,
    collect_device_data_ids,
    load_ship_profile,
)


BEIJING_TZ = timezone(timedelta(hours=8))
# Backward-compatible import name used by older callers and tests. The value is
# now Beijing time, not UTC.
TZ = BEIJING_TZ
TIME_SEMANTICS = "Asia/Shanghai"
DEFAULT_CONFIG_PATH = Path("data/sensor-api.json")
DEFAULT_MAPPING_PATH = Path("data/sensor-point-mapping.json")
DEFAULT_RAW_DATA_DIR = Path("input/sensor-raw-data")
DEFAULT_FETCH_STATE_PATH = Path("result/ai-anomaly/fetch-state.json")
FETCH_STATE_VERSION = 2
DEFAULT_STALE_AFTER_HOURS = 12.0
DEFAULT_TARGET_RAW_FILES = 24
POINT_DATA_REQUIRED_FIELDS = (
    "shipId",
    "dataId",
    "deviceDataId",
    "pointDataId",
    "collectTime",
    "value",
)
POINT_DATA_ID_FIELDS = ("shipId", "dataId", "deviceDataId", "pointDataId")
Transport = Callable[[str, str, dict[str, Any], float], Any]


class SensorApiError(RuntimeError):
    """Raised when a sensor API request or response cannot be handled safely."""


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except OSError as exc:
        raise SensorApiError(f"cannot read JSON file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SensorApiError(f"invalid JSON file: {path}: {exc}") from exc


def _write_json_atomic(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def _resolve_workspace_path(workspace: Path, value: str | Path) -> Path:
    path = Path(value)
    return path.resolve() if path.is_absolute() else (workspace / path).resolve()


def load_api_config(
    workspace: str | Path,
    config_path: str | Path | None = None,
) -> tuple[dict[str, Any], Path]:
    root = Path(workspace).resolve()
    path = _resolve_workspace_path(root, config_path or DEFAULT_CONFIG_PATH)
    config = _read_json(path)
    if not isinstance(config, dict):
        raise SensorApiError("sensor API config root must be an object")

    required = {"baseUrl", "endpoints", "tokenEnv"}
    missing = sorted(required - set(config))
    if missing:
        raise SensorApiError(f"sensor API config missing fields: {missing}")
    endpoints = config.get("endpoints")
    if not isinstance(endpoints, dict) or not endpoints.get("pointList") or not endpoints.get("pointDataList"):
        raise SensorApiError("sensor API config endpoints must contain pointList and pointDataList")
    if "token" in config or "authorization" in config:
        raise SensorApiError("do not store credentials in data/sensor-api.json; use tokenEnv")
    if "shipId" in config:
        raise SensorApiError(
            "data/sensor-api.json must not define shipId; use data/ship-profile.json"
        )
    request_defaults = config.get("pointDataRequestDefaults", {})
    if not isinstance(request_defaults, dict):
        raise SensorApiError("sensor API pointDataRequestDefaults must be an object")
    if "deviceDataIdList" in request_defaults:
        raise SensorApiError(
            "data/sensor-api.json must not define deviceDataIdList; "
            "use data/ship-profile.json devices[].collectEnabled"
        )
    try:
        profile, profile_path = load_ship_profile(root)
    except ShipProfileError as exc:
        raise SensorApiError(str(exc)) from exc

    merged = copy.deepcopy(config)
    merged["shipId"] = profile["sensorApiShipId"]
    merged_defaults = merged.setdefault("pointDataRequestDefaults", {})
    merged_defaults["deviceDataIdList"] = collect_device_data_ids(profile)
    merged["shipProfilePath"] = _relative_path(root, profile_path)
    return merged, path


def _endpoint_url(config: dict[str, Any], name: str) -> str:
    endpoint = str(config["endpoints"][name]).strip()
    if endpoint.startswith(("http://", "https://")):
        return endpoint
    return f"{str(config['baseUrl']).rstrip('/')}/{endpoint.lstrip('/')}"


def _profile_bound_ship_id(
    config: dict[str, Any],
    requested_ship_id: str | None,
) -> str:
    configured = str(config["shipId"]).strip()
    requested = str(requested_ship_id or "").strip()
    if requested and requested != configured:
        raise SensorApiError(
            f"requested sensor API shipId {requested!r} does not match "
            f"data/ship-profile.json sensorApiShipId {configured!r}"
        )
    return configured


def _env_file_value(path: Path, variable_name: str) -> str:
    try:
        lines = path.read_text(encoding="utf-8-sig").splitlines()
    except FileNotFoundError:
        return ""
    except OSError as exc:
        raise SensorApiError(f"cannot read configured token file: {path}") from exc

    value = ""
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        key, separator, raw_value = line.partition("=")
        if not separator or key.strip() != variable_name:
            continue
        candidate = raw_value.strip()
        if len(candidate) >= 2 and candidate[0] == candidate[-1] and candidate[0] in {"'", '"'}:
            candidate = candidate[1:-1]
        value = candidate.strip()
    return value


def _authorization_token(
    workspace: Path,
    config: dict[str, Any],
    token: str | None,
) -> str:
    value = (token or "").strip()
    token_file = str(config.get("tokenFile") or "").strip()
    if not value and token_file:
        value = _env_file_value(
            _resolve_workspace_path(workspace, token_file),
            str(config["tokenEnv"]),
        )
    if not value:
        value = os.environ.get(str(config["tokenEnv"]), "").strip()
    value = value.strip()
    if value.lower().startswith("bearer "):
        value = value[7:].strip()
    if not value:
        raise SensorApiError(
            f"missing API token; set {config['tokenEnv']} in the configured tokenFile "
            "or process environment"
        )
    return value


def _build_tls_context() -> ssl.SSLContext:
    """Build a deterministic HTTPS context without trusting broken env CA paths."""
    try:
        import certifi  # type: ignore[import-not-found]
    except ImportError:
        certifi = None

    if certifi is not None:
        try:
            ca_file = Path(certifi.where())
            if ca_file.is_file():
                return ssl.create_default_context(cafile=str(ca_file))
        except OSError:
            # Fall back to the operating-system/Python trust store below.
            pass

    try:
        return ssl.create_default_context()
    except FileNotFoundError as exc:
        raise SensorApiError(
            "cannot initialize HTTPS trust store: the configured CA file does not exist"
        ) from exc
    except ssl.SSLError as exc:
        raise SensorApiError(f"cannot initialize HTTPS trust store: {exc}") from exc


def _http_post_json(url: str, token: str, body: dict[str, Any], timeout: float) -> Any:
    request = urllib.request.Request(
        url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        context = _build_tls_context()
        with urllib.request.urlopen(request, timeout=timeout, context=context) as response:
            status = response.getcode()
            raw = response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise SensorApiError(f"sensor API HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        reason = exc.reason
        if isinstance(reason, (TimeoutError, socket.timeout)):
            raise SensorApiError(
                "sensor API request timed out; network access may be unavailable or blocked"
            ) from exc
        if isinstance(reason, FileNotFoundError):
            raise SensorApiError(
                "sensor API TLS setup failed: a configured local CA file does not exist"
            ) from exc
        if isinstance(reason, ssl.SSLError):
            raise SensorApiError(f"sensor API TLS handshake failed: {reason}") from exc
        raise SensorApiError(f"sensor API connection failed: {reason}") from exc
    except (TimeoutError, socket.timeout) as exc:
        raise SensorApiError(
            "sensor API request timed out; network access may be unavailable or blocked"
        ) from exc
    except FileNotFoundError as exc:
        raise SensorApiError(
            "sensor API TLS setup failed: a configured local CA file does not exist"
        ) from exc
    except ssl.SSLError as exc:
        raise SensorApiError(f"sensor API TLS handshake failed: {exc}") from exc

    if status < 200 or status >= 300:
        raise SensorApiError(f"sensor API returned HTTP {status}")
    try:
        return json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise SensorApiError("sensor API response is not valid UTF-8 JSON") from exc


def _post(
    url: str,
    token: str,
    body: dict[str, Any],
    timeout: float,
    transport: Transport | None,
) -> Any:
    return (transport or _http_post_json)(url, token, body, timeout)


def _post_with_retry(
    url: str,
    token: str,
    body: dict[str, Any],
    timeout: float,
    transport: Transport | None,
    retries: int,
    backoff_seconds: float,
    stop_on_http_500: bool = False,
) -> Any:
    attempts = max(int(retries), 1)
    last_error: SensorApiError | None = None
    attempted_count = 0
    for attempt in range(attempts):
        attempted_count = attempt + 1
        try:
            return _post(url, token, body, timeout, transport)
        except SensorApiError as exc:
            last_error = exc
            if stop_on_http_500 and _is_page_size_server_error(exc):
                break
            if attempt + 1 < attempts:
                time.sleep(max(backoff_seconds, 0.0) * (attempt + 1))
    window = f"{body.get('collectTimeStart', '')}..{body.get('collectTimeEnd', '')}"
    page = body.get("pageNo", "")
    raise SensorApiError(
        f"{last_error}; request failed after {attempted_count} attempts "
        f"(window={window}, pageNo={page})"
    ) from last_error


def _get_path(value: Any, path: str | None, default: Any = None) -> Any:
    if not path:
        return default
    current = value
    for part in path.split("."):
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return default
    return current


def _set_path(value: dict[str, Any], path: str, replacement: Any) -> None:
    parts = path.split(".") if path else []
    if not parts:
        raise SensorApiError("cannot replace the root response list in place")
    current: Any = value
    for part in parts[:-1]:
        if not isinstance(current, dict) or part not in current:
            raise SensorApiError(f"pagination items path disappeared: {path}")
        current = current[part]
    if not isinstance(current, dict):
        raise SensorApiError(f"pagination items path parent is not an object: {path}")
    current[parts[-1]] = replacement


def _list_paths(value: Any, prefix: str = "", depth: int = 0) -> list[tuple[str, list[Any]]]:
    if depth > 5:
        return []
    if isinstance(value, list):
        return [(prefix, value)]
    if not isinstance(value, dict):
        return []
    result: list[tuple[str, list[Any]]] = []
    for key, item in value.items():
        path = f"{prefix}.{key}" if prefix else str(key)
        result.extend(_list_paths(item, path, depth + 1))
    return result


def _detect_items_path(response: Any, configured_path: str | None) -> tuple[str, list[Any]]:
    if configured_path and configured_path != "auto":
        items = _get_path(response, configured_path)
        if not isinstance(items, list):
            raise SensorApiError(
                f"configured pagination.itemsPath is not an array: {configured_path}"
            )
        return configured_path, items

    candidates = _list_paths(response)
    if not candidates:
        raise SensorApiError("point-data-list response contains no array")
    preferred_names = ("records", "list", "rows", "content", "items", "data")

    def rank(candidate: tuple[str, list[Any]]) -> tuple[int, int, str]:
        path, items = candidate
        leaf = path.rsplit(".", 1)[-1]
        try:
            preference = preferred_names.index(leaf)
        except ValueError:
            preference = len(preferred_names)
        return preference, path.count("."), path

    path, items = min(candidates, key=rank)
    return path, items


def _find_numeric_field(value: Any, names: tuple[str, ...], depth: int = 0) -> int | None:
    if depth > 5 or not isinstance(value, dict):
        return None
    for name in names:
        item = value.get(name)
        if isinstance(item, (int, float)) and not isinstance(item, bool):
            return int(item)
        if isinstance(item, str) and item.isdigit():
            return int(item)
    for item in value.values():
        found = _find_numeric_field(item, names, depth + 1)
        if found is not None:
            return found
    return None


def _response_total(response: Any, configured_path: str | None) -> int | None:
    if configured_path and configured_path != "auto":
        value = _get_path(response, configured_path)
        try:
            return int(value)
        except (TypeError, ValueError) as exc:
            raise SensorApiError(
                f"configured pagination.totalPath is not an integer: {configured_path}"
            ) from exc
    return _find_numeric_field(
        response,
        ("total", "totalElements", "totalCount", "recordCount"),
    )


def _response_page_count(response: Any) -> int | None:
    page_count = _find_numeric_field(response, ("pageCount", "totalPages"))
    if page_count is not None and page_count < 0:
        raise SensorApiError("point-data-list pageCount must not be negative")
    return page_count


def _point_data_request_defaults(config: dict[str, Any]) -> dict[str, Any]:
    defaults = config.get("pointDataRequestDefaults", {})
    if not isinstance(defaults, dict):
        raise SensorApiError("pointDataRequestDefaults must be an object")
    try:
        page_no = int(defaults.get("pageNo", 0))
        page_size = int(defaults.get("pageSize", 10000))
    except (TypeError, ValueError) as exc:
        raise SensorApiError(
            "pointDataRequestDefaults pageNo/pageSize must be integers"
        ) from exc
    if page_no != 0:
        raise SensorApiError("pointDataRequestDefaults.pageNo must remain 0")
    if page_size <= 0:
        raise SensorApiError("pointDataRequestDefaults.pageSize must be positive")
    raw_fallbacks = defaults.get("pageSizeFallbacks", [])
    if not isinstance(raw_fallbacks, list):
        raise SensorApiError(
            "pointDataRequestDefaults.pageSizeFallbacks must be an array"
        )
    try:
        page_size_fallbacks = [int(value) for value in raw_fallbacks]
    except (TypeError, ValueError) as exc:
        raise SensorApiError(
            "pointDataRequestDefaults.pageSizeFallbacks must contain integers"
        ) from exc
    if any(value <= 0 for value in page_size_fallbacks):
        raise SensorApiError(
            "pointDataRequestDefaults.pageSizeFallbacks must contain positive integers"
        )
    if any(value >= page_size for value in page_size_fallbacks):
        raise SensorApiError(
            "pointDataRequestDefaults.pageSizeFallbacks must be smaller than pageSize"
        )
    if page_size_fallbacks != sorted(set(page_size_fallbacks), reverse=True):
        raise SensorApiError(
            "pointDataRequestDefaults.pageSizeFallbacks must be unique and descending"
        )
    if str(defaults.get("collectTimeTimezone", TIME_SEMANTICS)) != TIME_SEMANTICS:
        raise SensorApiError(
            f"pointDataRequestDefaults.collectTimeTimezone must be {TIME_SEMANTICS}"
        )
    request_timezone = str(defaults.get("requestTimeTimezone", TIME_SEMANTICS))
    if request_timezone != TIME_SEMANTICS:
        raise SensorApiError(
            f"pointDataRequestDefaults.requestTimeTimezone must be {TIME_SEMANTICS}"
        )
    for field in ("deviceDataIdList", "pointDataIdList"):
        values = defaults.get(field)
        if values is not None and not isinstance(values, list):
            raise SensorApiError(f"pointDataRequestDefaults.{field} must be an array")
    return defaults


def _page_size_candidates(
    request_defaults: dict[str, Any],
    requested_page_size: int,
) -> list[int]:
    return [
        requested_page_size,
        *[
            int(value)
            for value in request_defaults.get("pageSizeFallbacks", [])
            if int(value) < requested_page_size
        ],
    ]


def _is_page_size_server_error(error: SensorApiError) -> bool:
    match = re.search(r"sensor API HTTP ([0-9]{3})", str(error))
    return bool(match and int(match.group(1)) == 500)


def _parse_api_datetime(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    else:
        text = str(value).strip()
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError as exc:
            raise SensorApiError(
                f"invalid datetime {value!r}; expected YYYY-MM-DD HH:mm:ss"
            ) from exc
    if parsed.tzinfo is not None and parsed.utcoffset() is not None:
        parsed = parsed.astimezone(BEIJING_TZ).replace(tzinfo=None)
    return parsed.replace(microsecond=0)


def _api_datetime(value: datetime) -> str:
    return _parse_api_datetime(value).strftime("%Y-%m-%d %H:%M:%S")


def _request_datetime(value: datetime, timezone_name: str) -> str:
    if timezone_name != TIME_SEMANTICS:
        raise SensorApiError(f"requestTimeTimezone must be {TIME_SEMANTICS}")
    return _api_datetime(value)


def _response_datetime(value: Any) -> datetime:
    text = str(value or "").strip()
    if not text:
        raise SensorApiError("point-data-list row is missing collectTime")
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise SensorApiError(f"invalid point-data-list collectTime: {text}") from exc
    if parsed.tzinfo is not None and parsed.utcoffset() is not None:
        parsed = parsed.astimezone(BEIJING_TZ).replace(tzinfo=None)
    return parsed.replace(microsecond=0)


def _latest_raw_cursor(workspace: Path, config: dict[str, Any]) -> datetime | None:
    output_dir_value = config.get("outputs", {}).get("rawDataDir") or DEFAULT_RAW_DATA_DIR
    raw_dir = _resolve_workspace_path(workspace, output_dir_value)
    if not raw_dir.is_dir():
        return None
    latest: datetime | None = None
    for path in raw_dir.glob("*.json"):
        try:
            payload = _read_json(path)
        except SensorApiError:
            continue
        if not isinstance(payload, dict):
            continue
        metadata = payload.get("_fetchMetadata")
        if (
            isinstance(metadata, dict)
            and metadata.get("collectTimeTimezone") in {"UTC", TIME_SEMANTICS}
            and metadata.get("collectTimeEnd")
        ):
            try:
                candidate = _parse_api_datetime(metadata["collectTimeEnd"])
                latest = candidate if latest is None else max(latest, candidate)
            except SensorApiError:
                pass
        rows = payload.get("pointDataList")
        if not isinstance(rows, list):
            continue
        for item in rows:
            if not isinstance(item, dict) or not item.get("collectTime"):
                continue
            try:
                candidate = _response_datetime(item["collectTime"])
            except SensorApiError:
                continue
            latest = candidate if latest is None else max(latest, candidate)
    return latest


def _raw_window_catalog(
    workspace: Path,
    config: dict[str, Any],
) -> dict[str, str]:
    """Return valid requested raw windows keyed by Beijing start time."""
    output_dir_value = config.get("outputs", {}).get("rawDataDir") or DEFAULT_RAW_DATA_DIR
    raw_dir = _resolve_workspace_path(workspace, output_dir_value)
    if not raw_dir.is_dir():
        return {}
    windows: dict[str, str] = {}
    for path in raw_dir.glob("*.json"):
        try:
            payload = _read_json(path)
        except SensorApiError:
            continue
        if not isinstance(payload, dict):
            continue
        metadata = payload.get("_fetchMetadata")
        if not isinstance(metadata, dict):
            continue
        try:
            start = _parse_api_datetime(metadata.get("collectTimeStart"))
            end = _parse_api_datetime(metadata.get("collectTimeEnd"))
        except SensorApiError:
            continue
        if end <= start:
            continue
        windows[_api_datetime(start)] = _api_datetime(end)
    return windows


def _latest_completed_window(
    now: datetime,
    window_minutes: int,
) -> tuple[datetime, datetime]:
    if window_minutes <= 0 or 60 % window_minutes != 0:
        raise SensorApiError("windowMinutes must divide one hour for realtime recovery")
    current = _parse_api_datetime(now)
    completed_end = current.replace(
        minute=(current.minute // window_minutes) * window_minutes,
        second=0,
        microsecond=0,
    )
    return completed_end - timedelta(minutes=window_minutes), completed_end


def _relative_path(workspace: Path, path: Path) -> str:
    try:
        return path.resolve().relative_to(workspace.resolve()).as_posix()
    except ValueError as exc:
        raise SensorApiError(f"output path escapes workspace: {path}") from exc


def _deduplicate_point_mapping(response: Any) -> tuple[dict[str, Any], int, int]:
    if not isinstance(response, dict) or not isinstance(response.get("pointList"), list):
        raise SensorApiError("point-list response must contain a pointList array")
    unique: dict[tuple[str, str], dict[str, Any]] = {}
    source_count = len(response["pointList"])
    for item in response["pointList"]:
        if not isinstance(item, dict):
            raise SensorApiError("point-list contains a non-object item")
        device_id = str(item.get("deviceDataId") or "")
        point_id = str(item.get("pointDataId") or "")
        if not device_id or not point_id:
            raise SensorApiError("point-list item is missing deviceDataId or pointDataId")
        key = (device_id, point_id)
        existing = unique.get(key)
        if existing is not None and existing != item:
            raise SensorApiError(
                f"conflicting point-list rows for deviceDataId={device_id}, pointDataId={point_id}"
            )
        unique.setdefault(key, item)
    normalized = dict(response)
    normalized["pointList"] = sorted(
        unique.values(),
        key=lambda item: (
            str(item.get("deviceDataId") or "").zfill(24),
            str(item.get("pointDataId") or "").zfill(24),
        ),
    )
    return normalized, source_count, len(unique)


def fetch_point_mapping(
    workspace: str | Path,
    *,
    config_path: str | Path | None = None,
    output_path: str | Path | None = None,
    ship_id: str | None = None,
    token: str | None = None,
    transport: Transport | None = None,
) -> dict[str, Any]:
    root = Path(workspace).resolve()
    config, used_config_path = load_api_config(root, config_path)
    active_ship_id = _profile_bound_ship_id(config, ship_id)
    active_token = _authorization_token(root, config, token)
    url = _endpoint_url(config, "pointList")
    timeout = float(config.get("timeoutSeconds", 30))
    response = _post_with_retry(
        url,
        active_token,
        {"shipId": active_ship_id},
        timeout,
        transport,
        int(config.get("requestRetries", 3)),
        float(config.get("retryBackoffSeconds", 2)),
    )
    normalized, source_count, point_count = _deduplicate_point_mapping(response)

    configured_output = (
        output_path
        or config.get("outputs", {}).get("pointMapping")
        or DEFAULT_MAPPING_PATH
    )
    destination = _resolve_workspace_path(root, configured_output)
    _relative_path(root, destination)
    _write_json_atomic(destination, normalized)
    return {
        "ok": True,
        "status": "connected",
        "endpoint": url,
        "shipId": active_ship_id,
        "configPath": _relative_path(root, used_config_path),
        "mappingPath": _relative_path(root, destination),
        "sourceRecordCount": source_count,
        "pointCount": point_count,
        "duplicatesRemoved": source_count - point_count,
    }


def _fetch_paginated_segment(
    *,
    url: str,
    token: str,
    body: dict[str, Any],
    page_size: int,
    max_pages: int,
    timeout: float,
    configured_items_path: str | None,
    configured_total_path: str | None,
    transport: Transport | None,
    request_retries: int,
    retry_backoff_seconds: float,
) -> dict[str, Any]:
    first_response: Any = None
    items_path = ""
    all_items: list[Any] = []
    seen_pages: set[str] = set()
    reported_total: int | None = None
    reported_page_count: int | None = None
    page_count = 0
    for page_no in range(max_pages):
        page_body = {**body, "pageNo": page_no, "pageSize": page_size}
        response = _post_with_retry(
            url,
            token,
            page_body,
            timeout,
            transport,
            request_retries,
            retry_backoff_seconds,
            stop_on_http_500=True,
        )
        if not isinstance(response, (dict, list)):
            raise SensorApiError("point-data-list response root must be an object or array")
        current_path, page_items = _detect_items_path(
            response,
            configured_items_path if page_no == 0 else items_path,
        )
        if page_no == 0:
            first_response = copy.deepcopy(response)
            items_path = current_path
            reported_total = _response_total(response, configured_total_path)
            reported_page_count = _response_page_count(response)
        elif current_path != items_path:
            raise SensorApiError(
                f"pagination items path changed from {items_path} to {current_path}"
            )

        signature = json.dumps(page_items, ensure_ascii=False, sort_keys=True)
        if signature in seen_pages and page_items:
            raise SensorApiError(
                f"point-data-list repeated page content at pageNo={page_no}; aborting"
            )
        seen_pages.add(signature)
        all_items.extend(page_items)
        page_count += 1

        if reported_total is not None and len(all_items) >= reported_total:
            break
        if reported_page_count is not None:
            if page_count >= reported_page_count:
                break
            if not page_items:
                raise SensorApiError(
                    "point-data-list returned an empty page before reported pageCount "
                    f"was reached (pageNo={page_no}, pageCount={reported_page_count})"
                )
            continue
        if not page_items or len(page_items) < page_size:
            break
    else:
        raise SensorApiError(f"point-data-list exceeded maxPages={max_pages}")
    if first_response is None:
        raise SensorApiError("point-data-list returned no pages")
    return {
        "response": first_response,
        "itemsPath": items_path,
        "items": all_items,
        "reportedTotal": reported_total,
        "reportedPageCount": reported_page_count,
        "pageCount": page_count,
    }


def _item_sort_key(item: Any) -> tuple[str, str, str, str]:
    if not isinstance(item, dict):
        return "", "", "", json.dumps(item, ensure_ascii=False, sort_keys=True)
    return (
        str(item.get("collectTime") or ""),
        str(item.get("deviceDataId") or "").zfill(24),
        str(item.get("pointDataId") or "").zfill(24),
        str(item.get("dataId") or "").zfill(24),
    )


def _normalize_point_data_items(items: list[Any]) -> tuple[list[dict[str, Any]], int]:
    normalized: list[dict[str, Any]] = []
    blank_placeholder_count = 0
    for index, item in enumerate(items):
        if isinstance(item, dict) and all(
            item.get(field) in (None, "") for field in POINT_DATA_REQUIRED_FIELDS
        ):
            blank_placeholder_count += 1
            continue
        if not isinstance(item, dict):
            raise SensorApiError(
                f"point-data-list record at merged index {index} must be an object"
            )

        missing = [field for field in POINT_DATA_REQUIRED_FIELDS if field not in item]
        if missing:
            raise SensorApiError(
                "point-data-list record at merged index "
                f"{index} is missing required fields: {missing}"
            )

        invalid_ids = [
            field
            for field in POINT_DATA_ID_FIELDS
            if isinstance(item[field], bool)
            or not isinstance(item[field], (int, str))
            or (isinstance(item[field], str) and not item[field].strip())
        ]
        if invalid_ids:
            raise SensorApiError(
                "point-data-list record at merged index "
                f"{index} has invalid identity fields: {invalid_ids}"
            )
        if not isinstance(item["collectTime"], str) or not item["collectTime"].strip():
            raise SensorApiError(
                "point-data-list record at merged index "
                f"{index} has invalid collectTime"
            )
        value = item["value"]
        if isinstance(value, bool) or (
            value is not None and not isinstance(value, (int, float, str))
        ):
            raise SensorApiError(
                f"point-data-list record at merged index {index} has invalid value"
            )
        normalized.append(item)
    return normalized, blank_placeholder_count


def fetch_sensor_raw_data(
    workspace: str | Path,
    *,
    config_path: str | Path | None = None,
    output_path: str | Path | None = None,
    ship_id: str | None = None,
    collect_time_start: str | datetime | None = None,
    collect_time_end: str | datetime | None = None,
    device_data_ids: list[int] | None = None,
    point_data_ids: list[int] | None = None,
    page_size: int | None = None,
    token: str | None = None,
    now: datetime | None = None,
    transport: Transport | None = None,
    minimum_coverage_ratio: float | None = None,
) -> dict[str, Any]:
    if minimum_coverage_ratio is not None and (
        isinstance(minimum_coverage_ratio, bool)
        or not isinstance(minimum_coverage_ratio, (int, float))
        or not 0 < minimum_coverage_ratio <= 1
    ):
        raise SensorApiError("minimum_coverage_ratio must be in (0, 1]")
    root = Path(workspace).resolve()
    config, used_config_path = load_api_config(root, config_path)
    window_minutes = int(config.get("windowMinutes", 30))
    if window_minutes != 30:
        raise SensorApiError("sensor API config windowMinutes must remain 30")

    cursor_source: str
    if collect_time_start is not None:
        start = _parse_api_datetime(collect_time_start)
        end = (
            _parse_api_datetime(collect_time_end)
            if collect_time_end is not None
            else start + timedelta(minutes=window_minutes)
        )
        cursor_source = "explicit_start"
    elif collect_time_end is not None:
        end = _parse_api_datetime(collect_time_end)
        start = end - timedelta(minutes=window_minutes)
        cursor_source = "explicit_end"
    else:
        latest_cursor = _latest_raw_cursor(root, config)
        if latest_cursor is not None:
            start = latest_cursor
            end = start + timedelta(minutes=window_minutes)
            cursor_source = "latest_raw_data"
        else:
            end = _parse_api_datetime(now or datetime.now(BEIJING_TZ))
            start = end - timedelta(minutes=window_minutes)
            cursor_source = "current_time"
    if end <= start:
        raise SensorApiError("collectTimeEnd must be later than collectTimeStart")

    request_defaults = _point_data_request_defaults(config)
    request_timezone_name = str(request_defaults.get("requestTimeTimezone", TIME_SEMANTICS))
    active_page_size = int(
        page_size if page_size is not None else request_defaults.get("pageSize", 10000)
    )
    if active_page_size <= 0:
        raise SensorApiError("pageSize must be a positive integer")
    max_pages = int(config.get("maxPages", 10000))
    if max_pages <= 0:
        raise SensorApiError("maxPages must be a positive integer")

    active_ship_id = _profile_bound_ship_id(config, ship_id)
    active_token = _authorization_token(root, config, token)
    url = _endpoint_url(config, "pointDataList")
    timeout = float(config.get("timeoutSeconds", 30))
    request_retries = int(config.get("requestRetries", 3))
    retry_backoff_seconds = float(config.get("retryBackoffSeconds", 2))
    pagination = config.get("pagination", {})
    configured_items_path = pagination.get("itemsPath") if isinstance(pagination, dict) else None
    configured_total_path = pagination.get("totalPath") if isinstance(pagination, dict) else None

    configured_device_ids = request_defaults.get("deviceDataIdList")
    configured_point_ids = request_defaults.get("pointDataIdList")
    active_device_ids = (
        device_data_ids if device_data_ids is not None else configured_device_ids
    )
    active_point_ids = point_data_ids if point_data_ids is not None else configured_point_ids

    base_body: dict[str, Any] = {
        "shipId": active_ship_id,
    }
    if active_device_ids:
        base_body["deviceDataIdList"] = [int(value) for value in active_device_ids]
    if active_point_ids:
        base_body["pointDataIdList"] = [int(value) for value in active_point_ids]

    # Explicit event ranges remain one window; paginate without splitting time.
    windows = [(start, end)]
    request_window_seconds = int((end - start).total_seconds())

    first_response: Any = None
    items_path = ""
    all_items: list[Any] = []
    reported_total_sum = 0
    page_count = 0
    page_size_attempts: list[int] = []
    used_page_size = active_page_size
    for segment_start, segment_end in windows:
        segment: dict[str, Any] | None = None
        page_size_candidates = _page_size_candidates(
            request_defaults,
            active_page_size,
        )
        for index, candidate_page_size in enumerate(page_size_candidates):
            page_size_attempts.append(candidate_page_size)
            try:
                segment = _fetch_paginated_segment(
                    url=url,
                    token=active_token,
                    body={
                        **base_body,
                        "collectTimeStart": _request_datetime(
                            segment_start, request_timezone_name
                        ),
                        "collectTimeEnd": _request_datetime(
                            segment_end, request_timezone_name
                        ),
                    },
                    page_size=candidate_page_size,
                    max_pages=max_pages,
                    timeout=timeout,
                    configured_items_path=configured_items_path,
                    configured_total_path=configured_total_path,
                    transport=transport,
                    request_retries=request_retries,
                    retry_backoff_seconds=retry_backoff_seconds,
                )
                used_page_size = candidate_page_size
                break
            except SensorApiError as exc:
                has_smaller_fallback = index + 1 < len(page_size_candidates)
                if not has_smaller_fallback or not _is_page_size_server_error(exc):
                    raise
        if segment is None:
            raise SensorApiError("point-data-list pagination produced no result")
        if first_response is None:
            first_response = segment["response"]
            items_path = str(segment["itemsPath"])
        elif segment["itemsPath"] != items_path:
            raise SensorApiError(
                f"pagination items path changed from {items_path} to {segment['itemsPath']}"
            )
        segment_total = segment["reportedTotal"]
        reported_total_sum += int(segment_total or len(segment["items"]))
        all_items.extend(segment["items"])
        page_count += int(segment["pageCount"])

    if first_response is None:
        raise SensorApiError("point-data-list returned no pages")
    received_record_count = len(all_items)
    all_items, blank_placeholder_count = _normalize_point_data_items(all_items)
    valid_record_count_before_deduplication = len(all_items)
    deduplicated_items: list[Any] = []
    seen_items: set[str] = set()
    for item in all_items:
        signature = json.dumps(item, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        if signature not in seen_items:
            seen_items.add(signature)
            deduplicated_items.append(item)
    all_items = sorted(deduplicated_items, key=_item_sort_key)
    duplicates_removed = valid_record_count_before_deduplication - len(all_items)
    coverage: dict[str, Any] | None = None
    if minimum_coverage_ratio is not None:
        # Only the manual caller opts in. Out-of-window samples cannot become
        # current-report evidence, even if an upstream endpoint returns them.
        all_items = [item for item in all_items
                     if start <= _response_datetime(item["collectTime"]) <= end]
        valid_times = []
        for item in all_items:
            try:
                valid = math.isfinite(float(item["value"]))
            except (TypeError, ValueError):
                valid = False
            if valid:
                valid_times.append(_response_datetime(item["collectTime"]))
        if not valid_times:
            raise SensorApiError("point-data-list returned no usable numeric records for the requested window")
        valid_start, valid_end = min(valid_times), max(valid_times)
        duration = (end - start).total_seconds()
        covered = (valid_end - valid_start).total_seconds()
        ratio = covered / duration
        if ratio < minimum_coverage_ratio:
            raise SensorApiError(
                "point-data-list did not cover the requested window: "
                f"requested={_api_datetime(start)}..{_api_datetime(end)}, "
                f"actual={_api_datetime(valid_start)}..{_api_datetime(valid_end)}, "
                f"coverage={ratio:.2%}, minimum={minimum_coverage_ratio:.2%}"
            )
        coverage = {
            "policy": "minimum_time_span_ratio", "minimum_ratio": minimum_coverage_ratio,
            "ratio": ratio, "covered_seconds": covered, "requested_seconds": duration,
            "requested_window": {"start_time": start.isoformat(), "end_time": end.isoformat()},
            "actual_window": {"start_time": valid_start.isoformat(), "end_time": valid_end.isoformat()},
            "missing_start_seconds": (valid_start - start).total_seconds(),
            "missing_end_seconds": (end - valid_end).total_seconds(),
        }
    response_times = [
        _response_datetime(item.get("collectTime"))
        for item in all_items
        if isinstance(item, dict) and item.get("collectTime") not in (None, "")
    ]
    if not response_times:
        raise SensorApiError(
            "point-data-list returned no timestamped records for the requested window"
        )
    actual_start = min(response_times)
    actual_end = max(response_times)
    coverage_tolerance = timedelta(
        seconds=max(float(config.get("coverageToleranceSeconds", 30)), 0.0)
    )
    if minimum_coverage_ratio is None and (
        actual_start > start + coverage_tolerance or actual_end < end - coverage_tolerance
    ):
        raise SensorApiError(
            "point-data-list did not cover the requested window: "
            f"requested={_api_datetime(start)}..{_api_datetime(end)}, "
            f"actual={_api_datetime(actual_start)}..{_api_datetime(actual_end)}"
        )
    if isinstance(first_response, dict):
        _set_path(first_response, items_path, all_items)
        output_payload = first_response
    else:
        output_payload = {"data": all_items}
        items_path = "data"
    # The landed raw-data contract always exposes the merged totals at root,
    # even if an upstream deployment omits one of the pagination counters.
    output_payload["total"] = len(all_items)
    output_payload["pageCount"] = page_count
    output_payload["_fetchMetadata"] = {
        "source": "point-data-list",
        "apiUrl": url,
        "shipId": active_ship_id,
        "collectTimeStart": _api_datetime(start),
        "collectTimeEnd": _api_datetime(end),
        "collectTimeTimezone": TIME_SEMANTICS,
        "requestCollectTimeStart": _request_datetime(start, request_timezone_name),
        "requestCollectTimeEnd": _request_datetime(end, request_timezone_name),
        "requestTimeTimezone": request_timezone_name,
        "cursorSource": cursor_source,
        "requestWindowSeconds": request_window_seconds,
        "requestWindowCount": len(windows),
        "deviceDataIdList": [str(value) for value in base_body.get("deviceDataIdList", [])],
        "pointDataIdList": [str(value) for value in base_body.get("pointDataIdList", [])],
        "pageSize": used_page_size,
        "pageSizeAttempts": page_size_attempts,
        "pageSizeFallbackUsed": used_page_size != active_page_size,
        "pageCount": page_count,
        "recordCount": len(all_items),
        "receivedRecordCount": received_record_count,
        "blankPlaceholderRecordsRemoved": blank_placeholder_count,
        "actualCollectTimeStart": _api_datetime(actual_start),
        "actualCollectTimeEnd": _api_datetime(actual_end),
        "reportedTotalBeforeDeduplication": reported_total_sum,
        "duplicatesRemoved": duplicates_removed,
        "recordsPath": items_path,
        "fetchedAt": datetime.now(BEIJING_TZ).replace(tzinfo=None, microsecond=0).isoformat(),
        **({"coverage": coverage} if coverage is not None else {}),
    }

    if output_path is None:
        output_dir_value = (
            config.get("outputs", {}).get("rawDataDir") or DEFAULT_RAW_DATA_DIR
        )
        output_dir = _resolve_workspace_path(root, output_dir_value)
        filename = f"sensor-raw-{end.strftime('%Y%m%d_%H%M%S')}__raw-data.json"
        destination = output_dir / filename
    else:
        destination = _resolve_workspace_path(root, output_path)
    _relative_path(root, destination)
    _write_json_atomic(destination, output_payload)
    return {
        "ok": True,
        "status": "connected",
        "endpoint": url,
        "shipId": active_ship_id,
        "collectTimeStart": _api_datetime(start),
        "collectTimeEnd": _api_datetime(end),
        "collectTimeTimezone": TIME_SEMANTICS,
        "requestCollectTimeStart": _request_datetime(start, request_timezone_name),
        "requestCollectTimeEnd": _request_datetime(end, request_timezone_name),
        "requestTimeTimezone": request_timezone_name,
        "cursorSource": cursor_source,
        "requestWindowSeconds": request_window_seconds,
        "requestWindowCount": len(windows),
        "deviceDataIdList": [str(value) for value in base_body.get("deviceDataIdList", [])],
        "pointDataIdList": [str(value) for value in base_body.get("pointDataIdList", [])],
        "pageSize": used_page_size,
        "pageSizeAttempts": page_size_attempts,
        "pageSizeFallbackUsed": used_page_size != active_page_size,
        "pageCount": page_count,
        "recordCount": len(all_items),
        "receivedRecordCount": received_record_count,
        "blankPlaceholderRecordsRemoved": blank_placeholder_count,
        "recordsPath": items_path,
        "configPath": _relative_path(root, used_config_path),
        "rawDataPath": _relative_path(root, destination),
        **({"coverage": coverage} if coverage is not None else {}),
    }


def _empty_or_incomplete_window_error(message: str) -> bool:
    return message.startswith(
        (
            "point-data-list returned no timestamped records",
            "point-data-list did not cover the requested window",
        )
    )


def sync_sensor_raw_data(
    workspace: str | Path,
    *,
    config_path: str | Path | None = None,
    state_path: str | Path | None = None,
    token: str | None = None,
    max_forward_windows: int | None = None,
    max_pending_retries: int | None = None,
    stale_after_hours: float | None = None,
    target_raw_files: int | None = None,
    now: datetime | None = None,
    transport: Transport | None = None,
) -> dict[str, Any]:
    """Restore realtime first, then backfill the rolling raw-data horizon."""
    root = Path(workspace).resolve()
    config, used_config_path = load_api_config(root, config_path)
    active_token = _authorization_token(root, config, token)
    window_minutes = int(config.get("windowMinutes", 30))
    if window_minutes != 30:
        raise SensorApiError("sensor API config windowMinutes must remain 30")

    catch_up = config.get("catchUp", {})
    if not isinstance(catch_up, dict):
        raise SensorApiError("sensor API config catchUp must be an object")
    active_max_forward = int(
        max_forward_windows
        if max_forward_windows is not None
        else catch_up.get("maxForwardProbeWindowsPerRun", 12)
    )
    active_max_pending = int(
        max_pending_retries
        if max_pending_retries is not None
        else catch_up.get("maxPendingRetriesPerRun", 12)
    )
    active_stale_after_hours = float(
        stale_after_hours
        if stale_after_hours is not None
        else catch_up.get("staleAfterHours", DEFAULT_STALE_AFTER_HOURS)
    )
    active_target_raw_files = int(
        target_raw_files
        if target_raw_files is not None
        else catch_up.get("targetRawFiles", DEFAULT_TARGET_RAW_FILES)
    )
    if active_max_forward <= 0 or active_max_pending < 0:
        raise SensorApiError("catch-up window limits must be positive")
    if active_stale_after_hours <= 0:
        raise SensorApiError("catch-up staleAfterHours must be positive")
    if active_target_raw_files <= 0:
        raise SensorApiError("catch-up targetRawFiles must be positive")
    if active_target_raw_files * window_minutes > active_stale_after_hours * 60:
        raise SensorApiError(
            "catch-up targetRawFiles must fit inside staleAfterHours"
        )

    configured_state_path = (
        state_path
        or catch_up.get("statePath")
        or DEFAULT_FETCH_STATE_PATH
    )
    destination = _resolve_workspace_path(root, configured_state_path)
    _relative_path(root, destination)
    if destination.exists():
        state = _read_json(destination)
        if not isinstance(state, dict) or not isinstance(state.get("pendingWindows", []), list):
            raise SensorApiError(f"invalid sensor fetch state: {destination}")
    else:
        state = {
            "version": FETCH_STATE_VERSION,
            "pendingWindows": [],
            "expiredWindows": [],
            "expiredWindowCount": 0,
        }

    attempted_at = _parse_api_datetime(now or datetime.now(BEIJING_TZ))
    attempted_at_iso = attempted_at.replace(microsecond=0).isoformat()
    completed_start, completed_end = _latest_completed_window(
        attempted_at,
        window_minutes,
    )
    completed_start_text = _api_datetime(completed_start)
    completed_end_text = _api_datetime(completed_end)
    stale_delta = timedelta(hours=active_stale_after_hours)
    latest_before_cycle = _latest_raw_cursor(root, config)
    stale_before_cycle = (
        latest_before_cycle is None
        or attempted_at - latest_before_cycle > stale_delta
    )
    recovery_mode = "realtime_reseed" if stale_before_cycle else "rolling_backfill"
    raw_windows = _raw_window_catalog(root, config)
    desired_window_starts = [
        _api_datetime(completed_end - timedelta(minutes=window_minutes * (index + 1)))
        for index in range(active_target_raw_files)
    ]
    desired_window_start_set = set(desired_window_starts)

    pending_by_start: dict[str, dict[str, Any]] = {}
    for entry in state.get("pendingWindows", []):
        if not isinstance(entry, dict):
            raise SensorApiError(f"invalid pending window in sensor fetch state: {destination}")
        start_value = str(entry.get("collectTimeStart") or "")
        end_value = str(entry.get("collectTimeEnd") or "")
        _parse_api_datetime(start_value)
        _parse_api_datetime(end_value)
        pending_by_start[start_value] = dict(entry)

    expired_history = state.get("expiredWindows", [])
    if not isinstance(expired_history, list):
        raise SensorApiError(f"invalid expired windows in sensor fetch state: {destination}")
    expired_history = [dict(entry) for entry in expired_history if isinstance(entry, dict)]
    try:
        expired_window_count = int(state.get("expiredWindowCount", len(expired_history)))
    except (TypeError, ValueError) as exc:
        raise SensorApiError(
            f"invalid expiredWindowCount in sensor fetch state: {destination}"
        ) from exc
    expired_this_cycle: list[dict[str, Any]] = []
    pending_cutoff = completed_end - stale_delta
    for start_text, entry in list(pending_by_start.items()):
        pending_end = _parse_api_datetime(str(entry["collectTimeEnd"]))
        if pending_end >= pending_cutoff:
            continue
        expired_entry = dict(entry)
        expired_entry["expiredAt"] = attempted_at_iso
        expired_entry["expireReason"] = "outside_realtime_recovery_horizon"
        expired_this_cycle.append(expired_entry)
        pending_by_start.pop(start_text, None)
    if expired_this_cycle:
        expired_window_count += len(expired_this_cycle)
        expired_history.extend(expired_this_cycle)
        expired_history = expired_history[-100:]

    succeeded: list[dict[str, Any]] = []
    failed: list[dict[str, Any]] = []
    hard_failure = False
    attempted_starts: set[str] = set()

    def persist(last_status: str) -> None:
        available_target_count = sum(
            1 for start_text in desired_window_start_set if start_text in raw_windows
        )
        state["version"] = FETCH_STATE_VERSION
        state["updatedAt"] = attempted_at_iso
        state["pendingWindows"] = [
            pending_by_start[key] for key in sorted(pending_by_start)
        ]
        state["expiredWindows"] = list(expired_history)
        state["expiredWindowCount"] = expired_window_count
        state["recoveryPolicy"] = {
            "staleAfterHours": active_stale_after_hours,
            "targetRawFiles": active_target_raw_files,
            "priority": "latest_completed_window_first",
        }
        state["lastCycle"] = {
            "startedAt": attempted_at_iso,
            "status": last_status,
            "recoveryMode": recovery_mode,
            "latestCompletedWindow": {
                "collectTimeStart": completed_start_text,
                "collectTimeEnd": completed_end_text,
            },
            "availableTargetWindowCount": available_target_count,
            "remainingTargetWindowCount": max(
                active_target_raw_files - available_target_count,
                0,
            ),
            "expiredWindowCount": len(expired_this_cycle),
            "succeededWindows": [
                {
                    "collectTimeStart": item["collectTimeStart"],
                    "collectTimeEnd": item["collectTimeEnd"],
                    "rawDataPath": item["rawDataPath"],
                }
                for item in succeeded
            ],
            "failedWindows": list(failed),
        }
        _write_json_atomic(destination, state)

    def attempt_window(start: datetime, end: datetime) -> bool:
        nonlocal hard_failure
        start_text = _api_datetime(start)
        end_text = _api_datetime(end)
        attempted_starts.add(start_text)
        if start_text in raw_windows:
            pending_by_start.pop(start_text, None)
            return True
        previous = pending_by_start.get(start_text)
        try:
            result = fetch_sensor_raw_data(
                root,
                config_path=used_config_path,
                token=active_token,
                collect_time_start=start,
                collect_time_end=end,
                transport=transport,
            )
        except SensorApiError as exc:
            error = str(exc)
            first_failed_at = (
                str(previous.get("firstFailedAt"))
                if previous and previous.get("firstFailedAt")
                else attempted_at_iso
            )
            pending_by_start[start_text] = {
                "collectTimeStart": start_text,
                "collectTimeEnd": end_text,
                "firstFailedAt": first_failed_at,
                "lastAttemptAt": attempted_at_iso,
                "attemptCount": int(previous.get("attemptCount", 0)) + 1 if previous else 1,
                "lastError": error,
            }
            failed.append(
                {
                    "collectTimeStart": start_text,
                    "collectTimeEnd": end_text,
                    "error": error,
                }
            )
            hard_failure = not _empty_or_incomplete_window_error(error)
            persist("deferred")
            return False
        pending_by_start.pop(start_text, None)
        raw_windows[start_text] = end_text
        succeeded.append(result)
        persist("partial" if failed else "connected")
        return True

    # Realtime is always first. A large historical queue must never delay the
    # most recently completed Beijing half-hour window.
    if completed_start_text not in raw_windows:
        attempt_window(completed_start, completed_end)

    if not hard_failure and active_max_pending:
        pending_snapshot = [
            pending_by_start[key]
            for key in sorted(pending_by_start, reverse=True)
            if key in desired_window_start_set and key not in attempted_starts
        ][:active_max_pending]
        for entry in pending_snapshot:
            start = _parse_api_datetime(str(entry["collectTimeStart"]))
            end = _parse_api_datetime(str(entry["collectTimeEnd"]))
            attempt_window(start, end)
            if hard_failure:
                break

    # Fill missing windows inside the rolling target horizon, newest first.
    # The per-run budget makes 24 files a recovery target without blocking the
    # current analysis cycle on an unbounded historical backfill.
    if not hard_failure:
        missing_new_windows = [
            start_text
            for start_text in desired_window_starts
            if start_text not in raw_windows
            and start_text not in pending_by_start
            and start_text not in attempted_starts
        ][:active_max_forward]
        for start_text in missing_new_windows:
            start = _parse_api_datetime(start_text)
            attempt_window(start, start + timedelta(minutes=window_minutes))
            if hard_failure:
                break

    latest_after_cycle = _latest_raw_cursor(root, config)
    latest_raw_age_hours = (
        max((attempted_at - latest_after_cycle).total_seconds() / 3600.0, 0.0)
        if latest_after_cycle is not None
        else None
    )
    fresh_data_available = (
        latest_raw_age_hours is not None
        and latest_raw_age_hours <= active_stale_after_hours
    )
    if failed:
        status = "partial" if latest_after_cycle is not None else "deferred"
    elif fresh_data_available:
        status = "connected"
    elif latest_after_cycle is not None:
        status = "partial"
    else:
        status = "deferred"
    persist(status)
    available_target_count = sum(
        1 for start_text in desired_window_start_set if start_text in raw_windows
    )
    return {
        "ok": True,
        "status": status,
        "recoveryMode": recovery_mode,
        "statePath": _relative_path(root, destination),
        "staleAfterHours": active_stale_after_hours,
        "targetRawFiles": active_target_raw_files,
        "latestCompletedWindow": {
            "collectTimeStart": completed_start_text,
            "collectTimeEnd": completed_end_text,
        },
        "availableTargetWindowCount": available_target_count,
        "remainingTargetWindowCount": max(
            active_target_raw_files - available_target_count,
            0,
        ),
        "succeededWindowCount": len(succeeded),
        "failedWindowCount": len(failed),
        "pendingWindowCount": len(pending_by_start),
        "expiredWindowCount": expired_window_count,
        "expiredThisCycleCount": len(expired_this_cycle),
        "usedCachedRawData": bool(failed and latest_after_cycle is not None),
        "latestRawCursor": _api_datetime(latest_after_cycle) if latest_after_cycle else None,
        "latestRawAgeHours": latest_raw_age_hours,
        "freshDataAvailable": fresh_data_available,
        "succeededWindows": succeeded,
        "failedWindows": failed,
    }

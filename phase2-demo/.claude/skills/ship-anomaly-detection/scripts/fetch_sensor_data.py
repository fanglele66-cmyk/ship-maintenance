from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]
if str(SKILL_DIR) not in sys.path:
    sys.path.insert(0, str(SKILL_DIR))

from engine.sensor_api import (  # noqa: E402
    SensorApiError,
    fetch_point_mapping,
    fetch_sensor_raw_data,
    sync_sensor_raw_data,
)
from engine.ship_profile import load_ship_profile  # noqa: E402


def _ids(values: list[str] | None) -> list[int] | None:
    if not values:
        return None
    result: list[int] = []
    for value in values:
        for item in value.split(","):
            item = item.strip()
            if item:
                result.append(int(item))
    return result or None


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Fetch the configured standard pointDataList API mapping/raw package, "
            "or run realtime-first rolling recovery."
        )
    )
    parser.add_argument("action", choices=("mapping", "raw", "sync", "all"))
    parser.add_argument("--workspace", default=".")
    parser.add_argument("--config", default=None)
    parser.add_argument("--ship-id", default=None)
    parser.add_argument(
        "--start",
        default=None,
        help=(
            "API collectTime in timezone-free Beijing time. When --end is omitted, fetch exactly 30 minutes "
            "starting here. Without either time, continue from the latest raw JSON."
        ),
    )
    parser.add_argument(
        "--end",
        default=None,
        help="API collectTime in timezone-free Beijing time. When --start is omitted, fetch the preceding 30 minutes.",
    )
    parser.add_argument(
        "--page-size",
        type=int,
        default=None,
        help="Override pointDataRequestDefaults.pageSize (workspace default: 2000).",
    )
    parser.add_argument(
        "--device-data-id",
        action="append",
        default=None,
        help=(
            "Override the configured deviceDataIdList. Repeat or pass comma-separated IDs; "
            "the default selects every ship-profile device with collectEnabled=true "
            "for the active vessel."
        ),
    )
    parser.add_argument("--point-data-id", action="append", default=None)
    parser.add_argument("--mapping-output", default=None)
    parser.add_argument("--raw-output", default=None)
    parser.add_argument("--state-output", default=None)
    parser.add_argument("--max-forward-windows", type=int, default=None)
    parser.add_argument("--max-pending-retries", type=int, default=None)
    parser.add_argument(
        "--stale-after-hours",
        type=float,
        default=None,
        help="Override the realtime reseed threshold (workspace default: 12 hours).",
    )
    parser.add_argument(
        "--target-raw-files",
        type=int,
        default=None,
        help="Override the rolling recovery target (workspace default: 24 half-hour files).",
    )
    args = parser.parse_args()

    workspace = Path(args.workspace).resolve()
    try:
        profile, _ = load_ship_profile(workspace)
        config_path = args.config or profile["dataSource"]["configPath"]
        results: list[dict[str, object]] = []
        if args.action in {"mapping", "all"}:
            results.append(
                fetch_point_mapping(
                    workspace,
                    config_path=config_path,
                    output_path=args.mapping_output,
                    ship_id=args.ship_id,
                )
            )
        if args.action in {"raw", "all"}:
            results.append(
                fetch_sensor_raw_data(
                    workspace,
                    config_path=config_path,
                    output_path=args.raw_output,
                    ship_id=args.ship_id,
                    collect_time_start=args.start,
                    collect_time_end=args.end,
                    device_data_ids=_ids(args.device_data_id),
                    point_data_ids=_ids(args.point_data_id),
                    page_size=args.page_size,
                )
            )
        if args.action == "sync":
            results.append(
                sync_sensor_raw_data(
                    workspace,
                    config_path=config_path,
                    state_path=args.state_output,
                    max_forward_windows=args.max_forward_windows,
                    max_pending_retries=args.max_pending_retries,
                    stale_after_hours=args.stale_after_hours,
                    target_raw_files=args.target_raw_files,
                )
            )
    except (SensorApiError, OSError, ValueError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 2

    print(json.dumps({"ok": True, "results": results}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

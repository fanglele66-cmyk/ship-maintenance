"""Local 2.0 adapter: copy DB -> six-hour pointDataList -> original health skill."""
import argparse
import json
import shutil
import sqlite3
import sys
from contextlib import closing
from datetime import datetime, timedelta
from pathlib import Path

from run_engine_health import run, BEIJING_TZ, WORKSPACE_ROOT
sys.path.insert(0, str(WORKSPACE_ROOT / 'scripts'))
from dataset_paths import dataset_database


def analyze(directory: Path, cutoff: datetime, telemetry=None):
    database = dataset_database(directory, telemetry)
    workspace = directory / 'workspace'
    catalog_dir = workspace / 'data'
    catalog_dir.mkdir(parents=True, exist_ok=True)
    for name in ['ship-profile.json', 'sensor-point-mapping.json', 'local-replay.json']:
        shutil.copyfile(WORKSPACE_ROOT / 'data' / name, catalog_dir / name)
    (workspace / 'wiki_rt-flex50').mkdir(exist_ok=True)
    asset_dir = Path('.claude/skills/ship-engine-health/data')
    (workspace / asset_dir).mkdir(parents=True, exist_ok=True)
    for name in ['main_engine_registry.json', 'changhangbiyu_mapping.json', 'system-profiles.json']:
        shutil.copyfile(WORKSPACE_ROOT / asset_dir / name, workspace / asset_dir / name)
    catalog = json.loads((catalog_dir / 'sensor-point-mapping.json').read_text(encoding='utf-8'))['pointList']
    input_dir = workspace / 'input' / 'sensor-raw-data'
    input_dir.mkdir(parents=True, exist_ok=True)
    # Only this adapter's 12 inputs are replaced. Original ship workspaces are never touched.
    for path in input_dir.glob('sensor-raw-*__raw-data.json'):
        path.unlink()
    start = cutoff - timedelta(hours=6)
    with closing(sqlite3.connect(database.as_uri() + '?mode=ro', uri=True)) as db:
        db.execute('PRAGMA query_only=ON')
        rows = db.execute('SELECT timestamp,data,source_gap_seconds,source_time FROM sensor_readings WHERE timestamp>=? AND timestamp<=? ORDER BY timestamp',
                          (start.isoformat(' '), cutoff.isoformat(' '))).fetchall()
    replay_times = [start, *[datetime.fromisoformat(r[0]) for r in rows], cutoff]
    replay_max_gap = max((b-a).total_seconds() for a,b in zip(replay_times,replay_times[1:]))
    seams = [stamp for stamp, _, gap, _ in rows if gap and gap > 60]
    # Analyze the complete current six-hour window; source provenance stays in internal metadata.
    all_row_count = len(rows)
    previous = start
    max_gap = 0
    decoded = []
    for stamp, data, _, _ in rows:
        at = datetime.fromisoformat(stamp)
        max_gap = max(max_gap, (at - previous).total_seconds())
        previous = at
        decoded.append((at, json.loads(data)))
    max_gap = max(max_gap, (cutoff - previous).total_seconds())
    for i in range(12):
        begin, end = start + timedelta(minutes=30*i), start + timedelta(minutes=30*(i+1))
        points = []
        for at, values in decoded:
            if not (begin <= at < end or i == 11 and at == end):
                continue
            for p in catalog:
                index = int(p['pointCode'][2:]) - 1
                if index < len(values) and values[index] is not None:
                    points.append({'shipId': p['shipId'], 'deviceDataId': p['deviceDataId'],
                                   'pointDataId': p['pointDataId'], 'collectTime': at.isoformat(' '), 'value': str(values[index])})
        if points:
            payload = {'total': len(points), 'pageCount': 1, 'pointDataList': points,
                       '_fetchMetadata': {'source': 'local-sqlite-replay', 'collectTimeStart': begin.isoformat(' '),
                                          'collectTimeEnd': end.isoformat(' '), 'collectTimeTimezone': 'Asia/Shanghai'}}
            filename = input_dir / f'sensor-raw-{begin:%Y%m%d_%H%M%S}__raw-data.json'
            filename.write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
    output = workspace / 'result' / 'engine-health' / 'outputs'
    summary = run(workspace, input_dir, output, 12, cutoff)
    result = json.loads((workspace / summary['result_path']).read_text(encoding='utf-8'))
    return {'result': result, 'units': {p['pointName']: p['unit'] for p in catalog}, 'coverage': {'rows': len(rows), 'maximumGapSeconds': replay_max_gap,
            'replayRows': all_row_count, 'excludedBeforeLastSeamRows': all_row_count-len(rows), 'analysisScope': 'full-requested-window', 'sourceSeams': seams, 'sourceStart': rows[0][3] if rows else None, 'sourceEnd': rows[-1][3] if rows else None,
            'status': 'insufficient' if not rows else 'partial' if max_gap > 300 else 'sufficient',
            'start': start.isoformat(' '), 'end': cutoff.isoformat(' ')}, 'resultPath': summary['result_path']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', required=True)
    parser.add_argument('--telemetry-dir', help='Read-only telemetry directory; outputs remain in --data-dir')
    parser.add_argument('--cutoff', default=datetime.now(BEIJING_TZ).replace(tzinfo=None, microsecond=0).isoformat(' '))
    args = parser.parse_args()
    print(json.dumps(analyze(Path(args.data_dir).resolve(), datetime.fromisoformat(args.cutoff), args.telemetry_dir), ensure_ascii=False))

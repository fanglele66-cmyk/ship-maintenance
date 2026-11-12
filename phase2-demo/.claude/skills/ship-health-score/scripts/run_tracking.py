"""Explicit, unscheduled ship-2.0 adapter; no model calls or event publication."""
import argparse
import csv
import hashlib
import json
import math
import sqlite3
import subprocess
import sys
from collections import defaultdict
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT.parents[2]
sys.path.insert(0, str(APP / 'scripts'))
from dataset_paths import dataset_database
TZ = timezone(timedelta(hours=8))
POLICY = {'minWindows': 30, 'minSpanDays': 7, 'tailWindows': 3,
          'maxTailGapHours': 24, 'maxHealthScore': 80, 'minAbsZ': 2,
          'minBaselineWindows': 30, 'maxPlotPoints': 480}


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def instant(value):
    at = datetime.fromisoformat(str(value))
    return at.replace(tzinfo=TZ) if at.tzinfo is None else at.astimezone(TZ)


def finite(value):
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError):
        return None


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False)+'\n', encoding='utf-8')


def export_windows(directory, output, telemetry=None):
    """Read the entire selected local database only on explicit invocation."""
    database = dataset_database(directory, telemetry)
    keys = [f'DC{i:04}' for i in range(1, 60)]
    fields = ['timestamp', 'time_start', 'time_end', 'source_file', 'n_samples']+keys
    with closing(sqlite3.connect(database.as_uri()+'?mode=ro', uri=True)) as db, output.open('w', encoding='utf-8', newline='') as file:
        db.execute('PRAGMA query_only=ON')
        writer = csv.DictWriter(file, fieldnames=fields); writer.writeheader()
        bucket = None; values = [[] for _ in keys]; times = []

        def flush():
            if not times:
                return
            row = dict(timestamp=times[-1], time_start=times[0], time_end=times[-1],
                       source_file='sqlite-'+bucket.isoformat(), n_samples=len(times))
            for key, readings in zip(keys, values):
                row[key] = sum(readings)/len(readings) if len(readings)/len(times) >= .7 else ''
            writer.writerow(row)

        for stamp, raw in db.execute('SELECT timestamp,data FROM sensor_readings ORDER BY timestamp'):
            at = instant(stamp); window = at.replace(minute=(at.minute//30)*30, second=0, microsecond=0)
            if window != bucket:
                flush(); bucket = window; values = [[] for _ in keys]; times = []
            times.append(at.replace(tzinfo=None).isoformat(' '))
            for i, v in enumerate(json.loads(raw)[:59]):
                number = finite(v)
                if number is not None:
                    values[i].append(number)
        flush()


def select_candidates(result_dir, baseline_path=ROOT/'baselines/health_baseline_median_mad.json'):
    result = read_json(result_dir/'result.json')
    if result.get('schema_version') != 'ship-health-score.result.v1':
        raise ValueError('Unsupported health result schema')
    baseline = read_json(baseline_path)
    catalog = {p['pointCode']: p for p in read_json(APP/'data/sensor-point-mapping.json')['pointList']}
    groups = defaultdict(list)
    fields = ['raw_value', 'baseline_median', 'baseline_scale_mad', 'baseline_n',
              'residual_raw', 'z', 'ewma', 'cusum_7d_area', 'cusum_30d_area', 'health_score', 'rpm']
    with (result_dir/'point_metrics_long.csv').open(encoding='utf-8-sig', newline='') as file:
        for row in csv.DictReader(file):
            key = row['sensor_key']
            if key not in catalog or key == 'DC0001':
                continue
            at = instant(row['timestamp'])
            values = {name: finite(row.get(name)) for name in fields}
            if values['raw_value'] is None:
                for name in fields:
                    if name != 'rpm':
                        values[name] = None
            # Retain invalid rows so a missing/stopped latest window cannot be
            # mistaken for the preceding good sample and trigger an event.
            groups[key].append({'timestamp': int(at.timestamp()*1000), 'at': at.isoformat(),
                                'zone': row.get('rpm_zone'), **values})
    candidates = []; skipped = []
    for key, rows in groups.items():
        rows.sort(key=lambda r: r['timestamp'])
        if len({r['timestamp'] for r in rows}) != len(rows):
            raise ValueError('Duplicate point/window: '+key)
        latest = rows[-1]; zone = latest['zone']
        info = baseline.get(key, {}).get('zones', {}).get(zone)
        def valid(r):
            return (r['zone'] == zone and r['rpm'] is not None and r['rpm'] >= 5 and
                    all(r[k] is not None for k in fields) and r['baseline_scale_mad'] > 0 and
                    r['baseline_n'] >= POLICY['minBaselineWindows'] and info and
                    abs(r['baseline_median']-info['median']) <= .00011 and
                    abs(r['baseline_scale_mad']-info['scale']) <= .00011)
        valid_rows = [r for r in rows if valid(r)]
        tail = rows[-POLICY['tailWindows']:]
        span = (valid_rows[-1]['timestamp']-valid_rows[0]['timestamp'])/86400000 if valid_rows else 0
        reason = None
        if zone in ('stopped', 'unknown') or not info or info.get('n', 0) < POLICY['minBaselineWindows']:
            reason = '无匹配运行工况基线'
        elif len(valid_rows) < POLICY['minWindows'] or span < POLICY['minSpanDays']:
            reason = '有效历史窗口不足'
        elif len(tail) < POLICY['tailWindows'] or not all(valid(r) for r in tail):
            reason = '最近窗口缺测或工况不可比'
        elif any(b['timestamp']-a['timestamp'] > POLICY['maxTailGapHours']*3600000 for a,b in zip(tail, tail[1:])):
            reason = '最近窗口间隔过长'
        elif not all(r['health_score'] < POLICY['maxHealthScore'] and abs(r['z']) >= POLICY['minAbsZ'] for r in tail):
            reason = '未达到持续偏离条件'
        if reason:
            skipped.append({'pointCode': key, 'reason': reason}); continue
        direction = '上移' if all(r['z'] > 0 for r in tail) else '下移' if all(r['z'] < 0 for r in tail) else '波动'
        # Scoring uses every window. Only the UI payload is thinned; endpoints retained.
        indices = sorted({round(i*(len(rows)-1)/(min(len(rows), POLICY['maxPlotPoints'])-1)) for i in range(min(len(rows), POLICY['maxPlotPoints']))})
        candidates.append({'pointCode': key, 'name': catalog[key]['pointName'], 'unit': catalog[key]['unit'],
                           'start': rows[0]['at'], 'end': latest['at'], 'direction': direction,
                           'zone': zone, 'validWindows': len(valid_rows), 'spanDays': round(span, 2),
                           'latest': latest, 'series': [rows[i] for i in indices]})
    return {'schemaVersion': 'ship2.health-tracking.v1', 'schedulerEnabled': False,
            'generatedAt': datetime.now(TZ).isoformat(), 'source': result['source'],
            'baselineSha256': hashlib.sha256(baseline_path.read_bytes()).hexdigest(),
            'resultSha256': hashlib.sha256((result_dir/'result.json').read_bytes()).hexdigest(),
            'health': result['health'], 'policy': POLICY, 'candidates': candidates, 'skipped': skipped}


def main():
    parser = argparse.ArgumentParser(description='Manual-only long-history tracking; does not publish events')
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--result-dir', type=Path, help='Convert an existing score result; no full analysis')
    source.add_argument('--run-all-history', action='store_true', help='Explicitly analyze the entire local database')
    parser.add_argument('--data-dir', type=Path, default=APP/'.local-data')
    parser.add_argument('--telemetry-dir', type=Path, help='Read-only telemetry directory')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(); output = args.output.resolve(); output.mkdir(parents=True, exist_ok=True)
    result_dir = args.result_dir
    if args.run_all_history:
        windows = output/'windows.csv'; export_windows(args.data_dir.resolve(), windows, args.telemetry_dir)
        result_dir = output/'score'
        subprocess.run([sys.executable, str(ROOT/'health_score.py'), '--mode', 'score', '--input', str(windows),
                        '--output', str(result_dir), '--cylinder-detail-target', ''], check=True)
    bundle = select_candidates(result_dir.resolve()); target = output/'tracking-candidates.json'
    write_json(target, bundle)
    print(json.dumps({'file': str(target), 'candidates': len(bundle['candidates']), 'schedulerEnabled': False}))


if __name__ == '__main__':
    main()

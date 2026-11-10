"""2.0 adapter. Each invocation freezes its own input; never publishes legacy events."""
import argparse
import json
import sqlite3
import sys
from contextlib import closing
from datetime import datetime
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
ROOT = SKILL.parents[2]
sys.path.insert(0, str(SKILL))
from engine.loader import load_sensor_raw_data
from engine.detector import detect_all


def run(directory, start, end, output):
    directory, output = Path(directory).resolve(), Path(output).resolve()
    output.relative_to(directory)
    output.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'))
    database = (directory / manifest['database']).resolve()
    if database.parent != directory:
        raise ValueError('Database outside dataset directory')
    catalog = json.loads((ROOT / 'data/sensor-point-mapping.json').read_text(encoding='utf-8'))['pointList']
    with closing(sqlite3.connect(database.as_uri() + '?mode=ro', uri=True)) as db:
        rows = db.execute('SELECT timestamp,data FROM sensor_readings WHERE timestamp>=? AND timestamp<=? ORDER BY timestamp', (start, end)).fetchall()
    points = []
    for stamp, data in rows:
        values = json.loads(data)
        for p in catalog:
            value = values[int(p['pointCode'][2:]) - 1]
            if value is not None:
                points.append({'shipId': p['shipId'], 'deviceDataId': p['deviceDataId'], 'pointDataId': p['pointDataId'], 'collectTime': stamp, 'value': str(value)})
    raw = output / 'sensor-raw-data.json'
    raw.write_text(json.dumps({'pointDataList': points, '_fetchMetadata': {'recordsPath': 'pointDataList', 'collectTimeStart': start, 'collectTimeEnd': end}}, ensure_ascii=False), encoding='utf-8')
    # loader needs the registry/profile relative to the application; outputs stay isolated per invocation.
    if rows:
        samples, refs, metadata = load_sensor_raw_data(ROOT, paths=[raw], lookback_hours=max(6, (datetime.fromisoformat(end)-datetime.fromisoformat(start)).total_seconds()/3600), max_files=None)
        devices = [result.to_dict() for result in detect_all(samples, workspace=str(ROOT))]
    else:
        devices = []
    result = {'start': start, 'end': end, 'rows': len(rows), 'devices': devices, 'source': 'ship-anomaly-detection', 'raw': str(raw.relative_to(ROOT))}
    (output / 'detection.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ['data-dir', 'start', 'end', 'output']:
        parser.add_argument('--'+key, required=True)
    args = parser.parse_args()
    print(json.dumps(run(args.data_dir, args.start, args.end, args.output), ensure_ascii=False))

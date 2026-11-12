"""Copy SQLite safely; remove empty intervals and replay complete frames continuously. Source is read-only."""
import argparse
from array import array
from bisect import bisect_right
import json
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

TZ = timezone(timedelta(hours=8))
ROOT = Path(__file__).resolve().parents[1]
TABLES = {'sensor_readings': 'timestamp', 'ais_track': 'postime', 'weather_data': 'date_time'}


def prepare(source, output, anchor, now=None, cadence=12):
    now = (now or datetime.now(TZ)).replace(microsecond=0)
    anchor = datetime.fromisoformat(anchor).replace(tzinfo=TZ)
    if cadence < 1 or cadence > 60:
        raise ValueError("Playback cadence must be 1..60 seconds")
    output = Path(output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    manifest_path = output / 'manifest.json'
    if manifest_path.exists():
        raise ValueError('Dataset already exists. Use another --output; never re-anchor a running dataset.')
    filename = 'ship-replay.db'
    target = output / filename
    if target.exists():
        raise ValueError('Unfinished copy exists. Choose a new --output or inspect it before removing.')
    source = Path(source).resolve()
    src = sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)
    src.execute('PRAGMA query_only=ON')
    db = sqlite3.connect(target)
    try:
        print('Creating consistent SQLite backup (including committed WAL)...', flush=True)
        src.backup(db, pages=4096)
        src.close()
        spans = {}
        with db:
            for table, column in TABLES.items():
                count, start, end = db.execute(f'SELECT count(*),min({column}),max({column}) FROM {table}').fetchone()
                spans[table] = {'sourceCount': count, 'sourceStart': start, 'sourceEnd': end}
                db.execute(f'ALTER TABLE {table} ADD COLUMN source_time TEXT')
                db.execute(f'UPDATE {table} SET source_time={column}, {column}=? || {column}', ('replay:',))
            # Incomplete frames are not replaced by interpolated sensor values.
            db.execute("DELETE FROM sensor_readings WHERE NOT json_valid(data) OR json_array_length(data)<>59")
            db.execute("DELETE FROM sensor_readings WHERE EXISTS (SELECT 1 FROM json_each(sensor_readings.data) WHERE type NOT IN ('integer','real'))")
            db.execute("CREATE TABLE replay_clock AS SELECT id, row_number() OVER(ORDER BY source_time)-1 AS seq, CAST(strftime('%s',source_time) AS INTEGER) AS source_epoch, CAST(strftime('%s',source_time) AS INTEGER)-lag(CAST(strftime('%s',source_time) AS INTEGER)) OVER(ORDER BY source_time) AS source_gap_seconds FROM sensor_readings")
            db.execute('CREATE UNIQUE INDEX replay_clock_id ON replay_clock(id)')
            db.execute('CREATE UNIQUE INDEX replay_clock_seq ON replay_clock(seq)')
            if db.execute('SELECT count(*) FROM replay_clock WHERE source_epoch IS NULL OR source_gap_seconds<=0').fetchone()[0]:
                raise ValueError('Expected one strictly ordered ship/device stream; duplicate or invalid source timestamps found')
            anchor_seq = db.execute('SELECT max(seq) FROM replay_clock WHERE source_epoch<=?', (int(anchor.timestamp())+8*3600,)).fetchone()[0]
            count = db.execute('SELECT count(*) FROM replay_clock').fetchone()[0]
            if anchor_seq is None or anchor_seq*cadence < 86400 or anchor_seq>=count-1:
                raise ValueError('Choose an anchor with at least 24h of playback history and future samples')
            base_epoch = int(now.timestamp())+8*3600-anchor_seq*cadence
            db.execute('ALTER TABLE sensor_readings ADD COLUMN source_gap_seconds INTEGER')
            db.execute("UPDATE sensor_readings SET timestamp=datetime(?+(SELECT seq FROM replay_clock WHERE id=sensor_readings.id)*?, 'unixepoch'),source_gap_seconds=(SELECT source_gap_seconds FROM replay_clock WHERE id=sensor_readings.id)", (base_epoch,cadence))
            epochs = array('q', (r[0] for r in db.execute('SELECT source_epoch FROM replay_clock ORDER BY seq')))
            removed_gap_count = db.execute('SELECT count(*) FROM replay_clock WHERE source_gap_seconds>60').fetchone()[0]
            for table,column in [('ais_track','postime'),('weather_data','date_time')]:
                updates, discarded = [], []
                for row_id, epoch in db.execute(f"SELECT id,CAST(strftime('%s',source_time) AS INTEGER) FROM {table}").fetchall():
                    i = bisect_right(epochs,epoch)-1
                    if i<0 or i>=len(epochs)-1 or epochs[i+1]-epochs[i]>60 and epoch!=epochs[i]:
                        discarded.append((row_id,));continue
                    fraction=(epoch-epochs[i])/(epochs[i+1]-epochs[i])
                    stamp=datetime.fromtimestamp(base_epoch+(i+fraction)*cadence, timezone.utc).strftime('%Y-%m-%d %H:%M:%S.%f')
                    updates.append((stamp,row_id))
                db.executemany(f'UPDATE {table} SET {column}=? WHERE id=?',updates)
                db.executemany(f'DELETE FROM {table} WHERE id=?',discarded)
            for table,column in TABLES.items():
                count,start,end=db.execute(f'SELECT count(*),min({column}),max({column}) FROM {table}').fetchone()
                spans[table].update(count=count,start=start,end=end)
                print(f'{table}: {count} records, {start} to {end}',flush=True)
        if db.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
            raise ValueError('SQLite integrity check failed')
        manifest = {'version': 2, 'database': filename, 'source': str(source), 'timezone': 'Asia/Shanghai',
                    'sourceAnchor': anchor.isoformat(), 'playbackAnchor': now.isoformat(), 'cadenceSeconds': cadence,
                    'anchorSequence': anchor_seq, 'createdAt': now.isoformat(), 'tables': spans,
                    'removedGapCount': removed_gap_count, 'seamThresholdSeconds': 60,
                    'mode': 'historical-copy-replay', 'clockPolicy': 'continuous-sample-sequence-no-loop'}
        temporary = manifest_path.with_suffix('.tmp')
        temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
        temporary.replace(manifest_path)
        return manifest
    finally:
        src.close()
        db.close()


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', required=True)
    p.add_argument('--source-anchor', default='2026-07-04 12:00:00', help='Historical instant aligned to the current clock; retain >=24h before this instant.')
    p.add_argument('--cadence-seconds', type=int, default=12)
    p.add_argument('--output', default=str(ROOT / 'deployment-data/telemetry'))
    args = p.parse_args()
    prepare(args.source, args.output, args.source_anchor, cadence=args.cadence_seconds)

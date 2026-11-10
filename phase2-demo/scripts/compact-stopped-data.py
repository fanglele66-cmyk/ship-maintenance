"""Cap stopped runs in the local copy, preserving samples and a shared continuous clock."""
import argparse
from array import array
from bisect import bisect_left, bisect_right
from contextlib import closing
from datetime import datetime, timedelta, timezone
import json
import math
from pathlib import Path
import sqlite3

TZ = timezone(timedelta(hours=8))
TABLES = {'sensor_readings': 'timestamp', 'ais_track': 'postime', 'weather_data': 'date_time'}


def retained_sequences(rpms, limit):
    """Keep both edges of each stopped run; no sensor value is interpolated."""
    kept, runs = array('q'), []
    start = None
    def flush(end):
        count = end - start
        if count > limit:
            left = limit // 2
            kept.extend(range(start, start + left))
            kept.extend(range(end - (limit - left), end))
            runs.append({'startSequence': start, 'endSequence': end - 1, 'removedRows': count - limit})
        else:
            kept.extend(range(start, end))
    count = 0
    for i, rpm in enumerate(rpms):
        count = i + 1
        if rpm is not None and 0 <= rpm <= 5:
            if start is None:
                start = i
        else:
            if start is not None:
                flush(i)
                start = None
            kept.append(i)
    if start is not None:
        flush(count)
    return kept, runs


def compact(directory, now=None, max_hours=24):
    directory = Path(directory).resolve()
    manifest_path = directory / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf8'))
    if manifest.get('stopCompaction', {}).get('maximumHours') == max_hours:
        return manifest['stopCompaction']
    source = (directory / manifest['database']).resolve()
    if source.parent != directory:
        raise ValueError('Local dataset must stay inside its directory')
    target = directory / 'ship-continuous-24h.db'
    if target.exists():
        raise ValueError('Output exists; inspect it before retrying. Current database was not changed.')
    now = (now or datetime.now(TZ)).replace(microsecond=0)
    cadence = int(manifest['cadenceSeconds'])
    limit = int(max_hours * 3600 // cadence)
    if limit < 2:
        raise ValueError('Stopped duration must cover at least two samples')
    print('Reading stopped runs from the local copy...', flush=True)
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as src:
        src.execute('PRAGMA query_only=ON')
        kept, runs = retained_sequences((r[0] for r in src.execute("SELECT json_extract(data,'$[0]') FROM sensor_readings ORDER BY timestamp")), limit)
        old_start = src.execute('SELECT min(timestamp) FROM sensor_readings').fetchone()[0]
        old_base = datetime.fromisoformat(old_start).replace(tzinfo=TZ).timestamp()
        old_anchor = math.floor((now.timestamp() - old_base) / cadence)
        # If the present sample is trimmed, resume at the first retained sample after it.
        anchor = bisect_left(kept, old_anchor)
        if anchor < 86400 / cadence or anchor >= len(kept) - 1:
            raise ValueError('Current time must have at least 24 hours of history and future coverage')
        base = now.timestamp() - anchor * cadence
        print(f'Compacting {len(runs)} runs, removing {sum(r["removedRows"] for r in runs)} stopped frames...', flush=True)
        with closing(sqlite3.connect(target)) as db:
            src.backup(db, pages=4096)
            db.execute('PRAGMA journal_mode=OFF')
            with db:
                db.execute('CREATE TEMP TABLE retained(old_seq INTEGER PRIMARY KEY,new_seq INTEGER UNIQUE)')
                db.executemany('INSERT INTO retained VALUES(?,?)', ((int(old), new) for new, old in enumerate(kept)))
                db.execute('DELETE FROM sensor_readings WHERE id IN (SELECT id FROM replay_clock WHERE seq NOT IN (SELECT old_seq FROM retained))')
                db.execute('DELETE FROM replay_clock WHERE seq NOT IN (SELECT old_seq FROM retained)')
                # Avoid collisions with UNIQUE seq/timestamp during bulk retiming.
                db.execute('UPDATE replay_clock SET seq=-seq-1')
                db.execute('UPDATE replay_clock SET seq=(SELECT new_seq FROM retained WHERE old_seq=-replay_clock.seq-1)')
                db.execute("UPDATE sensor_readings SET timestamp='compact:'||timestamp")
                db.execute("UPDATE sensor_readings SET timestamp=datetime(?+(SELECT seq FROM replay_clock WHERE id=sensor_readings.id)*?,'unixepoch')", (int(base) + 8*3600, cadence))
                ancillary = {}
                for table, column in list(TABLES.items())[1:]:
                    updates, removed = [], []
                    for row_id, stamp in db.execute(f'SELECT id,{column} FROM {table}').fetchall():
                        position = (datetime.fromisoformat(stamp).replace(tzinfo=TZ).timestamp() - old_base) / cadence
                        index = bisect_right(kept, position) - 1
                        exact = index >= 0 and abs(position - kept[index]) < 1e-5
                        if index < 0 or not exact and (index + 1 >= len(kept) or kept[index+1] != kept[index]+1):
                            removed.append((row_id,))
                            continue
                        value = datetime.fromtimestamp(base + (index + position - kept[index]) * cadence, TZ).strftime('%Y-%m-%d %H:%M:%S.%f')
                        updates.append((value, row_id))
                    db.execute(f"UPDATE {table} SET {column}='compact:'||{column}")
                    db.executemany(f'DELETE FROM {table} WHERE id=?', removed)
                    db.executemany(f'UPDATE {table} SET {column}=? WHERE id=?', updates)
                    ancillary[table] = len(removed)
                for table, column in TABLES.items():
                    count, first, last = db.execute(f'SELECT count(*),min({column}),max({column}) FROM {table}').fetchone()
                    manifest['tables'][table].update(count=count, start=first, end=last)
            # Verify the whole retained stream, including every stopped run and seam.
            previous, run, longest, gaps = None, 0, 0, 0
            for stamp, rpm in db.execute("SELECT timestamp,json_extract(data,'$[0]') FROM sensor_readings ORDER BY timestamp"):
                current = datetime.fromisoformat(stamp)
                if previous and (current - previous).total_seconds() != cadence:
                    gaps += 1
                previous = current
                run = run + 1 if rpm is not None and 0 <= rpm <= 5 else 0
                longest = max(longest, run)
            if gaps or longest > limit or db.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
                raise ValueError('Compacted database failed validation; active manifest remains unchanged')
            print('Validation passed; reclaiming unused pages...', flush=True)
            db.execute('VACUUM')
    receipt = {'maximumHours': max_hours, 'rpmThreshold': 5, 'policy': 'retain-first-and-last-half', 'runsCompacted': len(runs),
               'removedSensorRows': sum(r['removedRows'] for r in runs), 'removedAncillaryRows': ancillary,
               'maximumStoppedSeconds': longest * cadence, 'nonCadenceIntervals': gaps, 'runs': runs,
               'previousDatabase': source.name, 'previousAnchorSequence': old_anchor, 'selectedOldSequence': int(kept[anchor]), 'completedAt': now.isoformat()}
    (directory / 'manifest-before-stop-compaction.json').write_text(manifest_path.read_text(encoding='utf8'), encoding='utf8')
    manifest.update(version=3, database=target.name, playbackAnchor=now.isoformat(), anchorSequence=anchor, stopCompaction=receipt)
    tmp = manifest_path.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf8')
    tmp.replace(manifest_path)
    (directory / 'stop-compaction-receipt.json').write_text(json.dumps(receipt, indent=2), encoding='utf8')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', type=Path, default=Path(__file__).resolve().parents[1] / '.local-data')
    args = parser.parse_args()
    result = compact(args.data_dir)
    print(json.dumps({k: v for k, v in result.items() if k != 'runs'}, ensure_ascii=False, indent=2))

import hashlib
import importlib.util
import json
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('compact', Path(__file__).resolve().parents[1] / 'scripts/compact-stopped-data.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StopCompactionTest(unittest.TestCase):
    def test_boundaries_and_missing_rpm(self):
        kept, runs = module.retained_sequences([0]*9 + [10, None, -1] + [0]*4, 4)
        self.assertEqual(list(kept), [0, 1, 7, 8, 9, 10, 11, 12, 13, 14, 15])
        self.assertEqual(runs[0]['removedRows'], 5)

    def test_full_database_values_cadence_shared_clock_and_original_unchanged(self):
        with tempfile.TemporaryDirectory() as name:
            directory = Path(name)
            original = directory / 'copy.db'
            start = datetime(2026, 11, 1)
            count = 18000
            stamps = [(start + timedelta(seconds=i*12)).isoformat(' ') for i in range(count)]
            with closing(sqlite3.connect(original)) as db:
                db.executescript('CREATE TABLE sensor_readings(id INTEGER PRIMARY KEY,timestamp TEXT UNIQUE,data TEXT,source_time TEXT); CREATE TABLE replay_clock(id INTEGER PRIMARY KEY,seq INTEGER UNIQUE); CREATE TABLE ais_track(id INTEGER PRIMARY KEY,postime TEXT UNIQUE); CREATE TABLE weather_data(id INTEGER PRIMARY KEY,date_time TEXT UNIQUE);')
                db.executemany('INSERT INTO sensor_readings VALUES(?,?,?,?)', ((i, stamps[i], json.dumps([0 if 4000 <= i < 14000 else 90, i]), stamps[i]) for i in range(count)))
                db.executemany('INSERT INTO replay_clock VALUES(?,?)', ((i, i) for i in range(count)))
                for table, column in [('ais_track','postime'), ('weather_data','date_time')]:
                    db.executemany(f'INSERT INTO {table} VALUES(?,?)', [(1, stamps[15000]), (2, stamps[9000])])
                db.commit()
            before = hashlib.sha256(original.read_bytes()).hexdigest()
            manifest = {'database': 'copy.db', 'cadenceSeconds': 12, 'tables': {table: {} for table in module.TABLES}}
            (directory / 'manifest.json').write_text(json.dumps(manifest), encoding='utf8')
            now = (start + timedelta(seconds=15000*12)).replace(tzinfo=module.TZ)
            result = module.compact(directory, now=now)
            self.assertEqual(result['removedSensorRows'], 2800)
            self.assertEqual(result['maximumStoppedSeconds'], 86400)
            self.assertEqual(result['nonCadenceIntervals'], 0)
            self.assertEqual(before, hashlib.sha256(original.read_bytes()).hexdigest())
            with closing(sqlite3.connect(directory / 'ship-continuous-24h.db')) as db:
                self.assertEqual(db.execute('SELECT count(*) FROM sensor_readings').fetchone()[0], 15200)
                stamp, data, source = db.execute('SELECT timestamp,data,source_time FROM sensor_readings WHERE id=15000').fetchone()
                self.assertEqual(stamp, now.replace(tzinfo=None).isoformat(' '))
                self.assertEqual(json.loads(data), [90, 15000]);self.assertEqual(source, stamps[15000])
                self.assertEqual(db.execute('SELECT postime FROM ais_track').fetchall(), [(stamp+'.000000',)])
                self.assertEqual(db.execute('SELECT date_time FROM weather_data').fetchall(), [(stamp+'.000000',)])
            self.assertEqual(module.compact(directory, now=now), result)


if __name__ == '__main__':
    unittest.main()

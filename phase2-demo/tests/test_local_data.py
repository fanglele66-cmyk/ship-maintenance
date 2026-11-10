import hashlib
import importlib.util
import json
import sqlite3
from contextlib import closing
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

spec = importlib.util.spec_from_file_location('prepare', Path(__file__).resolve().parents[1] / 'scripts/prepare-local-data.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ContinuousCopyTest(unittest.TestCase):
    def test_gap_removed_values_preserved_source_untouched_and_shared_clock(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            source = directory / 'source.db'
            start = datetime(2026, 7, 1)
            with closing(sqlite3.connect(source)) as c:
                c.executescript('CREATE TABLE sensor_readings(id INTEGER PRIMARY KEY,timestamp TEXT UNIQUE,data TEXT);CREATE TABLE ais_track(id INTEGER PRIMARY KEY,postime TEXT UNIQUE);CREATE TABLE weather_data(id INTEGER PRIMARY KEY,date_time TEXT UNIQUE);')
                rows = [(i, (start + timedelta(seconds=i*12+(3600 if i>=4000 else 0))).isoformat(' '), json.dumps([i]*59)) for i in range(8000)]
                c.executemany('INSERT INTO sensor_readings VALUES (?,?,?)', rows)
                c.execute('INSERT INTO ais_track VALUES (1,?)', (rows[7300][1],))
                c.execute('INSERT INTO weather_data VALUES (1,?)', (rows[7300][1],))
                c.commit()
            before = hashlib.sha256(source.read_bytes()).hexdigest()
            now = datetime(2026,11,10,12,tzinfo=timezone(timedelta(hours=8)))
            result = module.prepare(source,directory/'copy',rows[7200][1],now=now)
            self.assertEqual(result['removedGapCount'],1)
            self.assertEqual(before,hashlib.sha256(source.read_bytes()).hexdigest())
            with closing(sqlite3.connect(directory/'copy/ship-replay.db')) as c:
                values=c.execute("WITH t AS (SELECT strftime('%s',timestamp)-lag(strftime('%s',timestamp)) OVER(ORDER BY timestamp) d FROM sensor_readings) SELECT min(d),max(d) FROM t").fetchone()
                self.assertEqual(values,(12,12))
                record=c.execute('SELECT timestamp,source_time,data,source_gap_seconds FROM sensor_readings WHERE id=4000').fetchone()
                self.assertEqual(record[1],rows[4000][1]);self.assertEqual(record[2],rows[4000][2]);self.assertEqual(record[3],3612)
                self.assertEqual(c.execute('SELECT timestamp FROM sensor_readings WHERE id=7200').fetchone()[0],'2026-11-10 12:00:00')
                self.assertEqual(c.execute('SELECT postime FROM ais_track').fetchone()[0][:19],c.execute('SELECT timestamp FROM sensor_readings WHERE id=7300').fetchone()[0])
                self.assertEqual(c.execute('SELECT date_time FROM weather_data').fetchone()[0],c.execute('SELECT postime FROM ais_track').fetchone()[0])
            with self.assertRaises(ValueError):module.prepare(source,directory/'copy',rows[7200][1],now=now)


if __name__=='__main__':unittest.main()

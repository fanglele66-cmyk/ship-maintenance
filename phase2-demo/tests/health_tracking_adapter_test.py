import csv
import hashlib
import importlib.util
import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]/'.claude/skills/ship-health-score'
spec = importlib.util.spec_from_file_location('tracking_adapter', SKILL/'scripts/run_tracking.py')
adapter = importlib.util.module_from_spec(spec); spec.loader.exec_module(adapter)


class TrackingAdapterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='health-score-small-')
        cls.root = Path(cls.temp.name)
        cls.baseline_path = SKILL/'baselines/health_baseline_median_mad.json'
        cls.baseline_hash = hashlib.sha256(cls.baseline_path.read_bytes()).hexdigest()
        cls.baseline = json.loads(cls.baseline_path.read_text(encoding='utf-8'))
        rows = []
        for i in range(60):
            at = datetime(2026,5,1)+timedelta(hours=i*6)
            row = dict(timestamp=str(at),time_start=str(at-timedelta(minutes=29)),time_end=str(at),source_file=f'test-{i}',n_samples=150)
            for n in range(1,60):
                key = f'DC{n:04}'; b = cls.baseline.get(key,{})
                row[key] = 100 if n == 1 else b.get('zones',{}).get('cruise',b.get('global',{})).get('median',0)
            if i >= 50:
                row['DC0008'] += ((i-49)**2)*cls.baseline['DC0008']['zones']['cruise']['scale']
            rows.append(row)
        with (cls.root/'windows.csv').open('w',encoding='utf-8',newline='') as file:
            writer=csv.DictWriter(file,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
        subprocess.run([sys.executable,str(SKILL/'health_score.py'),'--mode','score','--input',str(cls.root/'windows.csv'),'--output',str(cls.root/'score'),'--cylinder-detail-target',''],check=True,capture_output=True)
        with (cls.root/'score/point_metrics_long.csv').open(encoding='utf-8') as file:
            cls.metrics = list(csv.DictReader(file))

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def setUp(self):
        self.write_metrics(self.metrics)

    def write_metrics(self, rows):
        with (self.root/'score/point_metrics_long.csv').open('w',encoding='utf-8',newline='') as file:
            w=csv.DictWriter(file,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)

    def test_small_real_scorer_pipeline_preserves_fixed_baseline(self):
        result=adapter.select_candidates(self.root/'score')
        self.assertEqual([c['pointCode'] for c in result['candidates']],['DC0008'])
        self.assertFalse(result['schedulerEnabled'])
        last = [row for row in self.metrics if row['sensor_key']=='DC0008'][-1]
        self.assertEqual(result['candidates'][0]['latest']['raw_value'],float(last['raw_value']))
        self.assertEqual(result['candidates'][0]['latest']['z'],float(last['z']))
        self.assertEqual(hashlib.sha256(self.baseline_path.read_bytes()).hexdigest(),self.baseline_hash)

    def test_missing_stopped_short_history_or_wrong_baseline_does_not_create_tracking(self):
        for change in ['missing','stopped','short','baseline']:
            rows=[dict(r) for r in self.metrics]
            target=[r for r in rows if r['sensor_key']=='DC0008']
            if change=='missing': target[-1]['raw_value']=''
            if change=='stopped': target[-1]['rpm_zone']='stopped';target[-1]['rpm']='0'
            if change=='short': rows=[r for r in rows if r['sensor_key']!='DC0008' or r in target[-3:]]
            if change=='baseline':
                for r in target:r['baseline_median']='1'
            self.write_metrics(rows)
            self.assertEqual(adapter.select_candidates(self.root/'score')['candidates'],[],change)

    def test_database_aggregation_is_read_only_and_retains_missing_values(self):
        with tempfile.TemporaryDirectory(prefix='tracking-db-') as name:
            directory=Path(name);(directory/'manifest.json').write_text('{"database":"ship.db"}',encoding='utf-8')
            db=sqlite3.connect(directory/'ship.db');db.execute('CREATE TABLE sensor_readings(timestamp TEXT,data TEXT)')
            for stamp,values in [('2026-05-01 00:00:00',[100,5]),('2026-05-01 00:12:00',[102,None]),('2026-05-01 00:30:00',[0,0])]:db.execute('INSERT INTO sensor_readings VALUES(?,?)',(stamp,json.dumps(values)))
            db.commit();db.close();before=hashlib.sha256((directory/'ship.db').read_bytes()).hexdigest()
            adapter.export_windows(directory,directory/'windows.csv')
            with (directory/'windows.csv').open(encoding='utf-8') as file: rows=list(csv.DictReader(file))
            self.assertEqual(len(rows),2);self.assertEqual(float(rows[0]['DC0001']),101);self.assertEqual(rows[0]['DC0002'],'');self.assertEqual(float(rows[1]['DC0001']),0)
            self.assertEqual(hashlib.sha256((directory/'ship.db').read_bytes()).hexdigest(),before)


if __name__=='__main__':unittest.main()

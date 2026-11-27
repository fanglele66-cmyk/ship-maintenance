"""Exercise the reserve skill with synthetic MCP envelopes and isolated ship telemetry."""
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / '.claude/skills-MCP/ship-mcp-anomaly-analysis/scripts'
sys.path.insert(0, str(SCRIPTS))
from mcp_verify import DEVICE, FEATURE_ORDER, MODEL, SHIP


class MCPReplay(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.directory = Path(tmp.name)
        self.request = dict(shipId=SHIP, deviceId=DEVICE, taskId='fixture-task', serNo='case1',
                            dataSource='ch', startTime='2026-04-30 16:00:00', endTime='2026-04-30 16:02:00',
                            publishToWorkspace=False)
        self.time = '2026-04-30 16:01:00'
        self.query = {k: self.request[k] for k in ('shipId','deviceId','startTime','endTime')}
        self.window = {'timestamps':[self.time],'values':{code:[12] for code in FEATURE_ORDER}}
        self.index = FEATURE_ORDER.index('DC0044')
        dims = [0.1]*len(FEATURE_ORDER)
        dims[self.index] = 5
        self.model = {'model_name':MODEL,'status':'done','recommended_thresholds':{'total_threshold':2,'per_dimension_thresholds':[1]*len(dims)},
                      'results':{'total_scores':[4],'per_dimension_scores':[dims],'recommended_threshold_results':{'cls_results':[1],'anomaly_count':1}}}
        self.response = {'runId':'ai-run-case1-20260430_160200','status':'done','resultPayload':self.model,'totalRows':1,'anomalyRows':1,
                         'anomalyThreshold':2,'anomalyRowDetails':[{'rowIndex':0,'sampleTime':self.time,'totalScore':4,'maxScore':5,
                         'overThresholdPoints':[f'DC{self.index+1:04d}']}]}
        self.write('manifest.json',{'database':'fixture.db'})
        with closing(sqlite3.connect(self.directory/'fixture.db')) as db, db:
            db.executescript('CREATE TABLE sensor_readings(timestamp TEXT,source_time TEXT,source_gap_seconds INTEGER,data TEXT); CREATE TABLE ais_track(postime TEXT,sog REAL,lat REAL,lon REAL)')
            points = [None]*59
            points[43] = 0.21  # DC0044 is recorded in MPa in the ship database.
            db.execute('INSERT INTO sensor_readings(timestamp,data) VALUES(?,?)',(self.time,json.dumps(points)))

    def write(self,name,data):
        (self.directory/name).write_text(json.dumps(data),encoding='utf-8')

    def verify(self):
        self.write('request.json', self.request)
        self.write('response.json', {'structuredContent':self.response})
        self.write('query.json', self.query)
        self.write('window.json', self.window)
        return subprocess.run([sys.executable,str(SCRIPTS/'mcp_verify.py'),'--request','request.json','--response','response.json',
                               '--window','window.json','--window-request','query.json','--output','verified.json'],
                              cwd=self.directory,capture_output=True)

    def evidence(self):
        env={**os.environ, 'SHIP_TELEMETRY_DIR':str(self.directory)}
        output=subprocess.check_output(['node',str(SCRIPTS/'read-local-evidence.mjs'),'--verified','verified.json','--data-dir','.'],
                                       cwd=self.directory, env=env)
        return json.loads(output)['evidence'][0]

    def test_mapped_column_uses_same_device_timed_raw_measurement(self):
        result=self.verify()
        self.assertEqual(result.returncode,0,result.stderr)
        verified=json.loads((self.directory/'verified.json').read_text(encoding='utf-8'))
        self.assertEqual(verified['rows'][0]['overThresholdPoints'],['DC0044'])
        sensors=self.evidence()['sensors']
        pressure=next(s for s in sensors if s['pointCode']=='DC0044')
        self.assertEqual(pressure['unit'],'bar')
        self.assertAlmostEqual(pressure['mean'],2.1)
        self.assertFalse(next(s for s in sensors if s['pointCode']=='DC0001')['covered'])
        self.assertFalse((self.directory/'workflow.sqlite').exists())

    def test_mismatched_axis_device_and_provider_error_reject(self):
        self.query['deviceId']='different-device'
        self.assertNotEqual(self.verify().returncode,0)
        self.query['deviceId']=DEVICE
        self.response['status']='failed'
        self.assertNotEqual(self.verify().returncode,0)
        self.assertFalse((self.directory/'verified.json').exists())

    def test_explicit_conflicting_echoes_block_each_artifact_but_allow_inference_task_id(self):
        for obj,field,bad in [(self.response,'startTime','2026-04-30 15:59:00'),
                              (self.response,'endTime','2026-04-30 16:03:00'),
                              (self.window,'deviceId','wrong-device'),(self.window,'shipId','wrong-ship'),
                              (self.model,'workspaceTaskId','another-workspace')]:
            with self.subTest(field=field):
                obj[field]=bad
                self.assertNotEqual(self.verify().returncode,0)
                del obj[field]
        self.response.update(taskId='inf-123',startTime='2026-04-30T08:00:00Z',workspaceTaskId=self.request['taskId'])
        self.window.update(shipId=SHIP,deviceId=DEVICE)
        self.assertEqual(self.verify().returncode,0)
        self.assertEqual(json.loads((self.directory/'verified.json').read_text())['inferenceTaskId'],'inf-123')

    def test_zero_flags_checks_actual_coverage(self):
        self.response.update(anomalyRows=0,anomalyRowDetails=[])
        self.model['results'].update(total_scores=[0.1],per_dimension_scores=[[0.1]*len(FEATURE_ORDER)],
                                     recommended_threshold_results={'cls_results':[0],'anomaly_count':0})
        self.assertEqual(self.verify().returncode,0)
        evidence=self.evidence()
        self.assertEqual(evidence['rowIndices'],[])
        self.assertEqual(len(evidence['sensors']),52)
        self.assertTrue(any(s['sampleCount']==0 for s in evidence['sensors']))


if __name__=='__main__':
    unittest.main()

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'.claude/skills/ship-anomaly-detection'))
from engine.loader import load_sensor_raw_data, SensorDataError


class ExternalRuntimeTests(unittest.TestCase):
    def test_explicit_runtime_root_preserves_input_boundary_and_profile_source(self):
        catalog=json.loads((ROOT/'data/sensor-point-mapping.json').read_text(encoding='utf-8'))['pointList']
        points=[{'shipId':p['shipId'],'deviceDataId':p['deviceDataId'],'pointDataId':p['pointDataId'],'collectTime':'2026-11-12 16:00:00','value':'0'} for p in catalog]
        with tempfile.TemporaryDirectory(prefix='ship-external-input-') as directory:
            runtime=Path(directory);raw=runtime/'sensor-raw.json'
            raw.write_text(json.dumps({'pointDataList':points,'_fetchMetadata':{'recordsPath':'pointDataList'}}),encoding='utf-8')
            with self.assertRaises(SensorDataError):load_sensor_raw_data(ROOT,paths=[raw])
            samples,refs,metadata=load_sensor_raw_data(ROOT,paths=[raw],input_root=runtime)
            self.assertTrue(samples);self.assertEqual(refs,['sensor-raw.json'])
            self.assertEqual(metadata['ship_id'],catalog[0]['shipId'])
            with self.assertRaises(SensorDataError):load_sensor_raw_data(ROOT,paths=[raw],input_root=runtime/'other')


if __name__=='__main__':unittest.main()

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from dataset_paths import dataset_directory, dataset_database


class DatasetPathsTests(unittest.TestCase):
    def test_independent_legacy_and_explicit_directories(self):
        with tempfile.TemporaryDirectory(prefix='ship-dataset-paths-') as name, patch.dict(os.environ, {}, clear=True):
            root=Path(name);runtime=root/'.local-data';prepared=root/'deployment-data/telemetry'
            runtime.mkdir();prepared.mkdir(parents=True)
            self.assertEqual(dataset_directory(runtime, root=root), prepared)
            (runtime/'manifest.json').write_text('{}')
            self.assertEqual(dataset_directory(runtime, root=root), runtime)
            (prepared/'manifest.json').write_text('{"database":"ship.db"}')
            self.assertEqual(dataset_directory(runtime, root=root), prepared)
            self.assertEqual(dataset_database(runtime, prepared), prepared/'ship.db')
            external=root/'external'
            with patch.dict(os.environ, {'SHIP_TELEMETRY_DIR':str(external)}):
                self.assertEqual(dataset_directory(runtime, root=root), external)
                self.assertEqual(dataset_directory(runtime, prepared, root=root), prepared)
            (prepared/'manifest.json').write_text(json.dumps({'database':'../outside.db'}))
            with self.assertRaises(ValueError):dataset_database(runtime, prepared)


if __name__=='__main__':unittest.main()

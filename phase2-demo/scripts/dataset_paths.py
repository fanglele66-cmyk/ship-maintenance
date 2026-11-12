"""Keep read-only telemetry separate from mutable runtime state."""
import json
import os
from pathlib import Path

APP = Path(__file__).resolve().parents[1]


def dataset_directory(runtime, telemetry=None, root=APP):
    explicit = telemetry or os.environ.get('SHIP_TELEMETRY_DIR')
    if explicit:
        return Path(explicit).resolve()
    root, runtime = Path(root).resolve(), Path(runtime).resolve()
    default_runtime = Path(os.environ.get('SHIP_DATA_DIR') or root/'.local-data').resolve()
    prepared = root/'deployment-data/telemetry'
    if runtime != default_runtime and (runtime/'manifest.json').is_file():
        return runtime
    if (prepared/'manifest.json').is_file():
        return prepared
    if (runtime/'manifest.json').is_file():
        return runtime
    return prepared


def dataset_database(runtime, telemetry=None):
    directory = dataset_directory(runtime, telemetry)
    manifest = json.loads((directory/'manifest.json').read_text(encoding='utf-8'))
    database = (directory/manifest['database']).resolve()
    if database.parent != directory:
        raise ValueError('Database must stay inside the telemetry directory')
    return database

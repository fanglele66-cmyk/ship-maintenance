import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('health_units', Path(__file__).resolve().parents[1] / 'scripts/run_engine_health.py')
health = importlib.util.module_from_spec(spec)
spec.loader.exec_module(health)


def test_local_database_pressure_uses_catalog_unit_without_rescaling_values():
    points = [{'name': name, 'value': value, 'unit': 'MPa'} for name, value in [
        ('起动空气压力', 2.01), ('燃油进机压力', .89), ('滑油进主轴承压力', .02)]]
    text = '\n'.join(health._main_engine_environment_lines('主机', [{'points': points}]))
    assert '2.01 MPa' in text
    assert '0.89 MPa' in text
    assert '0.02 MPa' in text
    assert 'bar' not in text


def test_missing_unit_is_not_silently_inferred_as_bar():
    assert health._latest_unit_for_device([{'points': [{'name': '起动空气压力', 'value': 2.01}]}], ('起动空气压力',)) == '（单位未提供）'

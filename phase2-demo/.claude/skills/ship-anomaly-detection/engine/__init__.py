"""Configurable ship equipment anomaly detection runtime."""

from .detector import detect_all
from .loader import load_sensor_raw_data

__all__ = ["detect_all", "load_sensor_raw_data"]

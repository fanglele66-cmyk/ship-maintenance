"""Retired deterministic analysis entry point.

Event analysis must be authored by the host model from prepared event evidence
and the ship knowledge base, then validated by agent_content.py.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from .types import DetectionEvent


def build_analysis_content(
    event: DetectionEvent,
    *,
    workspace: Path | None,
    system_type: str | None,
    anomaly_type: str,
    event_start: str,
    event_end: str,
    point_refs: list[str],
) -> dict[str, Any]:
    raise ValueError(
        "Deterministic analysis generation is disabled; prepare event evidence, "
        "read the relevant knowledge sources and submit a model-authored candidate"
    )

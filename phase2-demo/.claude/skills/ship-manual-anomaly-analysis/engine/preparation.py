"""Prepare frozen evidence for the host Agent, then publish its validated content."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from jsonschema import Draft202012Validator

from .bridge import anomaly_module
from .contracts import ManualContractError

SKILL_DIR = Path(__file__).resolve().parents[1]


def _validate(payload: dict[str, Any]) -> None:
    schema = json.loads((SKILL_DIR / "template/analysis-preparation.schema.json").read_text(encoding="utf-8"))
    errors = list(Draft202012Validator(schema).iter_errors(payload))
    if errors:
        raise ManualContractError("manual preparation: " + "; ".join(error.message for error in errors[:5]))


def _source_signatures(root: Path, profile: dict[str, Any]) -> dict[str, str]:
    refs = [
        "data/ship-profile.json", profile["dataSource"]["configPath"],
        profile["dataSource"]["pointMappingPath"],
        ".claude/skills/ship-manual-anomaly-analysis/data/system-profiles.json",
    ]
    return {ref: hashlib.sha256((root / ref).read_bytes()).hexdigest() for ref in refs}


def write_preparation(
    root: Path, report: dict[str, Any], event: Any, evidence: dict[str, Any],
    profile: dict[str, Any], api_config: dict[str, Any], *, event_id: str,
    now: datetime, anomaly_type: str, guard: dict[str, Any],
) -> dict[str, Any]:
    workspace = anomaly_module("workspace")
    knowledge = anomaly_module("ship_profile").knowledge_package(root)
    token = uuid4().hex[:12]
    preparation_ref = f"tmp/{event_id}__manual-preparation-{token}.json"
    candidate_ref = f"tmp/{event_id}__manual-candidate-{token}.json"
    request = workspace._analysis_request(
        event, event_id=event_id, event_action="created", ser_no=report["ser_no"],
        title=f"{event.equipment_name}人工上报异常事件", anomaly_type=anomaly_type,
        api_config=api_config, source_ship_id=str(profile["sensorApiShipId"]),
        knowledge_entry=knowledge["entry"], knowledge_root=knowledge["root"],
    )
    preparation = {
        "kind": "manual_analysis_preparation", "event_id": event_id,
        "prepared_at": now.isoformat(), "report": report, "evidence": evidence,
        "analysis_request": request, "candidate_ref": candidate_ref,
        "source_signatures": _source_signatures(root, profile),
        "content_guidance_ref": ".claude/skills/ship-manual-anomaly-analysis/references/agent-analysis.md",
    }
    _validate(preparation)
    workspace._save_json(root / preparation_ref, preparation)
    return {
        "stage": "analysis_required", "event_id": event_id,
        "preparation_ref": preparation_ref, "candidate_ref": candidate_ref,
        "knowledge_search": request["knowledge_search"],
        "content_guidance_ref": preparation["content_guidance_ref"],
        "periodic_detection_guard": {"ok": guard["ok"], "periodic_entrypoints_allowed": False},
        "business_files_written": False,
    }


def publish_manual_analysis(
    root: str | Path, preparation_ref: str | Path, *, analysis_ref: str | Path | None = None,
    fallback: bool = False, fallback_reason: str | None = None, dry_run: bool = False,
) -> dict[str, Any]:
    from .workflow import run_manual_anomaly

    root = Path(root).resolve()
    if fallback or analysis_ref is None:
        raise ManualContractError("A model-authored candidate is required; deterministic task generation is disabled")

    def read_file(ref: str | Path) -> tuple[Path, dict[str, Any]]:
        path = (root / ref).resolve()
        if not path.is_relative_to((root / "tmp").resolve()):
            raise ManualContractError("manual preparation and candidate must be inside workspace/tmp")
        return path, json.loads(path.read_text(encoding="utf-8-sig"))

    preparation_path, preparation = read_file(preparation_ref)
    _validate(preparation)
    profile, _ = anomaly_module("ship_profile").load_ship_profile(root)
    if _source_signatures(root, profile) != preparation["source_signatures"]:
        raise ManualContractError("manual mapping or configuration changed after preparation; prepare again")
    candidate_path = None
    candidate = None
    if analysis_ref is not None:
        candidate_path, candidate = read_file(analysis_ref)
        if candidate_path != (root / preparation["candidate_ref"]).resolve():
            raise ManualContractError("candidate path must match the manual preparation")
        if not isinstance(candidate, dict) or candidate.get("event_id") != preparation["event_id"]:
            raise ManualContractError("Agent candidate must use the prepared manual event_id")
        try:
            anomaly_module("contracts").validate_payload(candidate, "agent-analysis-content.schema.json")
        except RuntimeError as exc:
            raise ManualContractError(str(exc)) from exc
    outcome = run_manual_anomaly(
        root, preparation["report"], dry_run=dry_run,
        created_at=datetime.fromisoformat(preparation["prepared_at"]),
        agent_content=candidate, allow_fallback=fallback,
        prepared_evidence=preparation["evidence"], expected_event_id=preparation["event_id"],
    )
    outcome["content_generation"] = {
        "source": outcome["analysis_content_source"],
        "fallback_reason": str(fallback_reason).strip() if fallback else None,
    }
    if not dry_run:
        preparation_path.unlink()
        if candidate_path is not None:
            candidate_path.unlink()
    return outcome

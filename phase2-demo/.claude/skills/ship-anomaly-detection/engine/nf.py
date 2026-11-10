from __future__ import annotations

import json
import math
import hashlib
from functools import lru_cache
from pathlib import Path
from typing import Any

from .events import extract_scored_events
from .registry import SKILL_DIR, load_registry
from .types import Channel, ChannelStatus, DetectionEvent, Sample, Segment


NF_ASSET_ROOT = SKILL_DIR / "data" / "nf_cruise"
NF_MIDLOW_ASSET_ROOT = SKILL_DIR / "data" / "nf_midlow"
NF_ASSET_ROOTS = {"cruise": NF_ASSET_ROOT, "midlow": NF_MIDLOW_ASSET_ROOT}

PREFERRED_CRUISE_FEATURES = [
    "rpm",
    "load",
    "fuel_inlet_pressure",
    "fuel_inlet_temp",
    "lube_inlet_pressure",
    "lube_inlet_temp",
    "lube_filter_dp",
    "turbo_lube_pressure_A",
    "turbo_lube_pressure_B",
    "turbo_lube_outlet_temp_A",
    "turbo_lube_outlet_temp_B",
    "ht_water_inlet_pressure",
    "ht_water_inlet_temp",
    "ht_water_outlet_temp_A",
    "ht_water_outlet_temp_B",
    "cac_ht_water_outlet_temp",
    "lt_water_inlet_pressure",
    "lt_water_inlet_temp",
    "loc_lt_water_outlet_temp",
    "turbo_exhaust_in_temp_A",
    "turbo_exhaust_in_temp_B",
    "turbo_exhaust_out_temp_A",
    "turbo_exhaust_out_temp_B",
    *[f"exhaust_{bank}{cylinder}" for bank in "AB" for cylinder in range(1, 7)],
    "charge_air_inlet_pressure",
    "charge_air_inlet_temp",
    *[f"main_bearing_{number}" for number in range(8)],
    "fuel_rack_position",
    "turbo_speed_A",
    "turbo_speed_B",
    "crankcase_pressure",
    *[
        f"liner_{bank}{cylinder}_{position}"
        for bank in "AB"
        for cylinder in range(1, 7)
        for position in range(1, 3)
    ],
    *[f"big_end_{bank}{cylinder}" for bank in "AB" for cylinder in range(1, 7)],
]

PREFERRED_MIDLOW_FEATURES = [
    "rpm",
    "load",
    "fuel_inlet_pressure",
    "lube_inlet_pressure",
    "ht_water_inlet_temp",
    "ht_water_outlet_temp_A",
    "ht_water_outlet_temp_B",
    "turbo_exhaust_in_temp_A",
    "turbo_exhaust_in_temp_B",
    "charge_air_inlet_pressure",
    "turbo_speed_A",
    "turbo_speed_B",
]


def _torch():
    try:
        import torch
        import torch.nn as nn
    except ImportError as exc:
        raise RuntimeError("NF cruise requires PyTorch") from exc
    return torch, nn


def build_nf_model(
    *, dim: int, n_layers: int = 4, hidden_dim: int = 64, max_scale: float = 0.35, dropout: float = 0.05
):
    torch, nn = _torch()

    class CouplingLayer(nn.Module):
        def __init__(self, reverse: bool):
            super().__init__()
            self.reverse = reverse
            self.split_size = dim // 2
            fixed_size = dim - self.split_size if reverse else self.split_size
            transformed = self.split_size if reverse else dim - self.split_size
            self.net = nn.Sequential(
                nn.Linear(fixed_size, hidden_dim),
                nn.ReLU(),
                nn.Dropout(dropout),
                nn.Linear(hidden_dim, hidden_dim),
                nn.ReLU(),
                nn.Dropout(dropout),
                nn.Linear(hidden_dim, transformed * 2),
            )

        def forward(self, values):
            if self.reverse:
                fixed, changed = values[:, self.split_size :], values[:, : self.split_size]
            else:
                fixed, changed = values[:, : self.split_size], values[:, self.split_size :]
            scale, shift = self.net(fixed).chunk(2, dim=-1)
            scale = torch.tanh(scale) * max_scale
            transformed = changed * torch.exp(scale) + shift
            if self.reverse:
                output = torch.cat([transformed, fixed], dim=-1)
            else:
                output = torch.cat([fixed, transformed], dim=-1)
            return output, scale.sum(dim=-1)

    class NFModel(nn.Module):
        def __init__(self):
            super().__init__()
            self.dim = dim
            self.layers = nn.ModuleList(CouplingLayer(index % 2 == 1) for index in range(n_layers))

        def forward(self, values):
            latent = values
            log_det = torch.zeros(values.shape[0], dtype=values.dtype, device=values.device)
            for layer in self.layers:
                latent, contribution = layer(latent)
                log_det = log_det + contribution
            return latent, log_det

        def log_prob(self, values):
            latent, log_det = self.forward(values)
            base = -0.5 * latent.pow(2).sum(dim=-1)
            base = base - 0.5 * dim * math.log(2.0 * math.pi)
            return base + log_det

    return NFModel()


@lru_cache(maxsize=8)
def load_nf_artifact(equipment_id: str, scope: str = "cruise") -> tuple[Any, dict[str, Any]]:
    torch, _ = _torch()
    if scope not in NF_ASSET_ROOTS:
        raise ValueError(f"unsupported NF scope: {scope}")
    asset_dir = NF_ASSET_ROOTS[scope] / equipment_id
    metadata_path = asset_dir / "metadata.json"
    weights_path = asset_dir / "model.pt"
    if not metadata_path.is_file() or not weights_path.is_file():
        raise FileNotFoundError(f"NF {scope} assets missing for {equipment_id}")
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    expected_checksum = str(metadata.get("weights_sha256") or "")
    actual_checksum = hashlib.sha256(weights_path.read_bytes()).hexdigest()
    if expected_checksum and actual_checksum != expected_checksum:
        raise ValueError(f"NF {scope} weights checksum mismatch for {equipment_id}")
    features = metadata.get("features", [])
    model_config = metadata.get("model", {})
    if len(features) != int(model_config.get("dim", -1)):
        raise ValueError(f"NF {scope} feature/model dimension mismatch for {equipment_id}")
    normalization = metadata.get("normalization", {})
    if len(normalization.get("means", [])) != len(features) or len(normalization.get("stds", [])) != len(features):
        raise ValueError(f"NF {scope} normalization dimension mismatch for {equipment_id}")
    model = build_nf_model(
        dim=len(features),
        n_layers=int(model_config["n_layers"]),
        hidden_dim=int(model_config["hidden_dim"]),
        max_scale=float(model_config["max_scale"]),
        dropout=float(model_config["dropout"]),
    )
    state = torch.load(weights_path, map_location="cpu", weights_only=True)
    model.load_state_dict(state)
    model.eval()
    return model, metadata


def clear_nf_cache() -> None:
    load_nf_artifact.cache_clear()


def _score_segment(samples: list[Sample], segment: Segment, model: Any, metadata: dict[str, Any]):
    torch, _ = _torch()
    features = list(metadata["features"])
    means = [float(value) for value in metadata["normalization"]["means"]]
    stds = [max(float(value), 1e-9) for value in metadata["normalization"]["stds"]]
    rows: list[list[float]] = []
    indices: list[int] = []
    normalized_rows: list[list[float]] = []
    for index in range(segment.start_idx, segment.end_idx):
        values = samples[index].values
        if any(key not in values or not math.isfinite(float(values[key])) for key in features):
            continue
        normalized = [
            (float(values[key]) - mean) / std
            for key, mean, std in zip(features, means, stds)
        ]
        rows.append([float(values[key]) for key in features])
        normalized_rows.append(normalized)
        indices.append(index)
    if not normalized_rows:
        return [], [], []
    with torch.no_grad():
        matrix = torch.tensor(normalized_rows, dtype=torch.float32)
        scores = (-model.log_prob(matrix)).cpu().tolist()
    return indices, scores, normalized_rows


def _detect_nf_density(
    samples: list[Sample],
    segments: list[Segment],
    *,
    scope: str,
    channel: Channel,
    event_type: str,
    sensor: str,
    eligible_regimes: set[str],
    min_duration_sec: float,
    min_segment_samples: int,
    registry: dict[str, Any] | None = None,
) -> tuple[list[DetectionEvent], ChannelStatus]:
    config = registry or load_registry()
    equipment_id = samples[0].equipment_id if samples else ""
    try:
        model, metadata = load_nf_artifact(equipment_id, scope)
    except (FileNotFoundError, RuntimeError, ValueError, KeyError) as exc:
        return [], ChannelStatus(channel.value, False, str(exc), 0, 0)

    threshold = float(metadata["thresholds"]["active_anomaly_score"])
    min_points = max(
        int(min_duration_sec / float(config["regime"]["sample_interval_sec"]) * 0.5),
        2,
    )
    events: list[DetectionEvent] = []
    eligible = 0
    for segment in segments:
        if segment.type not in eligible_regimes or segment.n_samples < min_segment_samples:
            continue
        indices, scores, normalized = _score_segment(samples, segment, model, metadata)
        eligible += len(indices)
        scored = []
        for index, score, row in zip(indices, scores, normalized):
            if score <= threshold:
                continue
            ranked = sorted(
                zip(metadata["features"], row), key=lambda item: abs(float(item[1])), reverse=True
            )[:5]
            scored.append(
                (
                    index,
                    float(score),
                    {
                        "anomaly_score": round(float(score), 6),
                        "top_standardized_deviations": [
                            {"sensor": key, "abs_z": round(abs(float(value)), 4)}
                            for key, value in ranked
                        ],
                        "model_scope": str(metadata.get("scope") or f"{scope}_only"),
                    },
                )
            )
        events.extend(
            extract_scored_events(
                samples=samples,
                scored=scored,
                channel=channel,
                event_type=event_type,
                sensors=[sensor],
                groups=["joint_density"],
                threshold=threshold,
                regime=segment.type,
                min_duration_sec=min_duration_sec,
                merge_gap_sec=float(config["event_rules"]["merge_gap_sec"]),
                object_id=equipment_id,
                allow_candidate_confirmed=False,
                low_confidence=True,
                low_confidence_reason=f"{event_type}仅表示健康数据联合分布偏离，不独立确认故障",
                min_points=min_points,
            )
        )
    reason = "ok" if eligible else f"no_eligible_{scope}_segment"
    return events, ChannelStatus(channel.value, bool(eligible), reason, eligible, len(events))


def detect_nf_cruise(
    samples: list[Sample], segments: list[Segment], registry: dict[str, Any] | None = None
) -> tuple[list[DetectionEvent], ChannelStatus]:
    config = registry or load_registry()
    return _detect_nf_density(
        samples,
        segments,
        scope="cruise",
        channel=Channel.NF,
        event_type="dl_nf_cruise",
        sensor="nf_cruise",
        eligible_regimes={"cruise"},
        min_duration_sec=float(config["event_rules"]["stat_min_duration_sec"]),
        min_segment_samples=int(config["regime"]["min_cruise_samples"]),
        registry=config,
    )


def detect_nf_midlow(
    samples: list[Sample], segments: list[Segment], registry: dict[str, Any] | None = None
) -> tuple[list[DetectionEvent], ChannelStatus]:
    config = registry or load_registry()
    return _detect_nf_density(
        samples,
        segments,
        scope="midlow",
        channel=Channel.NF_MIDLOW,
        event_type="dl_nf_midlow",
        sensor="nf_midlow",
        eligible_regimes={"low_speed", "mid"},
        min_duration_sec=float(config["event_rules"]["mid_min_duration_sec"]),
        min_segment_samples=2,
        registry=config,
    )

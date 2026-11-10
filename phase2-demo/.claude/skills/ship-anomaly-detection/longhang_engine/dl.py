"""
船舶异常检测 -- 深度学习推理 V7.8.5
====================================
多通道 DL 检测架构 (4 DL 通道):

通道1: PatchTST + NF (巡航 RPM>=93)
  - PatchTST: 故障/正常 ratio 4.5x (主力)
  - NF:       ratio 2.5x (辅助)

通道2: iTransformer Forecasting — RPM>=78 全工况检测
  - 全工况训练 (Jan-May, 均衡采样)
  - Forecasting 目标: 过去1h → 预测未来30min
  - 分RPM区间阈值 (cruise/transition/maneuver)
  - 补充非巡航段检测空白

通道3: NF Forecast — RPM>=78 密度估计

通道4: DualTask + NF Midlow (RPM 30-78 中低速专用)
  - DualTask: 预测+重建双任务, 50特征
  - NF Midlow: 密度估计辅助

效果:
- Normal cruise: 零误报
- Normal mixed (含过渡): 检出过渡段异常
- Fault (RPM 86-89): PatchTST 主力覆盖, forecast 交叉验证
"""

import json
import logging
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import torch
import torch.nn as nn

from .config import BASE_DIR
from .loader import load_data
from .types import Event, Level, Channel

logger = logging.getLogger(__name__)

# -- Paths ---------------------------------------------------------------
CRUISE_DIR = BASE_DIR / "data" / "dl_cruise"
DEVICE = torch.device("cpu")

# -- Constants -----------------------------------------------------------
N_VARS = 59
ITRANS_SEQ_LEN = 12  # 12 x 12s = 2.4 min
PT_LOOKBACK = 12
PT_HORIZON = 6

# V7.0 feature names (by position in registry)
from .registry import SENSOR_REGISTRY
FEATURE_NAMES = list(SENSOR_REGISTRY.keys())[:59]

# -- Model definitions (cruise DL: NF + PatchTST) -------------------------

class CouplingLayer(nn.Module):
    def __init__(self, dim, hidden_dim=128, max_scale=0.5, dropout=0.1, reverse=False):
        super().__init__()
        self.reverse = reverse
        self.split_size = dim // 2
        d2 = dim - self.split_size
        self.net = nn.Sequential(
            nn.Linear(self.split_size, hidden_dim), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(hidden_dim, d2 * 2),
        )
        self.max_scale = max_scale

    def forward(self, x):
        if self.reverse:
            x1, x2 = x[:, self.split_size:], x[:, :self.split_size]
        else:
            x1, x2 = x[:, :self.split_size], x[:, self.split_size:]
        s, b = self.net(x1).chunk(2, dim=-1)
        s = torch.tanh(s) * self.max_scale
        y2 = x2 * torch.exp(s) + b
        if self.reverse:
            return torch.cat([y2, x1], dim=-1), s.sum(dim=-1)
        return torch.cat([x1, y2], dim=-1), s.sum(dim=-1)


class NFModel(nn.Module):
    def __init__(self, dim=59, n_layers=8, hidden_dim=128, max_scale=0.5, dropout=0.1):
        super().__init__()
        self.dim = dim
        self.layers = nn.ModuleList([
            CouplingLayer(dim, hidden_dim, max_scale, dropout, reverse=(i % 2 == 1))
            for i in range(n_layers)
        ])
        self.register_buffer("base_mean", torch.zeros(dim))
        self.register_buffer("base_std", torch.ones(dim))

    def forward(self, x):
        log_det = 0
        z = x
        for layer in self.layers:
            z, ld = layer(z)
            log_det += ld
        return z, log_det

    def log_prob(self, x):
        z, log_det = self.forward(x)
        lp = -0.5 * ((z - self.base_mean) / self.base_std).pow(2).sum(dim=-1)
        lp -= 0.5 * self.dim * np.log(2 * np.pi)
        lp -= self.base_std.log().sum()
        return lp + log_det


class PatchEmbedding(nn.Module):
    def __init__(self, patch_len=4, stride=2, d_model=16):
        super().__init__()
        self.patch_len = patch_len
        self.stride = stride
        self.projection = nn.Linear(patch_len, d_model)

    def forward(self, x):
        B, L, F = x.shape
        patches = []
        for f in range(F):
            p = x[:, :, f].unfold(1, self.patch_len, self.stride)
            patches.append(p)
        patches = torch.stack(patches, dim=2)
        B, P, F, PL = patches.shape
        return self.projection(patches.reshape(B * P * F, PL)).reshape(B, P, F * self.projection.out_features)


class PatchTSTModel(nn.Module):
    def __init__(self, n_features=59, lookback=12, horizon=6,
                 patch_len=4, stride=2, d_model=16, n_layers=3, dropout=0.1):
        super().__init__()
        self.n_features = n_features
        self.horizon = horizon
        n_patches = (lookback - patch_len) // stride + 1
        self.patch_embed = PatchEmbedding(patch_len, stride, d_model)
        d_input = n_features * d_model
        nhead = next(h for h in [16, 8, 4, 2, 1] if d_input % h == 0)
        self.pos_embed = nn.Parameter(torch.randn(1, n_patches, d_input) * 0.02)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_input, nhead=nhead, dim_feedforward=d_input * 2,
            dropout=dropout, batch_first=True,
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=n_layers)
        self.head = nn.Sequential(
            nn.Linear(d_input, d_input), nn.GELU(),
            nn.Linear(d_input, horizon * n_features),
        )

    def forward(self, x):
        z = self.patch_embed(x) + self.pos_embed
        z = self.encoder(z).mean(dim=1)
        return self.head(z).reshape(-1, self.horizon, self.n_features)


# -- Cache ---------------------------------------------------------------

_cache = {}

def _load_norm():
    if "norm" in _cache:
        return _cache["norm"]
    with open(CRUISE_DIR / "norm_stats.json") as f:
        ns = json.load(f)
    means = np.array(ns["means"], dtype=np.float32)
    stds = np.clip(np.array(ns["stds"], dtype=np.float32), 1e-6, None)
    _cache["norm"] = (means, stds)
    return means, stds


# 50D feature names (59 minus turbo_rpm, exh_dev_cyl1-6, servo_leak, scav_air_press)
_EXCLUDE_IDX = {1, 13, 14, 15, 16, 17, 18, 42, 58}
CRUISE_FEATURE_NAMES = [FEATURE_NAMES[i] for i in range(59) if i not in _EXCLUDE_IDX]


def _prepare(df):
    """Extract 50 features from DataFrame, normalize. Returns (N, 50)."""
    means, stds = _load_norm()
    arr = np.full((len(df), 50), np.nan, dtype=np.float32)
    for i, col in enumerate(CRUISE_FEATURE_NAMES):
        if col in df.columns:
            arr[:, i] = df[col].values.astype(np.float32)
    arr = pd.DataFrame(arr).ffill().values
    arr = np.nan_to_num(arr, nan=0.0)
    return (arr - means) / stds


def _load_patchtst():
    if "pt" in _cache:
        return _cache["pt"]
    ckpt = torch.load(CRUISE_DIR / "patchtst_cruise.pt", map_location=DEVICE, weights_only=False)
    n_features = ckpt.get("n_features", 50)
    # V8.1: support both old PatchEmbedding-based and new simplified architecture
    sd = ckpt.get("model_state_dict", ckpt)
    if "patch_embed.weight" in sd:
        # Simplified architecture from retraining: patch_proj = nn.Linear(patch_len*n_features, d_model)
        # Reconstruct simplified model
        class _SimplePatchTST(nn.Module):
            def __init__(self, n_features, lookback, horizon, patch_len, stride, d_model, n_layers, dropout):
                super().__init__()
                self.n_features = n_features
                self.lookback = lookback
                self.horizon = horizon
                self.patch_len = patch_len
                self.stride = stride
                self.n_patches = (lookback - patch_len) // stride + 1
                self.patch_embed = nn.Linear(patch_len * n_features, d_model)
                self.pos_embed = nn.Parameter(torch.randn(1, self.n_patches, d_model) * 0.02)
                encoder_layer = nn.TransformerEncoderLayer(
                    d_model=d_model, nhead=4, dim_feedforward=d_model * 4,
                    dropout=dropout, batch_first=True,
                )
                self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=n_layers)
                self.head = nn.Linear(d_model * self.n_patches, horizon * n_features)
            def forward(self, x):
                B, L, F = x.shape
                patches = []
                for i in range(self.n_patches):
                    s = i * self.stride
                    patches.append(x[:, s:s+self.patch_len, :].reshape(B, -1))
                patches = torch.stack(patches, dim=1)
                z = self.patch_embed(patches) + self.pos_embed
                z = self.encoder(z).reshape(B, -1)
                return self.head(z).reshape(B, self.horizon, self.n_features)
        model = _SimplePatchTST(
            n_features=n_features,
            lookback=ckpt.get("lookback", 12),
            horizon=ckpt.get("horizon", 6),
            patch_len=ckpt.get("patch_len", 4),
            stride=ckpt.get("stride", 2),
            d_model=ckpt.get("d_model", 16),
            n_layers=ckpt.get("n_layers", 3),
            dropout=ckpt.get("dropout", 0.1),
        )
    else:
        model = PatchTSTModel(
            n_features=n_features,
            lookback=ckpt.get("lookback", 12),
            horizon=ckpt.get("horizon", 6),
            patch_len=ckpt.get("patch_len", 4),
            stride=ckpt.get("stride", 2),
            d_model=ckpt.get("d_model", 16),
            n_layers=ckpt.get("n_layers", 3),
        )
    model.load_state_dict(ckpt["model_state_dict"])
    model.to(DEVICE).eval()

    with open(CRUISE_DIR / "patchtst_cruise_feat.json") as f:
        feat_err = json.load(f)
    baseline_mae = np.array([feat_err.get(f"feat_{i}", 0.1) for i in range(n_features)], dtype=np.float32)
    baseline_mae = np.clip(baseline_mae, 1e-6, None)

    _cache["pt"] = (model, baseline_mae)
    return model, baseline_mae


def _load_nf():
    if "nf" in _cache:
        return _cache["nf"]
    ckpt = torch.load(CRUISE_DIR / "nf_cruise.pt", map_location=DEVICE, weights_only=False)
    model = NFModel(
        dim=ckpt.get("dim", 50),
        n_layers=ckpt.get("n_layers", 8),
        hidden_dim=ckpt.get("hidden_dim", 128),
        max_scale=ckpt.get("max_scale", 0.5),
    )
    model.load_state_dict(ckpt["model_state_dict"])
    model.to(DEVICE).eval()

    with open(CRUISE_DIR / "nf_cruise_thresholds.json") as f:
        thresholds = json.load(f)

    _cache["nf"] = (model, thresholds)
    return model, thresholds


# -- Scoring -------------------------------------------------------------

def _score_patchtst(arr):
    model, baseline_mae = _load_patchtst()
    lookback, horizon = PT_LOOKBACK, PT_HORIZON
    n = len(arr)
    n_win = n - lookback - horizon + 1
    if n_win <= 0:
        return np.array([])

    scores = np.full(n_win, np.nan, dtype=np.float32)
    with torch.no_grad():
        for s in range(0, n_win, 128):
            e = min(s + 128, n_win)
            wx = torch.tensor(np.stack([arr[i:i+lookback] for i in range(s, e)]), dtype=torch.float32)
            pred = model(wx)
            actual = torch.tensor(np.stack([arr[i+lookback:i+lookback+horizon] for i in range(s, e)]), dtype=torch.float32)
            mae = (pred - actual).abs().mean(dim=1).numpy()  # (B, 59)
            # Use ratio to baseline (most discriminative)
            scores[s:e] = (mae / baseline_mae).mean(axis=1)
    return scores


def _score_nf(arr):
    model, _ = _load_nf()
    with torch.no_grad():
        return -model.log_prob(torch.tensor(arr, dtype=torch.float32)).numpy()


# -- Detection -----------------------------------------------------------

def detect_dl(data_path: str | Path, sensitivity: str = "strict") -> list[Event]:
    """Cruise-trained NF detection.

    Predictive DL heads are disabled on the test-anomaly branch; ch_iqr now
    covers the single-sensor candidate role that PatchTST used to supplement.
    """
    df = load_data(data_path)
    if len(df) < 30:
        return []

    # Use RAW 12s data (no resampling!)
    arr = _prepare(df)
    if len(arr) < PT_LOOKBACK + PT_HORIZON:
        return []

    events = []

    # Only run NF on cruise segments (RPM >= 93).
    rpm = df["rpm"].values if "rpm" in df.columns else np.ones(len(arr))
    cruise_mask = rpm >= 93

    # -- NF (cruise only) --
    try:
        nf_scores = _score_nf(arr)
        if len(nf_scores) > 0:
            # Also filter to cruise only
            for i in range(len(nf_scores)):
                if i < len(cruise_mask) and not cruise_mask[i]:
                    nf_scores[i] = np.nan
            valid_nf = ~np.isnan(nf_scores)
            if valid_nf.sum() > 0:
                _, nf_thresh = _load_nf()
                # thresholds: {"p5": ..., "p10": ..., "median": ...} (log-likelihood space)
                # nf_scores = -log_prob → higher = more anomalous
                # anomaly when nf_scores > -p5_threshold
                p5_val = nf_thresh.get("p5", -40)
                nf_anom_thresh = -p5_val  # convert to -log_prob space (positive)
                sens_mult = {"strict": 1.0, "normal": 0.8, "relaxed": 0.6}
                nf_anom_thresh *= sens_mult.get(sensitivity, 1.0)

                nf_events = _extract_sample_events(
                    nf_scores, nf_anom_thresh, df, "nf",
                )
                events.extend(nf_events)
                logger.info("NF: %d events, max_neg_ll=%.0f (cruise only)", len(nf_events), np.nanmax(nf_scores))
    except Exception as e:
        logger.warning("NF error: %s", e)

    return events


def _extract_window_events(scores, threshold, df, model_name, min_consecutive=3):
    """Extract events from window-level scores."""
    anom = scores > threshold
    events = []

    # Filter RPM > 5 (skip dead ship)
    rpm = df["rpm"].values if "rpm" in df.columns else np.ones(len(df))
    # Windows centered at i + lookback//2
    for i in range(len(anom)):
        center = min(i + PT_LOOKBACK // 2, len(rpm) - 1)
        if rpm[center] <= 5:
            anom[i] = False

    in_event = False
    ev_start = 0
    for i in range(len(anom)):
        if anom[i] and not in_event:
            in_event = True
            ev_start = i
        elif not anom[i] and in_event:
            in_event = False
            if i - ev_start >= min_consecutive:
                events.append(_make_event(ev_start, i, scores, threshold, df, model_name, window_offset=PT_LOOKBACK))
    if in_event and len(anom) - ev_start >= min_consecutive:
        events.append(_make_event(ev_start, len(anom), scores, threshold, df, model_name, window_offset=PT_LOOKBACK))

    return events


def _extract_sample_events(scores, threshold, df, model_name):
    """Extract events from sample-level scores (NF)."""
    anom = scores > threshold
    rpm = df["rpm"].values if "rpm" in df.columns else np.ones(len(df))
    anom = anom & (rpm > 30)  # skip dead ship, astern, ultra-low idle

    events = []
    in_event = False
    ev_start = 0
    min_consecutive = 5  # ~1 minute at 12s sampling
    for i in range(len(anom)):
        if anom[i] and not in_event:
            in_event = True
            ev_start = i
        elif not anom[i] and in_event:
            in_event = False
            if i - ev_start >= min_consecutive:
                events.append(_make_event(ev_start, i, scores, threshold, df, model_name, window_offset=0))
    if in_event and len(anom) - ev_start >= min_consecutive:
        events.append(_make_event(ev_start, len(anom), scores, threshold, df, model_name, window_offset=0))

    return events


def _make_event(ev_start, ev_end, scores, threshold, df, model_name, window_offset=0):
    """Create an Event from anomaly range."""
    ev_scores = scores[ev_start:ev_end]
    max_score = float(np.nanmax(ev_scores))
    max_z = max_score / threshold

    ts_col = df["timestamp"].values if "timestamp" in df.columns else df.index
    start_idx = min(ev_start + window_offset, len(ts_col) - 1)
    end_idx = min(ev_end + window_offset + 5, len(ts_col) - 1)

    t_start = str(ts_col[start_idx])
    t_end = str(ts_col[end_idx])
    try:
        duration = (pd.Timestamp(ts_col[end_idx]) - pd.Timestamp(ts_col[start_idx])).total_seconds() / 60.0
    except:
        duration = float((ev_end - ev_start) * 0.2)  # ~12s per sample

    severity = Level.COMODAL
    # V8.1: NF/PatchTST cruise also retrained with limited data — be conservative
    if max_z >= 3.0 and duration >= 5:
        severity = Level.HIGH  # was CONFIRMED — demoted for same reason as forecast
    elif max_z >= 2.0:
        severity = Level.COMODAL

    return Event(
        id="", level=severity, channel=Channel.DL,
        type=f"dl_{model_name}",
        sensors=[model_name],
        groups=[],
        time_start=t_start, time_end=t_end,
        duration_min=round(duration, 1),
        max_z=round(max_z, 2),
        severity=round(max_score, 3),
        confirmed=severity == Level.CONFIRMED,
        low_confidence=severity == Level.COMODAL,
        low_confidence_reason=f"dl_{model_name}_cruise",
    )


# ===================================================================
# Forecasting iTransformer — Full-Condition Detection (V7.3)
# ===================================================================
# Trained on ALL operating conditions (RPM>5) with forecasting objective.
# Catches anomalies in non-cruise regimes that PatchTST/NF miss.
#
# Architecture: variate-as-token Transformer
#   Input:  (batch, 50_vars, seq_len=12)  — past 1h at 5min
#   Output: (batch, 50_vars, horizon=6)   — next 30min at 5min
#   Score:  mean(per_feature_prediction_error / training_MAE)
#
# RPM-zone thresholds:
#   cruise (93+):       P95=3.45
#   maneuver_high (78-93): P95=3.06
#   maneuver_mid (60-78):  P95=3.49
#   low (5-60):            P95=4.27
# ===================================================================

FORECAST_DIR = BASE_DIR / "data" / "itransformer_forecast"

# 50 DC Key features — mapping from training short names to live DC00xx keys
# Short name → DC00xx mapping based on mapping JSON index (0-based from sensor_map):
# DC0001=RPM, DC0003=0203, DC0004=0206, DC0005=PT4301C...
# Excluded: DC0002(0013/turbo_rpm counter), DC0014-0019(DEVs),
#           DC0043(0418/servo_leak constant), DC0059(CHARGEAIR P)
FORECAST_DC_KEYS = [
    "DC0001","DC0003","DC0004","DC0005","DC0006","DC0007",  # RPM, 0203, 0206, PT4301C, 0302, 0303
    "DC0008","DC0009","DC0010","DC0011","DC0012","DC0013",  # 0305A-F (exh cyl 1-6)
    "DC0020","DC0021",                                       # 0307, 0308 (exh before/after turbo)
    "DC0022","DC0023","DC0024","DC0025","DC0026","DC0027",  # 0310A-F (scav cyl 1-6)
    "DC0028","DC0029","DC0030",                              # 0401, 0402, 0403 (lo main)
    "DC0031","DC0032","DC0033","DC0034","DC0035","DC0036",  # 0404A-F (piston lo cyl 1-6)
    "DC0037","DC0038","DC0039","DC0040",                     # 0405, 0406, 0407, 0408
    "DC0041","DC0042",                                       # 0413, 0414 (fo)
    "DC0044","DC0045",                                       # 0501, 0502 (cfw inlet)
    "DC0046","DC0047","DC0048","DC0049","DC0050","DC0051",  # 0503A-F (cfw out cyl 1-6)
    "DC0052","DC0053",                                       # 0505, 0506
    "DC0054","DC0055","DC0056","DC0057",                     # IN2433-01, IN2434-02, IN2562-03, IN2563-04
    "DC0058",                                                 # FUEL INDEX U
]

FCAST_SEQ_LEN = 12
FCAST_HORIZON = 6

# RPM zone thresholds — calibrated from calibration set P95 (V2, Jan-May balanced)
# RPM<30 skipped (insufficient data: <2h total)
# RPM 30-60: "low" zone, ~77h data, ~926 5min windows
# RPM 60-78: "maneuver_mid", RPM 78-93: "maneuver_high", RPM 93+: "cruise"
FCAST_ZONE_THRESH = {
    "cruise":         3.02,  # RPM ≥ 93,   n=645 ✅
    "maneuver_high":  3.08,  # RPM 78-93,  n=216 ✅
    "maneuver_mid":   999,   # RPM 60-78,  跳过 → 由 midlow 模型处理
    "low":            999,   # RPM 30-60,  跳过 → 由 midlow 模型处理
    "midlow":         1.96,  # RPM 30-78,  n=3494 ✅ P95 on normalized scores
    "skip":           999,   # RPM < 30 (no training data)
}

# Sensitivity multipliers (applied to zone P95)
# strict=1.0x → true P95, normal=0.85x → ~P90, relaxed=0.70x → ~P80
FCAST_SENS_MULT = {
    "strict":  1.0,
    "normal":  0.85,
    "relaxed": 0.70,
}


class iTransformerForecast(nn.Module):
    """iTransformer with forecasting objective - for full-condition detection.

    Input:  (batch, n_vars, seq_len=12)  - past 1h at 5min
    Output: (batch, n_vars, horizon=6)   - next 30min at 5min
    """

    def __init__(self, n_vars=50, seq_len=12, horizon=6, d_model=64,
                 nhead=4, num_layers=3, dim_feedforward=128, dropout=0.1):
        super().__init__()
        self.n_vars = n_vars
        self.seq_len = seq_len
        self.horizon = horizon
        self.d_model = d_model
        # Per-variate projection: each var's (seq_len,) → (d_model,)
        self.variate_proj = nn.Linear(seq_len, d_model)
        # Variate embedding as submodule (matches training script)
        self.variate_embedding = _VariateEmbedding(n_vars, d_model)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead, dim_feedforward=dim_feedforward,
            dropout=dropout, activation="gelu", batch_first=True, norm_first=True,
        )
        self.encoder = nn.TransformerEncoder(
            encoder_layer, num_layers=num_layers, norm=nn.LayerNorm(d_model),
        )
        # Per-variate output head: (d_model,) → (horizon,)
        self.output_head = nn.Linear(d_model, horizon)

    def forward(self, x):
        # x: (batch, n_vars, seq_len)
        # Linear(seq_len, d_model) applies to dim=2 → (B, n_vars, d_model)
        tokens = self.variate_proj(x)  # (B, n_vars, d_model)
        tokens = self.variate_embedding(tokens)  # adds learnable embedding per variate
        tokens = self.encoder(tokens)  # (B, n_vars, d_model)
        pred = self.output_head(tokens)  # (B, n_vars, horizon)
        return pred


class _VariateEmbedding(nn.Module):
    """Learnable embedding for each variate — matches training script."""

    def __init__(self, n_vars: int, d_model: int):
        super().__init__()
        self.embedding = nn.Parameter(torch.randn(n_vars, d_model) * 0.02)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.embedding.unsqueeze(0)


# ===================================================================
# DualTask Model — Forecast + Reconstruction (V7.5)
# ===================================================================
# Replaces iTransformerForecast for midlow (30-78 RPM).
# Same backbone + recon_head. Loss = forecast_loss + 0.3 * recon_loss.
# Inference uses only forecast head.
# Trained: 2982 train / 527 val, 5min, best_val=0.27608 (-2.5% vs Baseline)
# ===================================================================

class DualTaskModel(nn.Module):
    """iTransformer with forecast + reconstruction dual task.

    State dict keys: variate_proj.*, variate_emb.embedding,
    encoder.*, forecast_head.*, recon_head.*
    """
    def __init__(self, n_vars=50, seq_len=12, horizon=6, d_model=64,
                 nhead=4, num_layers=3, dim_feedforward=128, dropout=0.1):
        super().__init__()
        self.n_vars = n_vars
        self.seq_len = seq_len
        self.horizon = horizon
        self.d_model = d_model
        self.variate_proj = nn.Linear(seq_len, d_model)
        # NOTE: named "variate_emb" to match experiment state dict
        self.variate_emb = _VariateEmbedding(n_vars, d_model)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead, dim_feedforward=dim_feedforward,
            dropout=dropout, activation="gelu", batch_first=True, norm_first=True,
        )
        self.encoder = nn.TransformerEncoder(
            encoder_layer, num_layers=num_layers, norm=nn.LayerNorm(d_model),
        )
        self.forecast_head = nn.Linear(d_model, horizon)
        self.recon_head = nn.Linear(d_model, seq_len)

    def forward(self, x):
        tokens = self.variate_proj(x)
        tokens = self.variate_emb(tokens)
        tokens = self.encoder(tokens)
        forecast = self.forecast_head(tokens)
        recon = self.recon_head(tokens)
        return forecast, recon


_FCAST_CACHE: dict = {}


def _load_forecast_model() -> tuple[nn.Module, dict, dict, np.ndarray]:
    """Load forecast iTransformer + norm stats + thresholds + per_feature_mae."""
    if "fcast" in _FCAST_CACHE:
        return _FCAST_CACHE["fcast"]

    # Load checkpoint
    ckpt = torch.load(FORECAST_DIR / "itransformer_forecast.pt",
                       map_location=DEVICE, weights_only=False)
    n_vars = ckpt.get("n_vars", 50)
    model = iTransformerForecast(
        n_vars=n_vars,
        seq_len=ckpt.get("seq_len", 12),
        horizon=ckpt.get("horizon", 6),
        d_model=ckpt.get("args", {}).get("d_model", 64),
        nhead=ckpt.get("args", {}).get("nhead", 4),
        num_layers=ckpt.get("args", {}).get("num_layers", 3),
        dim_feedforward=ckpt.get("args", {}).get("dim_feedforward", 128),
        dropout=ckpt.get("args", {}).get("dropout", 0.1),
    )
    model.load_state_dict(ckpt["model_state_dict"])
    model.to(DEVICE).eval()

    # Load norm stats
    with open(FORECAST_DIR / "norm_stats.json") as f:
        norm_stats = json.load(f)

    # Load feature errors (per_feature_mae for V2e normalization)
    with open(FORECAST_DIR / "itransformer_feature_errors.json") as f:
        feat_err = json.load(f)
    per_feature_mae = np.array(feat_err["per_feature_mae"], dtype=np.float32)

    # Load zone thresholds
    with open(FORECAST_DIR / "itransformer_zone_thresholds.json") as f:
        zone_thresh = json.load(f)

    # Build zone P95 dict
    zone_p95 = {}
    for zone_name, info in zone_thresh.items():
        if isinstance(info, (int, float)):
            zone_p95[zone_name] = float(info)
        elif isinstance(info, dict) and "p95" in info:
            zone_p95[zone_name] = float(info["p95"])

    _FCAST_CACHE["fcast"] = (model, norm_stats, zone_p95, per_feature_mae)
    return model, norm_stats, zone_p95, per_feature_mae


def _load_raw_dckey_features(data_path: str | Path) -> np.ndarray:
    """Load raw JSON and extract 50 DC Key feature values.

    Returns:
        arr: (N, 50) numpy array of DC Key values
    """
    with open(data_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    rows = []
    timestamps = []
    for entry in raw.get("data", []):
        ts = entry.get("terminalTime", "")
        timestamps.append(ts)
        sensor_vals = {}
        for wrapper in entry.get("sensorList", []):
            for sensor in wrapper.get("sensorList", []):
                key = sensor.get("key", "")
                val = sensor.get("value", "")
                try:
                    sensor_vals[key] = float(val) if val != "" else np.nan
                except (ValueError, TypeError):
                    sensor_vals[key] = np.nan
        rows.append(sensor_vals)

    if not rows:
        return np.empty((0, 50), dtype=np.float32), np.array([], dtype="datetime64[ns]")

    # Build array (N, 50) in feature order
    arr = np.full((len(rows), len(FORECAST_DC_KEYS)), np.nan, dtype=np.float32)
    for i, key in enumerate(FORECAST_DC_KEYS):
        col_vals = []
        for r in rows:
            col_vals.append(r.get(key, np.nan))
        arr[:, i] = col_vals

    ts = pd.to_datetime(timestamps, errors="coerce")

    # Forward fill NaN (handling sensor dropout)
    arr = pd.DataFrame(arr).ffill().values
    arr = np.nan_to_num(arr, nan=0.0)

    return arr, ts


def _resample_forecast(arr: np.ndarray, timestamps: pd.DatetimeIndex) -> np.ndarray:
    """Resample raw DC Key data to 5min for forecasting model.

    Training data was 5min resampled (mean). We match that here.
    Returns: (N_5min, 50)
    """
    df = pd.DataFrame(arr, index=timestamps, columns=FORECAST_DC_KEYS)
    # Only keep RPM > 30 rows (skip dead ship, astern, and ultra-low idle)
    # RPM ≤ 30 covers: 停泊(RPM=0), 倒车(RPM<0), 极低速(<30)
    # These regimes have negligible data (721 pts / 5 months) and no trained models.
    rpm_col = 0  # RPM is feature index 0
    valid = df.iloc[:, rpm_col] > 30
    df_valid = df[valid]
    if len(df_valid) < 20:
        return np.empty((0, 50), dtype=np.float32), None

    df_5min = df_valid.resample("5min").mean().ffill().bfill()
    # Keep index (timestamps) for mapping back
    return df_5min[FORECAST_DC_KEYS].values.astype(np.float32), df_5min.index


def _normalize_forecast(arr: np.ndarray, norm_stats: dict) -> np.ndarray:
    """Z-score normalize using training stats."""
    means = np.array(norm_stats["means"], dtype=np.float32)
    stds = np.clip(np.array(norm_stats["stds"], dtype=np.float32), 1e-6, None)
    return (arr - means) / stds


def _create_forecast_windows(arr: np.ndarray) -> np.ndarray:
    """Create (window, 50, seq_len) sliding windows for forecasting.

    Each window: past 12 timesteps at 5min resolution.
    Returns: (N_windows, 50, seq_len)
    """
    N, F = arr.shape
    total_needed = FCAST_SEQ_LEN + FCAST_HORIZON
    if N < total_needed:
        return np.empty((0, F, FCAST_SEQ_LEN), dtype=np.float32)

    windows = np.lib.stride_tricks.sliding_window_view(
        arr, window_shape=total_needed, axis=0
    )  # (N-total_needed+1, F, total_needed)
    X = windows[:, :, :FCAST_SEQ_LEN].astype(np.float32)  # past
    return X


def detect_dl_forecast(data_path: str | Path,
                       sensitivity: str = "strict") -> list[Event]:
    """Full-condition detection using forecasting iTransformer.

    Covers non-cruise regimes (RPM 5-93) where PatchTST/NF don't work.
    """
    # Load raw DC Key data
    arr, ts = _load_raw_dckey_features(data_path)
    if len(arr) < 50:
        logger.info("Forecast-DL: too few rows (%d), skipped", len(arr))
        return []

    # Resample to 5min
    arr_5min, ts_5min = _resample_forecast(arr, ts)
    if len(arr_5min) <= FCAST_SEQ_LEN + FCAST_HORIZON:
        logger.info("Forecast-DL: too few 5min windows (%d), skipped", len(arr_5min))
        return []

    # Load model + stats
    try:
        model, norm_stats, zone_p95, per_feature_mae = _load_forecast_model()
    except Exception as e:
        logger.warning("Forecast-DL model load failed: %s", e)
        return []

    # Normalize
    arr_norm = _normalize_forecast(arr_5min, norm_stats)

    # Extract RPM column (feature 0 = RPM) for zone assignment
    rpm_5min = arr_norm[:, 0].copy()  # normalized RPM
    # Denormalize: actual_rpm = rpm_norm * std[0] + mean[0]
    rpm_mean = float(norm_stats["means"][0])
    rpm_std = float(norm_stats["stds"][0])
    rpm_actual = arr_norm[:, 0] * rpm_std + rpm_mean

    # Create windows
    X = _create_forecast_windows(arr_norm)
    if len(X) == 0:
        return []

    # Score — compute prediction error
    n_windows = len(X)
    scores = np.full(n_windows, np.nan, dtype=np.float32)
    eps = 1e-8
    norm_factors = per_feature_mae + eps
    batch_size = 128

    with torch.no_grad():
        for start in range(0, n_windows, batch_size):
            end = min(start + batch_size, n_windows)
            batch = torch.tensor(X[start:end], dtype=torch.float32, device=DEVICE)
            # model expects (B, n_vars, seq_len)
            pred = model(batch)  # (B, n_vars, horizon)

            # We need actual future values. Reconstruct from the original data.
            # Each window i covers indices [i .. i+seq_len+horizon-1] in arr_norm
            # X is (N_windows, n_vars, seq_len) = past
            # Future = arr_norm[i+seq_len : i+seq_len+horizon] for window i
            for j in range(start, end):
                future_slice = arr_norm[j + FCAST_SEQ_LEN: j + FCAST_SEQ_LEN + FCAST_HORIZON, :]
                if len(future_slice) < FCAST_HORIZON:
                    continue
                future = torch.tensor(future_slice.T[np.newaxis, :, :],
                                      dtype=torch.float32, device=DEVICE)  # (1, n_vars, horizon)
                p = pred[j - start:j - start + 1]  # (1, n_vars, horizon)
                mae = (p - future).abs().mean(dim=2).cpu().numpy()[0]  # (n_vars,)
                normalized = mae / norm_factors  # (n_vars,)
                scores[j] = float(normalized.mean())

    # Find valid scores
    valid_mask = ~np.isnan(scores)
    if valid_mask.sum() < 3:
        return []

    # Get RPM for each window (start RPM = rpm_actual[i])
    # Window i starts at index i in arr_norm
    rpm_windows = np.full(n_windows, np.nan, dtype=np.float32)
    for i in range(n_windows):
        start_idx = i
        if start_idx < len(rpm_actual):
            rpm_windows[i] = rpm_actual[start_idx]

    # Determine sensitivity multiplier
    sens_mult = FCAST_SENS_MULT.get(sensitivity, 1.0)

    # Apply zone thresholds and extract events
    events = []
    in_event = False
    ev_start = 0

    for i in range(n_windows):
        if np.isnan(scores[i]) or np.isnan(rpm_windows[i]):
            anom = False
        else:
            rpm = rpm_windows[i]
            # Get zone threshold
            if rpm >= 93:
                zone_th = FCAST_ZONE_THRESH["cruise"]
            elif rpm >= 78:
                zone_th = FCAST_ZONE_THRESH["maneuver_high"]
            elif rpm >= 60:
                zone_th = FCAST_ZONE_THRESH["maneuver_mid"]
            elif rpm >= 30:
                zone_th = FCAST_ZONE_THRESH["low"]
            else:
                # RPM < 30 should have been filtered by _resample_forecast;
                # treat as skip if any leak through
                zone_th = FCAST_ZONE_THRESH["skip"]

            threshold = zone_th * sens_mult
            anom = scores[i] > threshold

        if anom and not in_event:
            in_event = True
            ev_start = i
        elif not anom and in_event:
            in_event = False
            if i - ev_start >= 2:  # min 2 consecutive windows = 10min
                events.append(_make_forecast_event(
                    ev_start, i, scores, rpm_windows, ts_5min, model_name="itrans_forecast"
                ))

    if in_event and n_windows - ev_start >= 2:
        events.append(_make_forecast_event(
            ev_start, n_windows, scores, rpm_windows, ts_5min, model_name="itrans_forecast"
        ))

    logger.info("Forecast-DL: %d events, max_score=%.1f, n_windows=%d",
                len(events), float(np.nanmax(scores)), n_windows)
    return events


def _make_forecast_event(ev_start, ev_end, scores, rpm_windows, ts_5min,
                         model_name="itrans_forecast"):
    """Create Event from forecasting anomaly window range."""
    ev_scores = scores[ev_start:ev_end]
    valid = ev_scores[~np.isnan(ev_scores)]
    max_score = float(np.max(valid)) if len(valid) > 0 else 0.0

    # Timestamps from resampled index
    if ts_5min is not None:
        t_start = str(ts_5min[ev_start]) if ev_start < len(ts_5min) else ""
        t_end = str(ts_5min[min(ev_end, len(ts_5min)-1)]) if ev_end <= len(ts_5min) else ""
        try:
            duration = (pd.Timestamp(t_end) - pd.Timestamp(t_start)).total_seconds() / 60.0
        except:
            duration = float((ev_end - ev_start) * 5.0)  # 5min per window
    else:
        t_start = ""
        t_end = ""
        duration = float((ev_end - ev_start) * 5.0)

    # NOTE: V8.1 50D retrained models have low discrimination on transition RPM ranges
    # (training data lacks RPM 40-78 coverage). Use conservative thresholds:
    # - iTransformer forecast: max_z normalized by P95 of calibration (not hardcoded 3.5)
    # - Fallback: if no valid zone_threshold, use conservative divisor
    max_z = max_score / 3.5  # TODO: replace with actual P95 from calibration set

    severity = Level.COMODAL
    # V8.1: iTrans forecast currently has no discrimination (normal score ≈ fault score)
    # Downgrade to CoModal/High only until retrained with better data coverage
    if max_z >= 2.5 and duration >= 10:
        severity = Level.HIGH  # was CONFIRMED — demoted due to poor discrimination
    elif max_z >= 1.5:
        severity = Level.COMODAL

    return Event(
        id="", level=severity, channel=Channel.DL,
        type=f"dl_{model_name}",
        sensors=[model_name],
        groups=[],
        time_start=t_start, time_end=t_end,
        duration_min=round(duration, 1),
        max_z=round(max_z, 2),
        severity=round(max_score, 3),
        confirmed=severity == Level.CONFIRMED,
        low_confidence=severity == Level.COMODAL,
        low_confidence_reason=f"dl_{model_name}_fullcondition",
    )


# ===================================================================
# NF — Full-Condition Density Estimation (V7.3)
# ===================================================================
# Midlow zone (30-78 RPM) dedicated models
# ===================================================================

MIDLOW_DIR = BASE_DIR / "data" / "midlow_forecast"

_MIDLOW_CACHE: dict = {}

# ── DualTask cache (separate from old iTransformer cache) ──
_MIDLOW_DT_CACHE: dict = {}


def _load_midlow_forecast_model() -> tuple[nn.Module, dict]:
    """Load midlow iTransformer forecast + norm stats (fallback).

    V7.8.5: read hyperparams from checkpoint when available (dict with
    'model_state_dict' key), otherwise infer n_vars from state_dict shape.
    """
    if "midlow_fcast" in _MIDLOW_CACHE:
        return _MIDLOW_CACHE["midlow_fcast"]
    ckpt = torch.load(MIDLOW_DIR / "itrans_midlow.pt", map_location=DEVICE, weights_only=False)
    # V7.8.5: support both full checkpoint (dict with config) and bare state_dict
    if isinstance(ckpt, dict) and "model_state_dict" in ckpt:
        sd = ckpt["model_state_dict"]
        n_vars = ckpt.get("n_vars", 50)
        model = iTransformerForecast(
            n_vars=n_vars,
            seq_len=ckpt.get("seq_len", 12),
            horizon=ckpt.get("horizon", 6),
            d_model=ckpt.get("args", {}).get("d_model", 64),
            nhead=ckpt.get("args", {}).get("nhead", 4),
            num_layers=ckpt.get("args", {}).get("num_layers", 3),
            dim_feedforward=ckpt.get("args", {}).get("dim_feedforward", 128),
        ).to(DEVICE)
        model.load_state_dict(sd)
    else:
        # Bare state_dict — infer n_vars from variate_embedding shape
        sd = ckpt
        emb_key = "variate_embedding.embedding" if "variate_embedding.embedding" in sd else "variate_emb.embedding"
        n_vars = sd[emb_key].shape[0] if emb_key in sd else 50
        model = iTransformerForecast(n_vars=n_vars).to(DEVICE)
        model.load_state_dict(sd)
    model.eval()
    with open(MIDLOW_DIR / "norm_stats.json") as f:
        norm_stats = json.load(f)
    _MIDLOW_CACHE["midlow_fcast"] = (model, norm_stats)
    return model, norm_stats


def _load_midlow_dualtask_model() -> tuple[nn.Module, dict] | None:
    """Load midlow DualTask model + experiment norm stats.

    Returns None if weights not found (caller falls back).
    V7.8.5: read hyperparams from checkpoint when available.
    """
    if "midlow_dt" in _MIDLOW_DT_CACHE:
        return _MIDLOW_DT_CACHE["midlow_dt"]
    dt_path = MIDLOW_DIR / "dualtask_midlow.pt"
    ns_path = MIDLOW_DIR / "dualtask_norm_stats.json"
    if not dt_path.exists() or not ns_path.exists():
        return None
    ckpt = torch.load(dt_path, map_location=DEVICE, weights_only=False)
    # V7.8.5: support both full checkpoint and bare state_dict
    if isinstance(ckpt, dict) and "model_state_dict" in ckpt:
        sd = ckpt["model_state_dict"]
        n_vars = ckpt.get("n_vars", 50)
        model = DualTaskModel(
            n_vars=n_vars,
            seq_len=ckpt.get("seq_len", 12),
            horizon=ckpt.get("horizon", 6),
            d_model=ckpt.get("args", {}).get("d_model", 64),
            nhead=ckpt.get("args", {}).get("nhead", 4),
            num_layers=ckpt.get("args", {}).get("num_layers", 3),
            dim_feedforward=ckpt.get("args", {}).get("dim_feedforward", 128),
        ).to(DEVICE)
        model.load_state_dict(sd)
    else:
        sd = ckpt
        emb_key = "variate_emb.embedding" if "variate_emb.embedding" in sd else "variate_embedding.embedding"
        n_vars = sd[emb_key].shape[0] if emb_key in sd else 50
        model = DualTaskModel(n_vars=n_vars).to(DEVICE)
        model.load_state_dict(sd)
    model.eval()
    with open(ns_path) as f:
        norm_stats = json.load(f)
    _MIDLOW_DT_CACHE["midlow_dt"] = (model, norm_stats)
    return model, norm_stats


def _load_midlow_nf_model() -> tuple[nn.Module, dict]:
    """Load midlow NF + zone thresholds."""
    if "midlow_nf" in _MIDLOW_CACHE:
        return _MIDLOW_CACHE["midlow_nf"]
    ckpt = torch.load(MIDLOW_DIR / "nf_midlow_best.pt", map_location=DEVICE, weights_only=False)
    m = ckpt["model_state_dict"]
    model = _NFModel(dim=ckpt["dim"], n_layers=ckpt["n_layers"],
                     hidden_dim=ckpt["hidden_dim"], max_scale=ckpt["max_scale"],
                     dropout=ckpt["dropout"])
    model.load_state_dict(m)
    model.to(DEVICE).eval()
    with open(MIDLOW_DIR / "nf_zone_thresholds.json") as f:
        zt = json.load(f)
    _MIDLOW_CACHE["midlow_nf"] = (model, zt)
    return model, zt


def detect_dl_midlow_forecast(data_path: str | Path,
                              sensitivity: str = "strict") -> list[Event]:
    """Midlow zone (30-78 RPM) detection.

    Primary: DualTaskModel (forecast + recon, V7.5).
    Fallback: iTransformerForecast if DualTask weights not found.

    Uses DualTask-specific norm stats and thresholds when available.
    """
    arr, ts = _load_raw_dckey_features(data_path)
    if len(arr) < 50:
        return []

    arr_5min, ts_5min = _resample_forecast(arr, ts)
    if len(arr_5min) <= FCAST_SEQ_LEN + FCAST_HORIZON:
        return []

    # ── Try DualTask first ──
    is_dualtask = False
    try:
        dt_model = _load_midlow_dualtask_model()
        if dt_model is not None:
            model, norm_stats = dt_model
            is_dualtask = True
            logger.info("Midlow: using DualTask model")
        else:
            model, norm_stats = _load_midlow_forecast_model()
            logger.info("Midlow: DualTask model not found, using iTransformer")
    except Exception as e:
        logger.warning("Midlow model load failed: %s", e)
        return []

    arr_norm = _normalize_forecast(arr_5min, norm_stats)

    # Get zone threshold
    if is_dualtask:
        try:
            with open(MIDLOW_DIR / "dualtask_zone_thresholds.json") as f:
                zt_data = json.load(f)
            zone_p95 = zt_data.get("midlow", {}).get("p95_raw", 0.883)
        except:
            zone_p95 = 0.883  # experiment P95 as default
    else:
        with open(MIDLOW_DIR / "itrans_zone_thresholds.json") as f:
            zt_data = json.load(f)
        zone_p95 = zt_data.get("midlow", {}).get("p95", 0.823)

    # Create windows
    X = _create_forecast_windows(arr_norm)
    if len(X) == 0:
        return []

    # V7.8.5 fix: 缓存 per_feature_mae 到循环外，避免每窗口重复读磁盘
    _midlow_pf_mae = None
    if not is_dualtask:
        try:
            with open(MIDLOW_DIR / "per_feature_mae.json") as f:
                _feat_err = json.load(f)
            _midlow_pf_mae = np.array(_feat_err["per_feature_mae"], dtype=np.float32)
        except Exception:
            _midlow_pf_mae = None

    n_windows = len(X)
    scores = np.full(n_windows, np.nan, dtype=np.float32)
    batch_size = 128

    rpm_actual = arr_norm[:, 0] * float(norm_stats["stds"][0]) + float(norm_stats["means"][0])

    with torch.no_grad():
        for start in range(0, n_windows, batch_size):
            end = min(start + batch_size, n_windows)
            batch = torch.tensor(X[start:end], dtype=torch.float32, device=DEVICE)
            if is_dualtask:
                pred, _ = model(batch)  # DualTask returns (forecast, recon)
            else:
                pred = model(batch)     # iTransformer returns forecast
            for j in range(start, end):
                future_slice = arr_norm[j + FCAST_SEQ_LEN: j + FCAST_SEQ_LEN + FCAST_HORIZON, :]
                if len(future_slice) < FCAST_HORIZON:
                    continue
                future = torch.tensor(future_slice.T[np.newaxis, :, :],
                                      dtype=torch.float32, device=DEVICE)
                p = pred[j - start:j - start + 1]
                mae = (p - future).abs().mean(dim=2).cpu().numpy()[0]
                # DualTask: raw MAE (experiment scoring). Baseline: per-feature normalized.
                if is_dualtask:
                    scores[j] = float(mae.mean())
                else:
                    # V7.8.5 fix: per_feature_mae 已在循环外缓存
                    if _midlow_pf_mae is not None:
                        scores[j] = float((mae / (_midlow_pf_mae + 1e-8)).mean())
                    else:
                        scores[j] = float(mae.mean())

    valid_mask = ~np.isnan(scores)
    if valid_mask.sum() < 3:
        return []

    sens_mult = FCAST_SENS_MULT.get(sensitivity, 1.0)
    threshold = zone_p95 * sens_mult

    events = []
    in_event = False
    ev_start = 0

    for i in range(n_windows):
        # Only score windows in the 30-78 RPM range (midlow zone)
        if i < len(rpm_actual):
            rpm_at = float(rpm_actual[i])
            if not (30 <= rpm_at < 78):
                anom = False
            elif np.isnan(scores[i]):
                anom = False
            else:
                anom = scores[i] > threshold
        else:
            anom = False

        if anom and not in_event:
            in_event = True; ev_start = i
        elif not anom and in_event:
            in_event = False
            if i - ev_start >= 2:
                rpm_at = float(rpm_actual[ev_start]) if ev_start < len(rpm_actual) else 0
                events.append(_make_forecast_event(
                    ev_start, i, scores, None, ts_5min,
                    model_name=f"itrans_midlow_{rpm_at:.0f}rpm"
                ))

    if in_event and n_windows - ev_start >= 2:
        events.append(_make_forecast_event(
            ev_start, n_windows, scores, None, ts_5min,
            model_name=f"itrans_midlow_end"
        ))

    logger.info("Midlow-Fcast: %d events, max_score=%.1f, n=%d",
                len(events), float(np.nanmax(scores)), n_windows)
    return events


def detect_nf_midlow(data_path: str | Path,
                     sensitivity: str = "strict") -> list[Event]:
    """Midlow zone (30-78 RPM) NF density detection."""
    arr, ts = _load_raw_dckey_features(data_path)
    if len(arr) < 20:
        return []

    arr_5min, ts_5min = _resample_forecast(arr, ts)
    if len(arr_5min) < 5:
        return []

    try:
        model, zone_data = _load_midlow_nf_model()
    except Exception as e:
        logger.warning("Midlow NF model load failed: %s", e)
        return []

    with open(MIDLOW_DIR / "norm_stats.json") as f:
        norm_stats = json.load(f)
    arr_norm = _normalize_forecast(arr_5min, norm_stats)

    # Midlow zone p5 threshold
    zt = zone_data.get("midlow", {})
    thresh_anom = zt.get("p5", 44.9)  # higher = more anomalous

    sens_mult = {"strict": 1.0, "normal": 0.85, "relaxed": 0.70}.get(sensitivity, 1.0)
    threshold = thresh_anom * sens_mult

    rpm_actual = arr_norm[:, 0] * float(norm_stats["stds"][0]) + float(norm_stats["means"][0])

    with torch.no_grad():
        lp = model.log_prob(torch.tensor(arr_norm, dtype=torch.float32, device=DEVICE)).cpu().numpy()
    scores = -lp  # higher = more anomalous

    events = []
    in_event = False
    ev_start = 0

    for i in range(len(scores)):
        # Only consider 30-78 RPM points (filter out edges from resampling)
        rpm = float(rpm_actual[i]) if i < len(rpm_actual) else 999
        if 30 <= rpm < 78:
            anom = scores[i] > threshold
        else:
            anom = False

        if anom and not in_event:
            in_event = True; ev_start = i
        elif not anom and in_event:
            in_event = False
            if i - ev_start >= 2:
                events.append(_make_nf_event(
                    ev_start, i, scores, ts_5min,
                    model_name="nf_midlow",
                    low_confidence_reason="dl_nf_midlow",
                ))

    if in_event and len(scores) - ev_start >= 2:
        events.append(_make_nf_event(
            ev_start, len(scores), scores, ts_5min,
            model_name="nf_midlow",
            low_confidence_reason="dl_nf_midlow",
        ))

    logger.info("Midlow-NF: %d events, max_score=%.0f", len(events),
                float(scores.max()) if len(scores) > 0 else 0)
    return events


# ===================================================================
# Normalizing Flow on same 50 DC Key features as forecasting iTransformer.
# Trained on DB full data (Jan-May, balanced, 5min).
# Log-likelihood: lower = more anomalous.
# Complementary to iTransformer: NF = spatial density, iTrans = temporal pred
# ===================================================================

NF_FORECAST_DIR = BASE_DIR / "data" / "nf_forecast"

NF_ZONE_P5_FALLBACK = {
    "cruise":         -10.2,   # RPM ≥ 93,   n=645 ✅
    "maneuver_high":  -22.3,   # RPM 78-93,  n=225 ✅
    "maneuver_mid":   -9999,   # RPM 60-78,  跳过 → 由 midlow NF 处理
    "low":            -9999,   # RPM 30-60,  跳过 → 由 midlow NF 处理
    "midlow":          46.0,   # RPM 30-78,  n=3511 ✅ (专用midlow模型, neg_log_prob)
    "skip":           -9999,   # RPM < 30 (no training data)
}

NF_SENS_MULT = {"strict": 1.0, "normal": 0.85, "relaxed": 0.70}
NF_FORECAST_ACTIVE_ZONES = {"cruise", "maneuver_high"}


def _nf_anomaly_score(log_prob):
    """Convert NF log probability to the unified anomaly score.

    Unified convention: higher score means more anomalous.
    """
    return -np.asarray(log_prob)


def _nf_anomaly_threshold(p5_log_prob: float, sensitivity: str = "strict") -> float:
    """Convert a log_prob p5 threshold to anomaly_score space."""
    return -float(p5_log_prob) * NF_SENS_MULT.get(sensitivity, 1.0)


def _load_nf_zone_p5(threshold_path: Path | None = None) -> dict[str, float | None]:
    """Load NF Forecast p5 thresholds from file.

    The JSON stores log_prob-space p5 values. Only cruise and maneuver_high are
    enabled here; lower RPM zones are explicitly left to the dedicated Midlow NF.
    """
    threshold_path = threshold_path or (NF_FORECAST_DIR / "nf_zone_thresholds.json")
    zone_p5: dict[str, float | None] = {
        "cruise": NF_ZONE_P5_FALLBACK["cruise"],
        "maneuver_high": NF_ZONE_P5_FALLBACK["maneuver_high"],
        "maneuver_mid": None,
        "low": None,
        "skip": None,
    }

    try:
        with open(threshold_path, encoding="utf-8") as f:
            raw = json.load(f)
    except FileNotFoundError:
        logger.warning("NF Forecast threshold file not found, using fallback: %s", threshold_path)
        return zone_p5

    for zone in NF_FORECAST_ACTIVE_ZONES:
        info = raw.get(zone)
        if isinstance(info, dict) and "p5" in info:
            zone_p5[zone] = float(info["p5"])
        elif isinstance(info, (int, float)):
            zone_p5[zone] = float(info)

    return zone_p5


class _CouplingLayer(nn.Module):
    def __init__(self, dim, hidden_dim=64, max_scale=0.5, dropout=0.1, reverse=False):
        super().__init__()
        self.reverse = reverse
        self.split_size = dim // 2
        d2 = dim - self.split_size
        self.net = nn.Sequential(
            nn.Linear(self.split_size, hidden_dim), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(hidden_dim, d2 * 2),
        )
        self.max_scale = max_scale
    def forward(self, x):
        if self.reverse:
            x1, x2 = x[:, self.split_size:], x[:, :self.split_size]
        else:
            x1, x2 = x[:, :self.split_size], x[:, self.split_size:]
        params = self.net(x1); s, b = params.chunk(2, dim=-1)
        s = torch.tanh(s) * self.max_scale
        y2 = x2 * torch.exp(s) + b
        ld = s.sum(dim=-1)
        if self.reverse:
            return torch.cat([y2, x1], dim=-1), ld
        return torch.cat([x1, y2], dim=-1), ld


class _NFModel(nn.Module):
    def __init__(self, dim, n_layers=6, hidden_dim=64, max_scale=0.5, dropout=0.1):
        super().__init__()
        self.dim = dim
        self.layers = nn.ModuleList([
            _CouplingLayer(dim, hidden_dim, max_scale, dropout, reverse=(i % 2 == 1))
            for i in range(n_layers)
        ])
        self.register_buffer("base_mean", torch.zeros(dim))
        self.register_buffer("base_std", torch.ones(dim))
    def forward(self, x):
        ld = 0; z = x
        for layer in self.layers:
            z, d = layer(z); ld += d
        return z, ld
    def log_prob(self, x):
        z, ld = self.forward(x)
        lp = -0.5 * ((z - self.base_mean) / self.base_std).pow(2).sum(dim=-1)
        lp -= 0.5 * self.dim * 1.837877
        lp -= self.base_std.log().sum()
        return lp + ld


_NF_CACHE: dict = {}


def _load_nf_model() -> tuple[nn.Module, dict]:
    if "nf" in _NF_CACHE:
        return _NF_CACHE["nf"]
    ckpt = torch.load(NF_FORECAST_DIR / "nf_best.pt", map_location=DEVICE, weights_only=False)
    model = _NFModel(dim=ckpt["dim"], n_layers=ckpt["n_layers"], hidden_dim=ckpt["hidden_dim"],
                    max_scale=ckpt["max_scale"], dropout=ckpt["dropout"])
    model.load_state_dict(ckpt["model_state_dict"])
    model.to(DEVICE).eval()
    zone_p5 = _load_nf_zone_p5()
    _NF_CACHE["nf"] = (model, zone_p5)
    return model, zone_p5


def detect_nf(data_path: str | Path, sensitivity: str = "strict") -> list[Event]:
    """Full-condition NF density detection (50 DC Key features, 5min)."""
    arr, ts = _load_raw_dckey_features(data_path)
    if len(arr) < 20:
        return []

    arr_5min, ts_5min = _resample_forecast(arr, ts)
    if len(arr_5min) < 5:
        return []

    try:
        model, zone_p5 = _load_nf_model()
    except Exception as e:
        logger.warning("NF model load failed: %s", e)
        return []

    with open(NF_FORECAST_DIR / "norm_stats.json") as f:
        norm_stats = json.load(f)
    arr_norm = _normalize_forecast(arr_5min, norm_stats)

    rpm_actual = arr_norm[:, 0] * float(norm_stats["stds"][0]) + float(norm_stats["means"][0])

    with torch.no_grad():
        log_probs = model.log_prob(torch.tensor(arr_norm, dtype=torch.float32)).numpy()
    scores = _nf_anomaly_score(log_probs)

    events = []
    in_event = False
    ev_start = 0

    for i in range(len(scores)):
        rpm = rpm_actual[i] if i < len(rpm_actual) else 0
        if rpm >= 93: th = zone_p5.get("cruise")
        elif rpm >= 78: th = zone_p5.get("maneuver_high")
        elif rpm >= 60: th = zone_p5.get("maneuver_mid")
        elif rpm >= 30: th = zone_p5.get("low")
        else:
            # RPM < 30 filtered upstream; skip any leak-through
            th = zone_p5.get("skip")
        anom = False
        if th is not None:
            threshold = _nf_anomaly_threshold(float(th), sensitivity)
            anom = scores[i] > threshold

        if anom and not in_event:
            in_event = True; ev_start = i
        elif not anom and in_event:
            in_event = False
            if i - ev_start >= 2:
                events.append(_make_nf_event(ev_start, i, scores, ts_5min))

    if in_event and len(scores) - ev_start >= 2:
        events.append(_make_nf_event(ev_start, len(scores), scores, ts_5min))

    logger.info("NF: %d events, max_score=%.0f", len(events), float(scores.max()) if len(scores) > 0 else 0)
    return events


def _make_nf_event(
    ev_start,
    ev_end,
    scores,
    ts_5min,
    model_name: str = "nf_forecast",
    low_confidence_reason: str = "dl_nf_fullcondition",
):
    ev_scores = scores[ev_start:ev_end]
    max_score = float(np.max(ev_scores))
    abs_z = max_score / 30.0

    if ts_5min is not None:
        t_start = str(ts_5min[ev_start]) if ev_start < len(ts_5min) else ""
        t_end = str(ts_5min[min(ev_end, len(ts_5min)-1)]) if ev_end <= len(ts_5min) else ""
        try:
            duration = (pd.Timestamp(t_end) - pd.Timestamp(t_start)).total_seconds() / 60.0
        except:
            duration = float((ev_end - ev_start) * 5.0)
    else:
        t_start = t_end = ""; duration = float((ev_end - ev_start) * 5.0)

    severity = Level.COMODAL
    if abs_z >= 3.0 and duration >= 10: severity = Level.HIGH  # V8.1: demoted
    elif abs_z >= 2.0: severity = Level.COMODAL

    return Event(
        id="", level=severity, channel=Channel.DL,
        type=f"dl_{model_name}",
        sensors=[model_name], groups=[],
        time_start=t_start, time_end=t_end,
        duration_min=round(duration, 1),
        max_z=round(abs_z, 2),
        severity=round(float(max_score), 2),
        confirmed=severity == Level.CONFIRMED,
        low_confidence=severity == Level.COMODAL,
        low_confidence_reason=low_confidence_reason,
    )

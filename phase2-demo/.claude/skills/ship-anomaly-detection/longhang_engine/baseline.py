"""
船舶主机异常检测 — 基线建模 V7.8.5
=================================
三通道多项式回归基线。

输入：JSON 数据路径 → 输出：dict 基线模型。
仅加载稳定工况（RPM ≥ 稳定阈值），对每个传感器组建立回归模型。
"""

import logging
import pickle
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures

from .config import (
    DEFAULT_THRESHOLDS, MIN_STD_BY_GROUP, ROW_MEAN_GROUPS, ROW_MEAN_MIN_STD,
    FEATURE_FALLBACK, SCAVENGE_FEATURE_FALLBACK,
    EXHAUST_CYL_SENSOR_GROUPS,
)
from .loader import load_data, get_monitor_params, auto_detect_groups

logger = logging.getLogger(__name__)

# ── 多项式回归建模 ─────────────────────────────────────────────────────

def _build_poly_regression(
    data: pd.DataFrame, target_col: str, feature_cols: list[str], degree: int = 2,
) -> tuple:
    """多项式回归训练。返回 (reg, poly, residual_std, residual_mean) 或 4×None。"""
    cols = feature_cols + [target_col]
    clean = data[cols].dropna()
    if len(clean) < 100:
        return None, None, None, None
    X = clean[feature_cols].values
    y = clean[target_col].values
    poly = PolynomialFeatures(degree=degree, include_bias=True)
    X_poly = poly.fit_transform(X)
    reg = LinearRegression().fit(X_poly, y)
    res = y - reg.predict(X_poly)
    return reg, poly, float(res.std()), float(res.mean())


def _find_best_features(
    data: pd.DataFrame, target_col: str, degree: int = 3,
    fallback_chain: list | None = None,
) -> tuple:
    """特征回退链：按优先级选择可行特征组合。"""
    chain = fallback_chain if fallback_chain is not None else FEATURE_FALLBACK
    for feat_name, feat_cols in chain:
        feat_cols = [c for c in feat_cols if c != target_col and c in data.columns]
        if not feat_cols:
            continue
        clean = data[feat_cols + [target_col]].dropna()
        if len(clean) >= 100:
            return feat_cols, feat_name, degree
    # 最终回退：仅 rpm
    if "rpm" in data.columns and target_col in data.columns:
        clean = data[["rpm", target_col]].dropna()
        if len(clean) >= 100:
            return ["rpm"], "rpm_only", degree
    return None, None, None


# ── 固有偏差 ───────────────────────────────────────────────────────────

def _compute_inherent_bias(df: pd.DataFrame, detected_groups: dict) -> dict:
    """从训练数据自动计算缸间固有偏差。"""
    bias: dict = {}
    for group_name in ("exhaust_temp", "scavenge_temp"):
        sensors = detected_groups.get(group_name, [])
        available = [s for s in sensors if s in df.columns]
        if len(available) < 2:
            continue
        vals = df[available].values
        row_mean = vals.mean(axis=1, keepdims=True)
        deviation = vals - row_mean
        for i, sensor in enumerate(available):
            bias[sensor] = round(float(deviation[:, i].mean()), 2)
    return bias


# ── 通道建模 ───────────────────────────────────────────────────────────

def _build_ch1_models(
    stable_df: pd.DataFrame, cfg: dict, detected_groups: dict, bias: dict,
) -> dict:
    """
    通道1：缸间一致性。
    对同组每缸做 RPM 回归 → 残差 → 对齐后减行均值 → 每缸偏差 std。
    """
    models: dict = {}
    n_samples = len(stable_df)
    for group_name in EXHAUST_CYL_SENSOR_GROUPS:
        sensors = detected_groups.get(group_name, [])
        if len(sensors) < 2:
            continue
        is_scav = group_name == "scavenge_temp"
        # 从传感器列表中提取缸号传感器（在 registry 中注册的）
        from .utils import extract_cylinder
        cyl_sensors = [s for s in sensors if extract_cylinder([s]) is not None]
        if len(cyl_sensors) < 2:
            # 缸号传感器不足2个，无法做缸间一致性，跳过该组
            continue
        available = [s for s in cyl_sensors if s in stable_df.columns]
        if len(available) < 2:
            continue

        # 第一步：逐缸 RPM 回归 → 残差
        group_regs: dict = {}
        group_residuals: dict = {}
        for sensor in available:
            degree = cfg["poly_degree_exh"] if group_name == "exhaust_temp" else cfg["poly_degree_other"]
            if group_name == "exhaust_temp" and n_samples < 300:
                degree = min(degree, 2)
            if group_name == "scavenge_temp":
                feat_cols, fn, deg = _find_best_features(stable_df, sensor, degree, SCAVENGE_FEATURE_FALLBACK)
            else:
                feat_cols, fn, deg = _find_best_features(stable_df, sensor, degree, [("rpm_only", ["rpm"])])
            if feat_cols is None:
                continue
            reg, poly, bstd, bmean = _build_poly_regression(stable_df, sensor, feat_cols, deg)
            if reg is None:
                continue
            group_regs[sensor] = (reg, poly, feat_cols, fn)
            clean = stable_df[feat_cols + [sensor]].dropna()
            if len(clean) >= 50:
                Xp = poly.transform(clean[feat_cols].values)
                res = clean[sensor].values - bias.get(sensor, 0) - reg.predict(Xp)
                group_residuals[sensor] = pd.Series(res, index=clean.index)

        if len(group_residuals) < 2:
            continue

        # 第二步：对齐后减行均值 → 缸间偏差
        res_df = pd.DataFrame(group_residuals)
        common_idx = res_df.dropna().index
        if len(common_idx) >= 100:
            row_mean = res_df.loc[common_idx].mean(axis=1)
            inter_cyl_dev = res_df.loc[common_idx].sub(row_mean, axis=0)
        else:
            row_mean = res_df.mean(axis=1, skipna=True)
            inter_cyl_dev = res_df.sub(row_mean, axis=0)

        # 第三步：保存每缸偏差统计量（带物理下限）
        group_min_std = MIN_STD_BY_GROUP.get(group_name, 0.5)
        for sensor in available:
            reg, poly, feat_cols, fn = group_regs.get(sensor, (None, None, None, None))
            if reg is None or sensor not in inter_cyl_dev.columns:
                continue
            dev_series = inter_cyl_dev[sensor].dropna()
            if len(dev_series) == 0:
                continue
            dev_std = max(float(dev_series.std()), group_min_std)
            dev_mean = float(dev_series.mean())
            models[sensor] = {
                "reg": reg, "poly": poly, "std": dev_std, "mean": dev_mean,
                "feature_cols": feat_cols, "feature_name": fn,
                "group": group_name, "group_sensors": available,
                "is_inter_cyl": True,
            }
    return models


def _build_ch2_models(
    stable_df: pd.DataFrame, cfg: dict, detected_groups: dict,
) -> dict:
    """通道2：绝对值自回归。每个传感器独立 RPM 回归。"""
    models: dict = {}
    n_samples = len(stable_df)
    for group_name in ["exhaust_temp", "scavenge_temp", "cfw_outlet", "piston_lo",
                        "rpm", "turbo_lo", "damper_lo", "bearing_temp",
                        "independent_temp", "control_air", "fuel_oil",
                        "servo_oil", "scavenge_press"]:
        sensors = detected_groups.get(group_name, [])
        if not sensors:
            continue
        if group_name == "rpm":
            sensors = [s for s in sensors if s != "rpm"]
            if not sensors:
                continue
        is_scav = group_name == "scavenge_temp"
        is_exh = group_name == "exhaust_temp"
        for sensor in sensors:
            degree = cfg["poly_degree_exh"] if is_exh else cfg["poly_degree_other"]
            if is_exh and n_samples < 300:
                degree = min(degree, 2)
            chain = SCAVENGE_FEATURE_FALLBACK if is_scav else FEATURE_FALLBACK
            feat_cols, fn, deg = _find_best_features(stable_df, sensor, degree, chain)
            if feat_cols is None:
                continue
            reg, poly, bstd, bmean = _build_poly_regression(stable_df, sensor, feat_cols, deg)
            if reg is None:
                continue
            min_s = MIN_STD_BY_GROUP.get(group_name, 0.5)
            models[sensor] = {
                "reg": reg, "poly": poly,
                "std": max(bstd, min_s), "mean": bmean,
                "feature_cols": feat_cols, "feature_name": fn,
                "group": group_name, "degree": deg,
            }
    # 增压器传感器
    for tc_col in ("exh_before_turbo", "exh_after_turbo"):
        if tc_col not in stable_df.columns:
            continue
        feat_cols, fn, deg = _find_best_features(stable_df, tc_col, cfg["poly_degree_other"])
        if feat_cols:
            reg, poly, bstd, bmean = _build_poly_regression(stable_df, tc_col, feat_cols, deg)
            if reg:
                models[tc_col] = {
                    "reg": reg, "poly": poly,
                    "std": max(bstd, 0.5), "mean": bmean,
                    "feature_cols": feat_cols, "feature_name": fn,
                    "group": "turbocharger", "degree": deg,
                }
    return models


def _build_ch3_models(
    stable_df: pd.DataFrame, cfg: dict, detected_groups: dict,
) -> dict:
    """通道3：温差自回归。差温 = outlet - inlet，对差值做 RPM 回归。"""
    models: dict = {}
    deg = cfg["poly_degree_other"]

    # V7.8.5: 温差模型 std 物理下限 — 传感器精度约 0.1-0.3°C
    CH3_MIN_STD = 0.3

    # CFW 温差
    if "cfw_in_temp" in stable_df.columns:
        for sensor in detected_groups.get("cfw_outlet", []):
            if sensor not in stable_df.columns:
                continue
            dt = stable_df[sensor] - stable_df["cfw_in_temp"]
            stable_copy = stable_df.copy()
            name = f"cfw_dt_{sensor}"
            stable_copy[name] = dt
            reg, poly, bstd, bmean = _build_poly_regression(stable_copy, name, ["rpm"], deg)
            if reg is not None:
                models[name] = {
                    "reg": reg, "poly": poly,
                    "std": max(bstd, CH3_MIN_STD), "mean": bmean,
                    "feature_cols": ["rpm"], "degree": deg,
                    "outlet_col": sensor, "inlet_col": "cfw_in_temp",
                    "group": "cfw_outlet",
                }

    # 冷却油温差
    if "lo_main_temp" in stable_df.columns:
        for sensor in detected_groups.get("piston_lo", []):
            if sensor not in stable_df.columns:
                continue
            dt = stable_df[sensor] - stable_df["lo_main_temp"]
            stable_copy = stable_df.copy()
            name = f"oil_dt_{sensor}"
            stable_copy[name] = dt
            reg, poly, bstd, bmean = _build_poly_regression(stable_copy, name, ["rpm"], deg)
            if reg is not None:
                models[name] = {
                    "reg": reg, "poly": poly,
                    "std": max(bstd, CH3_MIN_STD), "mean": bmean,
                    "feature_cols": ["rpm"], "degree": deg,
                    "outlet_col": sensor, "inlet_col": "lo_main_temp",
                    "group": "piston_lo",
                }

    # 增压器排烟温差
    if "exh_before_turbo" in stable_df.columns and "exh_after_turbo" in stable_df.columns:
        stable_copy = stable_df.copy()
        stable_copy["tc_exh_dt"] = stable_copy["exh_before_turbo"] - stable_copy["exh_after_turbo"]
        reg, poly, bstd, bmean = _build_poly_regression(stable_copy, "tc_exh_dt", ["rpm"], deg)
        if reg is not None:
            models["tc_exh_dt"] = {
                "reg": reg, "poly": poly,
                "std": max(bstd, CH3_MIN_STD), "mean": bmean,
                "feature_cols": ["rpm"], "degree": deg,
                "outlet_col": "exh_before_turbo", "inlet_col": "exh_after_turbo",
                "group": "turbocharger",
            }

    # 空冷器温差
    if "ac_in_temp" in stable_df.columns and "ac_out_temp" in stable_df.columns:
        stable_copy = stable_df.copy()
        stable_copy["cooler_dt"] = stable_copy["ac_out_temp"] - stable_copy["ac_in_temp"]
        for feat_cols, fn in [(["rpm", "ac_in_temp"], "rpm_ac_in"), (["rpm"], "rpm_only")]:
            reg, poly, bstd, bmean = _build_poly_regression(stable_copy, "cooler_dt", feat_cols, deg)
            if reg is not None:
                models["cooler_dt"] = {
                    "reg": reg, "poly": poly,
                    "std": max(bstd, CH3_MIN_STD), "mean": bmean,
                    "feature_cols": feat_cols, "feature_name": fn,
                    "degree": deg,
                    "outlet_col": "ac_out_temp", "inlet_col": "ac_in_temp",
                    "group": "air_cooler",
                }
                break

    return models


# ── 行均值系统级模型 (V6.9) ───────────────────────────────────────────

def _build_row_mean_models(
    stable_df: pd.DataFrame, cfg: dict, detected_groups: dict,
) -> dict:
    """对多缸组计算行均值，对行均值做 RPM 回归 → 检测共模偏移。"""
    stats: dict = {}
    for group_name in ROW_MEAN_GROUPS:
        sensors = detected_groups.get(group_name, [])
        if len(sensors) < 2:
            continue
        available = [s for s in sensors if s in stable_df.columns]
        if len(available) < 2:
            continue
        row_mean = stable_df[available].mean(axis=1)
        rm_col = f"_row_mean_{group_name}"
        df2 = stable_df.copy()
        df2[rm_col] = row_mean
        is_exh = group_name == "exhaust_temp"
        degree = cfg["poly_degree_exh"] if is_exh else cfg["poly_degree_other"]
        if is_exh and len(stable_df) < 300:
            degree = min(degree, 2)
        reg, poly, bstd, bmean = _build_poly_regression(df2, rm_col, ["rpm"], degree)
        if reg is not None:
            eff_std = max(bstd, ROW_MEAN_MIN_STD.get(group_name, 0.5))
            stats[group_name] = {
                "reg": reg, "poly": poly,
                "std": eff_std, "raw_std": bstd, "mean": bmean,
                "feature_cols": ["rpm"], "degree": degree,
                "sensors": available,
                "n_points": len(df2[[rm_col, "rpm"]].dropna()),
            }
    return stats


# ── 计算接口 ───────────────────────────────────────────────────────────

def _compute_residual_z(
    df_slice: pd.DataFrame, target_col: str,
    reg, poly, base_std: float, base_mean: float,
    feature_cols: list[str],
) -> pd.Series:
    """计算回归残差的 |z-score|。返回 Series (index = df_slice 的 clean index)。"""
    if reg is None or base_std < 1e-6:
        return pd.Series(dtype=float)
    cols = feature_cols + [target_col]
    clean_idx = df_slice[cols].dropna().index
    if len(clean_idx) < 1:
        return pd.Series(dtype=float)
    X = df_slice.loc[clean_idx, feature_cols].values
    try:
        X_poly = poly.transform(X)
        y = df_slice.loc[clean_idx, target_col].values
        res = y - reg.predict(X_poly)
    except ValueError:
        y = df_slice.loc[clean_idx, target_col].values
        z = np.abs((y - base_mean) / base_std) if base_std > 1e-6 else np.zeros(len(y))
        return pd.Series(z, index=clean_idx)
    z = np.abs((res - base_mean) / base_std)
    return pd.Series(z, index=clean_idx)


# ── 公开入口 ───────────────────────────────────────────────────────────

def build_baseline(data_path: str | Path, save_path: str | None = None) -> dict:
    """建立三通道回归基线。

    Returns:
        dict: {
            "version": "7.1",
            "built_at": str,
            "n_rows": int, "stable_rows": int,
            "cfg": dict,
            "ch1": dict, "ch2": dict, "ch3": dict,
            "row_mean": dict, "inherent_bias": dict,
            "detected_groups": dict,
            "zone_baselines": dict,   # ← V7.1: RPM 分区基线
        }
    """
    cfg = dict(DEFAULT_THRESHOLDS)
    df = load_data(data_path)
    all_params = get_monitor_params(df)
    detected_groups = auto_detect_groups(df)

    rpm_min = cfg["rpm_stable_min"]
    stable_mask = df["rpm"] >= rpm_min
    stable_df = df[stable_mask].copy()
    logger.info("build_baseline: %d rows total, %d stable (rpm>=%d)", len(df), len(stable_df), rpm_min)

    if len(stable_df) < 500:
        logger.warning("build_baseline: insufficient stable data (%d rows)", len(stable_df))

    bias = _compute_inherent_bias(stable_df, detected_groups)

    # V7.1: 主基线（巡航 ≥93）
    baseline = {
        "version": "7.1",
        "built_at": datetime.now(timezone.utc).isoformat(),
        "n_rows": len(df),
        "stable_rows": len(stable_df),
        "cfg": cfg,
        "data_path": str(data_path),
        "params": all_params,
        "detected_groups": detected_groups,
        "inherent_bias": bias,
        "ch1": _build_ch1_models(stable_df, cfg, detected_groups, bias),
        "ch2": _build_ch2_models(stable_df, cfg, detected_groups),
        "ch3": _build_ch3_models(stable_df, cfg, detected_groups),
        "row_mean": _build_row_mean_models(stable_df, cfg, detected_groups),
    }

    # V7.1: RPM 分区基线 — 只为过渡/机动区间记录阈值放大系数
    # 不建独立回归模型（因为不同航次分布差异大），检测时用巡航模型 + 放大系数
    from .config import RPM_ZONES
    zone_baselines = {}
    for zid, lo, hi, z_mult, desc in RPM_ZONES:
        zone_baselines[zid] = {
            "z_mult": z_mult,
            "description": desc,
            "rpm_range": (lo, hi),
        }
    baseline["zone_baselines"] = zone_baselines

    n_sensors = len(baseline["ch1"]) + len(baseline["ch2"]) + len(baseline["ch3"])
    logger.info("build_baseline done: %d ch1, %d ch2, %d ch3 sensors (%d total)",
                len(baseline["ch1"]), len(baseline["ch2"]), len(baseline["ch3"]), n_sensors)

    if save_path:
        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        with open(save_path, "wb") as f:
            pickle.dump(baseline, f, protocol=5)
        logger.info("baseline saved to %s", save_path)

    return baseline


def load_baseline(path: str | Path) -> dict:
    """加载 pickle 基线。兼容 V6.x/V7.0 格式。"""
    with open(path, "rb") as f:
        baseline = pickle.load(f)
    if not isinstance(baseline, dict):
        raise ValueError(f"Invalid baseline format at {path}")
    logger.info("load_baseline: %s (v%s, %d ch1+ch2+ch3 sensors)",
                path, baseline.get("version", "?"),
                len(baseline.get("ch1", {})) + len(baseline.get("ch2", {})) + len(baseline.get("ch3", {})))
    return baseline

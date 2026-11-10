"""
船舶主机健康分析 - 数据统计与物理关系计算
只算数，不做判定。所有判断交给Agent + wiki知识。

输出结构化数据供Agent层分析：
1. 基本统计（mean/std/min/max/trend）
2. 物理关系数据（RPM↔增压器转速、排温水平、缸间均衡等）
3. OEM安全限值参考（硬性物理极限）
"""

import json
import sys
import numpy as np
from pathlib import Path
from collections import OrderedDict

# ============ DC Key 映射 ============
DC_KEY_MAP = {
    "DC0001": "rpm",
    "DC0002": "增压器转速",
    "DC0003": "尾轴后轴承温度",
    "DC0004": "中间轴承温度",
    "DC0005": "起动空气压力",
    "DC0006": "控制空气压力",
    "DC0007": "控制空气压力safety",
    "DC0008": "1缸排气温度",
    "DC0009": "2缸排气温度",
    "DC0010": "3缸排气温度",
    "DC0011": "4缸排气温度",
    "DC0012": "5缸排气温度",
    "DC0013": "6缸排气温度",
    "DC0014": "1缸排气温度偏差",
    "DC0015": "2缸排气温度偏差",
    "DC0016": "3缸排气温度偏差",
    "DC0017": "4缸排气温度偏差",
    "DC0018": "5缸排气温度偏差",
    "DC0019": "6缸排气温度偏差",
    "DC0020": "增压器前排烟温度",
    "DC0021": "增压器后排烟温度",
    "DC0022": "1缸扫气温度",
    "DC0023": "2缸扫气温度",
    "DC0024": "3缸扫气温度",
    "DC0025": "4缸扫气温度",
    "DC0026": "5缸扫气温度",
    "DC0027": "6缸扫气温度",
    "DC0028": "滑油进主轴承压力",
    "DC0029": "滑油进主轴承温度",
    "DC0030": "推力轴承滑油出口温度",
    "DC0031": "1缸活塞冷却油出口温度",
    "DC0032": "2缸活塞冷却油出口温度",
    "DC0033": "3缸活塞冷却油出口温度",
    "DC0034": "4缸活塞冷却油出口温度",
    "DC0035": "5缸活塞冷却油出口温度",
    "DC0036": "6缸活塞冷却油出口温度",
    "DC0037": "增压器滑油压力",
    "DC0038": "增压器滑油温度",
    "DC0039": "前端阻尼器滑油压力",
    "DC0040": "后端阻尼器滑油压力",
    "DC0041": "燃油进机压力",
    "DC0042": "燃油进机温度",
    "DC0043": "伺服油泄漏",
    "DC0044": "缸套冷却水进口压力",
    "DC0045": "缸套冷却水进口温度",
    "DC0046": "1缸冷却淡水出口温度",
    "DC0047": "2缸冷却淡水温度",
    "DC0048": "3缸冷却淡水出口温度",
    "DC0049": "4缸冷却淡水出口温度",
    "DC0050": "5缸冷却淡水出口温度",
    "DC0051": "6缸冷却淡水出口温度",
    "DC0052": "空冷器冷却水进口温度",
    "DC0053": "空冷器冷却水出口温度",
    "DC0054": "伺服油压力1",
    "DC0055": "伺服油压力2",
    "DC0056": "燃油共轨压力1",
    "DC0057": "燃油共轨压力2",
    "DC0058": "燃油指令",
    "DC0059": "扫气空气进总管压力",
}

# ============ 系统分组 ============
SYSTEM_GROUPS = OrderedDict({
    "排气系统": {
        "sensors": [
            "1缸排气温度", "2缸排气温度", "3缸排气温度",
            "4缸排气温度", "5缸排气温度", "6缸排气温度",
            "1缸排气温度偏差", "2缸排气温度偏差", "3缸排气温度偏差",
            "4缸排气温度偏差", "5缸排气温度偏差", "6缸排气温度偏差",
            "增压器前排烟温度", "增压器后排烟温度",
        ],
        "multi_cylinder_groups": ["排气温度", "排气温度偏差"],
    },
    "增压系统": {
        "sensors": ["增压器转速", "增压器滑油压力", "增压器滑油温度", "扫气空气进总管压力"],
        "multi_cylinder_groups": [],
    },
    "冷却系统": {
        "sensors": [
            "缸套冷却水进口温度", "缸套冷却水进口压力",
            "1缸冷却淡水出口温度", "2缸冷却淡水出口温度", "3缸冷却淡水出口温度",
            "4缸冷却淡水出口温度", "5缸冷却淡水出口温度", "6缸冷却淡水出口温度",
            "空冷器冷却水进口温度", "空冷器冷却水出口温度",
        ],
        "multi_cylinder_groups": ["冷却淡水出口温度"],
    },
    "活塞冷却系统": {
        "sensors": [
            "1缸活塞冷却油出口温度", "2缸活塞冷却油出口温度", "3缸活塞冷却油出口温度",
            "4缸活塞冷却油出口温度", "5缸活塞冷却油出口温度", "6缸活塞冷却油出口温度",
        ],
        "multi_cylinder_groups": ["活塞冷却油出口温度"],
    },
    "燃油系统": {
        "sensors": ["燃油进机温度", "燃油进机压力", "燃油共轨压力1", "燃油共轨压力2", "燃油指令"],
        "multi_cylinder_groups": [],
    },
    "伺服油系统": {
        "sensors": ["伺服油压力1", "伺服油压力2", "伺服油泄漏"],
        "multi_cylinder_groups": [],
    },
    "轴系": {
        "sensors": ["尾轴后轴承温度", "中间轴承温度", "推力轴承滑油出口温度"],
        "multi_cylinder_groups": [],
    },
    "滑油系统": {
        "sensors": ["滑油进主轴承压力", "滑油进主轴承温度", "前端阻尼器滑油压力", "后端阻尼器滑油压力"],
        "multi_cylinder_groups": [],
    },
})

# 多缸组的传感器映射
CYLINDER_GROUPS = {
    "排气温度": ["1缸排气温度", "2缸排气温度", "3缸排气温度", "4缸排气温度", "5缸排气温度", "6缸排气温度"],
    "排气温度偏差": ["1缸排气温度偏差", "2缸排气温度偏差", "3缸排气温度偏差", "4缸排气温度偏差", "5缸排气温度偏差", "6缸排气温度偏差"],
    "扫气温度": ["1缸扫气温度", "2缸扫气温度", "3缸扫气温度", "4缸扫气温度", "5缸扫气温度", "6缸扫气温度"],
    "冷却淡水出口温度": ["1缸冷却淡水出口温度", "2缸冷却淡水出口温度", "3缸冷却淡水出口温度", "4缸冷却淡水出口温度", "5缸冷却淡水出口温度", "6缸冷却淡水出口温度"],
    "活塞冷却油出口温度": ["1缸活塞冷却油出口温度", "2缸活塞冷却油出口温度", "3缸活塞冷却油出口温度", "4缸活塞冷却油出口温度", "5缸活塞冷却油出口温度", "6缸活塞冷却油出口温度"],
}

# OEM安全限值（硬性物理极限，来源wiki第6章）
# Agent用这个做参考判断，不做自动判定
OEM_SAFETY_LIMITS = {
    # 传感器名: {"high": 报警值, "shutdown": 停机值}  (仅列出有明确报警的)
    "排气温度": {"alarm": 515, "note": "各缸排气总管最高515°C, 偏差±50°C"},
    "冷却淡水出口温度": {"alarm": 90, "slowdown": None, "note": "出口各缸ALM H 90°C"},
    "活塞冷却油出口温度": {"alarm": 80, "slowdown": 85, "note": "ALM H 80°C, SLD 85°C"},
    "推力轴承滑油出口温度": {"alarm": 65, "slowdown": 70, "shutdown": 85, "note": "ALM 65, SLD 70, SHD 85°C"},
    "增压器滑油温度": {"alarm": 110, "slowdown": 120, "note": "ABB TPL内部供油: ALM 110, SLD 120°C"},
    "缸套冷却水进口压力": {"alarm_low": 2.0, "slowdown_low": 1.8, "shutdown_low": 1.5, "unit": "bar", "note": "ALM L 2bar, SLD 1.8, SHD 1.5bar"},
    "滑油进主轴承压力": {"alarm_low": 5.0, "slowdown_low": 4.8, "shutdown_low": 4.3, "unit": "bar"},
    "增压器滑油压力": {"alarm_low": 1.0, "slowdown_low": 0.8, "shutdown_low": 0.6, "unit": "bar", "note": "ABB TPL内部供油"},
}


def _load_json(path):
    """解析终端采集JSON格式"""
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    rows = []
    for entry in raw.get("data", []):
        row = {}
        row["timestamp"] = entry.get("terminalTime", "")

        asi = entry.get("asi", {})
        if asi:
            for k in ["lat", "lon", "sog", "cog", "hdg"]:
                v = asi.get(k, "")
                try:
                    row[f"ais_{k}"] = float(v) if v else None
                except (ValueError, TypeError):
                    row[f"ais_{k}"] = None

        env = entry.get("environment", {})
        if env:
            for ek, ev in env.items():
                mapping = {"airTemp": "ais_air_temp", "windSpeed": "ais_wind_speed", "waveHeight": "ais_wave_height"}
                col = mapping.get(ek, ek)
                try:
                    row[col] = float(ev) if ev else None
                except (ValueError, TypeError):
                    row[col] = None

        for sl_wrapper in entry.get("sensorList", []):
            for sensor in sl_wrapper.get("sensorList", []):
                key = sensor.get("key", "")
                value = sensor.get("value", "")
                col_name = DC_KEY_MAP.get(key, key)
                try:
                    row[col_name] = float(value) if value != "" else None
                except (ValueError, TypeError):
                    row[col_name] = None
        rows.append(row)

    return rows


def _calc_trend(values):
    """线性回归趋势：返回 (累计变化百分比, 方向)
    注意：返回的是整个观测窗口内的总变化率(%), 而非每小时变化率。
    计算方式: |slope| × 数据点数 / |均值| × 100
    """
    arr = np.array(values, dtype=float)
    mask = ~np.isnan(arr)
    arr = arr[mask]
    if len(arr) < 5:
        return 0.0, "insufficient_data"
    x = np.arange(len(arr), dtype=float)
    slope, _ = np.polyfit(x, arr, 1)
    mean_val = np.mean(arr)
    if abs(mean_val) < 1e-6:
        return 0.0, "stable"
    # 整个观测窗口内的累计变化百分比(%)，非每小时变化率
    total_change_pct = abs(slope) * len(arr) / abs(mean_val) * 100
    if total_change_pct > 2:
        direction = "rising" if slope > 0 else "falling"
    else:
        direction = "stable"
    return round(total_change_pct, 2), direction


def _sensor_stats(values):
    """计算单个传感器的统计量"""
    arr = np.array(values, dtype=float)
    mask = ~np.isnan(arr)
    arr = arr[mask]
    if len(arr) < 2:
        return None
    mean = float(np.mean(arr))
    std = float(np.std(arr, ddof=1))  # 样本标准差
    cv = (std / abs(mean) * 100) if abs(mean) > 1e-6 else None
    trend_pct, trend_dir = _calc_trend(values)
    return {
        "mean": round(mean, 2),
        "std": round(std, 2),
        "cv": round(cv, 2) if cv is not None else None,
        "min": round(float(np.min(arr)), 2),
        "max": round(float(np.max(arr)), 2),
        "trend_total_change_pct": trend_pct,
        "trend": trend_dir,
        "sampleCount": len(arr),
    }


def _calc_cylinder_balance(df_dict, group_name, sensor_names):
    """计算缸间均衡性"""
    values_by_cyl = {}
    for name in sensor_names:
        if name in df_dict:
            arr = np.array([v for v in df_dict[name] if v is not None], dtype=float)
            if len(arr) > 0:
                values_by_cyl[name] = float(np.mean(arr))

    if len(values_by_cyl) < 3:
        return None

    means = list(values_by_cyl.values())
    grand_mean = np.mean(means)
    if abs(grand_mean) < 1e-6:
        return None

    inter_cv = np.std(means) / abs(grand_mean) * 100
    worst_cyl = max(values_by_cyl, key=lambda k: abs(values_by_cyl[k] - grand_mean))
    worst_dev = values_by_cyl[worst_cyl] - grand_mean
    worst_dev_pct = abs(worst_dev) / abs(grand_mean) * 100

    return {
        "group": group_name,
        "interCylinderCV": round(inter_cv, 2),
        "groupMean": round(grand_mean, 2),
        "cylinderMeans": {k: round(v, 2) for k, v in values_by_cyl.items()},
        "worstCylinder": worst_cyl,
        "worstDeviation": round(worst_dev, 2),
        "worstDeviationPercent": round(worst_dev_pct, 2),
    }


def _calc_physical_relationships(df_dict, stats):
    """计算物理关系数据 — 核心价值，交给Agent判断"""
    relationships = {}

    rpm_stats = stats.get("rpm")
    if not rpm_stats:
        return relationships

    rpm_mean = rpm_stats["mean"]

    # 1. RPM ↔ 增压器转速
    tc_stats = stats.get("增压器转速")
    if tc_stats and tc_stats["mean"] > 100:  # 排除停机
        ratio = tc_stats["mean"] / rpm_mean if rpm_mean > 0 else 0
        relationships["rpm_to_turbocharger"] = {
            "rpm": rpm_mean,
            "turboRPM": tc_stats["mean"],
            "ratio": round(ratio, 1),
            "note": "正常比例约70-120倍（cruise约110倍, maneuver约70倍）",
        }

    # 2. 排温水平（6缸均值）
    exhaust_means = []
    for i in range(1, 7):
        s = stats.get(f"{i}缸排气温度")
        if s:
            exhaust_means.append(s["mean"])
    if exhaust_means and rpm_mean > 0:
        relationships["exhaust_temp_level"] = {
            "rpm": rpm_mean,
            "avgExhaustTemp": round(np.mean(exhaust_means), 1),
            "range": f"{min(exhaust_means):.0f}~{max(exhaust_means):.0f}",
            "note": "RPM 100时正常约300-400°C, RPM 70时约200-280°C",
        }

    # 3. 扫气压力 vs RPM
    scavenge_stats = stats.get("扫气空气进总管压力")
    if scavenge_stats:
        relationships["scavenge_vs_rpm"] = {
            "rpm": rpm_mean,
            "scavengePressure": scavenge_stats["mean"],
            "note": "RPM 100时约0.7-0.95 bar, RPM 70时约0.2-0.4 bar",
        }

    # 4. 燃油指令 vs 排温
    fuel_idx_stats = stats.get("燃油指令")
    if fuel_idx_stats and exhaust_means:
        relationships["fuel_vs_exhaust"] = {
            "fuelIndex": fuel_idx_stats["mean"],
            "avgExhaustTemp": round(np.mean(exhaust_means), 1),
            "note": "燃油指令高→排温高, 37%对应约300-350°C",
        }

    # 5. 冷却水温差
    cfw_in = stats.get("缸套冷却水进口温度")
    cfw_outs = []
    for i in range(1, 7):
        s = stats.get(f"{i}缸冷却淡水出口温度")
        if s:
            cfw_outs.append((i, s["mean"]))
    if cfw_in and cfw_outs:
        avg_out = np.mean([v for _, v in cfw_outs])
        delta = avg_out - cfw_in["mean"]
        relationships["cooling_water_delta"] = {
            "inlet": cfw_in["mean"],
            "avgOutlet": round(avg_out, 1),
            "delta": round(delta, 1),
            "perCylinder": {f"{i}缸": round(v, 1) for i, v in cfw_outs},
            "note": "正常温差约5-15°C, wiki: 进口65-80°C 出口80-90°C",
        }

    # 6. 活塞冷却油温差（进口从滑油系统推断）
    lo_in = stats.get("滑油进主轴承温度")
    pco_outs = []
    for i in range(1, 7):
        s = stats.get(f"{i}缸活塞冷却油出口温度")
        if s:
            pco_outs.append((i, s["mean"]))
    if pco_outs:
        avg_pco = np.mean([v for _, v in pco_outs])
        entry = {"avgOutlet": round(avg_pco, 1),
                 "perCylinder": {f"{i}缸": round(v, 1) for i, v in pco_outs},
                 "note": "wiki: 出口各缸ALM H 80°C, SLD 85°C"}
        if lo_in:
            entry["loInlet"] = lo_in["mean"]
            entry["delta"] = round(avg_pco - lo_in["mean"], 1)
        relationships["piston_cooling_oil"] = entry

    # 7. 增压器排烟温差（前-后 = 涡轮做功温降）
    tc_before = stats.get("增压器前排烟温度")
    tc_after = stats.get("增压器后排烟温度")
    if tc_before and tc_after:
        delta = tc_before["mean"] - tc_after["mean"]
        relationships["turbocharger_exhaust_delta"] = {
            "beforeTC": tc_before["mean"],
            "afterTC": tc_after["mean"],
            "delta": round(delta, 1),
            "note": "涡轮做功温降, 正常约20-100°C (随负荷变化)",
        }

    # 8. 燃油温度 → 燃油类型判断
    fuel_temp = stats.get("燃油进机温度")
    if fuel_temp:
        fuel_type = "HFO" if fuel_temp["mean"] > 80 else "MDO"
        relationships["fuel_type"] = {
            "fuelInletTemp": fuel_temp["mean"],
            "inferredType": fuel_type,
            "note": "MDO: 70-74°C, HFO: 120-140°C (粘度控制13-17 cSt)",
        }

    return relationships


def analyze_health(data_path, full_output=False):
    """主入口：解析数据，输出结构化统计 + 物理关系"""

    path = Path(data_path)
    if path.suffix == ".json" or _is_json_file(path):
        rows = _load_json(data_path)
    else:
        raise ValueError(f"仅支持JSON格式, 收到: {path.suffix}")

    if not rows:
        return {"error": "无数据", "dataPath": data_path}

    n = len(rows)

    # 构建列式字典
    df_dict = {}
    for row in rows:
        for k, v in row.items():
            if k not in df_dict:
                df_dict[k] = []
            df_dict[k].append(v)

    # 时间范围
    timestamps = [r.get("timestamp") for r in rows if r.get("timestamp")]
    time_start = timestamps[0] if timestamps else ""
    time_end = timestamps[-1] if timestamps else ""

    # === 工况判定 ===
    rpm_values = [v for v in df_dict.get("rpm", []) if v is not None]
    fuel_values = [v for v in df_dict.get("燃油指令", []) if v is not None]
    avg_rpm = float(np.mean(rpm_values)) if rpm_values else 0
    avg_fuel = float(np.mean(fuel_values)) if fuel_values else 0

    # AIS信息（停机态也需要）
    ais = {}
    for k in ["lat", "lon", "sog"]:
        vals = [v for v in df_dict.get(f"ais_{k}", []) if v is not None]
        if vals:
            ais[k] = round(float(np.mean(vals)), 4)

    # 停机判定
    if avg_rpm < 60 or avg_fuel < 5:
        return {
            "analysisTime": time_end,
            "timeRange": {"start": time_start, "end": time_end},
            "dataPoints": n,
            "operatingStatus": "stopped",
            "avgRpm": round(avg_rpm, 1),
            "avgFuelIndex": round(avg_fuel, 1),
            "ais": ais if ais else None,
            "message": "主机处于停机状态，跳过健康分析",
        }

    # 工况分类
    if avg_rpm > 95:
        mode = "cruise"
    elif avg_rpm > 80:
        mode = "maneuver_high"
    else:
        mode = "maneuver_mid"

    # === 逐传感器统计 ===
    all_sensor_keys = set()
    for sys_def in SYSTEM_GROUPS.values():
        all_sensor_keys.update(sys_def["sensors"])
    # 补充扫气温度（不在8大系统里但属于缸间均衡）
    for i in range(1, 7):
        all_sensor_keys.add(f"{i}缸扫气温度")
    # 补充关键独立参数（rpm、燃油指令不在8大系统里，但物理关系计算需要）
    all_sensor_keys.update(["rpm", "燃油指令"])

    sensor_stats = {}
    for key in sorted(all_sensor_keys):
        if key in df_dict:
            st = _sensor_stats(df_dict[key])
            if st:
                # 找DC key
                dc_key = None
                for dk, dv in DC_KEY_MAP.items():
                    if dv == key:
                        dc_key = dk
                        break
                sensor_stats[key] = {"dcKey": dc_key, **st}

    # === 系统级汇总 ===
    systems = []
    for sys_name, sys_def in SYSTEM_GROUPS.items():
        sys_sensors = []
        for sname in sys_def["sensors"]:
            if sname in sensor_stats:
                sys_sensors.append({"name": sname, **sensor_stats[sname]})
        systems.append({
            "name": sys_name,
            "sensorCount": len(sys_def["sensors"]),
            "availableCount": len(sys_sensors),
            "sensors": sys_sensors if full_output else [],
        })

    # === 缸间均衡性 ===
    cylinder_balance = []
    for group_name, sensor_names in CYLINDER_GROUPS.items():
        bal = _calc_cylinder_balance(df_dict, group_name, sensor_names)
        if bal:
            cylinder_balance.append(bal)

    # === 物理关系 ===
    relationships = _calc_physical_relationships(df_dict, sensor_stats)

    # === 组装输出 ===
    result = {
        "analysisTime": time_end,
        "timeRange": {"start": time_start, "end": time_end},
        "dataPoints": n,
        "operatingStatus": "running",
        "operatingMode": mode,
        "avgRpm": round(avg_rpm, 1),
        "avgFuelIndex": round(avg_fuel, 1),
        "ais": ais if ais else None,
        "systems": systems,
        "cylinderBalance": cylinder_balance,
        "physicalRelationships": relationships,
        "oemSafetyLimits": OEM_SAFETY_LIMITS,
    }

    return result


def _is_json_file(path):
    """检测文件内容是否为JSON"""
    try:
        with open(path, "r", encoding="utf-8") as f:
            first_char = f.read(1)
            return first_char in ("{", "[")
    except Exception:
        return False


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="船舶主机健康分析 - 数据统计")
    parser.add_argument("data_path", help="JSON数据文件路径")
    parser.add_argument("--full", action="store_true", help="输出所有传感器详细数据")
    parser.add_argument("--output", "-o", help="将 UTF-8 JSON 写入指定文件")
    args = parser.parse_args()

    result = analyze_health(args.data_path, full_output=args.full)
    payload = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        output_path = Path(args.output).expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(payload + "\n", encoding="utf-8")
        print(output_path)
    else:
        print(payload)

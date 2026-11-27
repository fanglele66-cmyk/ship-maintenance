"""Bind an inference reply to its time axis and recover DC codes from model scores."""
import argparse
import hashlib
import json
import math
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path, PurePosixPath


# 长航碧玉 native_maf_h128_b7_n1, canonical feature order confirmed by the owner.
FEATURE_ORDER = tuple(f"DC{n:04d}" for n in (*range(1, 14), *range(20, 43), *range(44, 60)))
MODEL = "native_maf_h128_b7_n1"
SHIP = "900000000000000101"
DEVICE = "900000000000000202"


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def require(condition, explanation):
    if not condition:
        raise ValueError(explanation)


def business_reply(raw):
    """Support a business object and standard MCP structured/text result envelopes."""
    require(isinstance(raw, dict) and not raw.get("isError"), "Invalid response or MCP tool error")
    if "structuredContent" in raw and isinstance(raw["structuredContent"], dict):
        return raw["structuredContent"]
    if "content" in raw:
        items = [part for part in raw["content"] if part.get("type") == "text"]
        require(len(items) == 1, "Expected one MCP text result")
        return json.loads(items[0]["text"])
    return raw


def number(x):
    return type(x) in (int, float) and math.isfinite(x)


def rounded_equal(a, b):
    return number(a) and number(b) and abs(a - b) <= 0.000050001


def parse_time(t):
    dt = datetime.fromisoformat(t.replace("Z", "+00:00"))
    return dt.astimezone(timezone(timedelta(hours=8))).replace(tzinfo=None) if dt.tzinfo else dt


def verify_binding(artifact, request, source):
    for field in ("shipId", "deviceId", "serNo", "workspaceTaskId"):
        expected = request["taskId"] if field == "workspaceTaskId" else request[field]
        if field in artifact:
            require(artifact[field] == expected, f"{source} {field} differs from request")
    for field in ("startTime", "endTime"):
        if field in artifact:
            value = artifact[field]
            require(isinstance(value, str) and parse_time(value) == parse_time(request[field]),
                    f"{source} {field} differs from request")


def published_input(response):
    paths = [p for p in response.get("publishedPaths", []) if p.endswith("__raw-data.json")]
    require(len(paths) == 1, "Cannot identify the input snapshot for this run")
    p = PurePosixPath(paths[0])
    require(not p.is_absolute() and ".." not in p.parts and "\\" not in paths[0] and ":" not in paths[0],
            "Unsafe workspace-relative artifact path")
    require(response["runId"] in p.name, "Snapshot does not name this run")
    return p


def run(args):
    req = read(args.request)
    r = business_reply(read(args.response))
    require(req["shipId"] == SHIP and req.get("deviceId") == DEVICE and bool(req["taskId"]), "Unconfigured ship/device or missing workspace task")
    require(isinstance(req.get("serNo"), str) and req["serNo"].strip(), "Missing request serial")
    require(req.get("startTime") and req.get("endTime"), "Missing request time window")
    verify_binding(r, req, "Inference response")
    require(r.get("status") == "done" and not r.get("error") and r.get("runId"), "Inference has no successful result")
    if req.get("serNo"):
        require(re.fullmatch(r"ai-run-" + re.escape(req["serNo"]) + r"-\d{8}_\d{6}", r["runId"]),
                "Request serial and response runId do not match")
    require(not r.get("unmappedPoints"), "Inference reported unmapped input points")
    model = r["resultPayload"]
    if isinstance(model, str):
        model = json.loads(model)
    verify_binding(model, req, "Model result")
    require(model["model_name"] == MODEL and model["status"] == "done", "Unknown or unsuccessful model")
    if req.get("publishToWorkspace"):
        published_input(r)
        require(any(r["runId"] in p and p.endswith("__result.json") for p in r.get("publishedPaths", [])),
                "Missing published result path for this run")
    if args.workspace_root:
        base = Path(args.workspace_root).resolve()
        file = (base / published_input(r)).resolve()
        require(file.is_relative_to(base), "Snapshot path escaped workspace")
        provenance = "published-input-snapshot"
    else:
        require(args.window and args.window_request, "Independent comparison needs the sensor-window query and reply")
        query = read(args.window_request)
        require(req.get("dataSource") == "ch", "Workspace runs require the exact published snapshot")
        require(all(k in query for k in ("shipId", "deviceId", "startTime", "endTime")),
                "Independent sensor query must identify ship, device and CH interval")
        verify_binding(query, req, "Sensor window query")
        file = Path(args.window)
        provenance = "independent-same-window-query"
    raw_bytes = file.read_bytes()
    window = business_reply(json.loads(raw_bytes.decode("utf-8-sig")))
    verify_binding(window, req, "Input time axis")
    stamps = window["timestamps"]
    n = r["totalRows"]
    require(type(n) is int and n > 0 and len(stamps) == n, "Input time axis and model row count differ or empty")
    times = [parse_time(t) for t in stamps]
    require(all(a < b for a, b in zip(times, times[1:])), "Non-unique or unordered time axis")
    if req.get("startTime") and req.get("endTime"):
        require(parse_time(req["startTime"]) <= times[0] and times[-1] < parse_time(req["endTime"]),
                "Input extends outside the requested interval")
    values = window["values"]
    if isinstance(values, dict):
        require(all(c in values and len(values[c]) == n for c in FEATURE_ORDER), "Model point arrays missing/misaligned")
    else:
        columns = window.get("pointKeys") or window.get("feature_order") or window.get("featureOrder")
        require(isinstance(columns, list) and len(set(columns)) == len(columns) and set(FEATURE_ORDER) <= set(columns),
                "Matrix requires an ordered sensor catalog covering this model")
        require(isinstance(values, list) and len(values) == n and all(len(row) == len(columns) for row in values),
                "Snapshot matrix missing/misaligned")
    for source, keys in ((model, ("feature_order", "featureOrder")), (window, ("modelFeatureOrder",))):
        for key in keys:
            if source.get(key) is not None:
                require(tuple(source[key]) == FEATURE_ORDER, "Declared model feature order conflicts with ship/model profile")
    ts = model["recommended_thresholds"]
    total_t, per_t = ts["total_threshold"], ts["per_dimension_thresholds"]
    scores = model["results"]
    totals, dims = scores["total_scores"], scores["per_dimension_scores"]
    classes = scores["recommended_threshold_results"]
    flags = classes["cls_results"]
    require(number(total_t) and rounded_equal(total_t, r["anomalyThreshold"]), "Total threshold mismatch")
    require(len(per_t) == len(FEATURE_ORDER) and all(number(x) for x in per_t), "Unexpected feature thresholds")
    require(len(totals) == len(dims) == len(flags) == n, "Score/label length mismatch")
    require(all(number(s) for s in totals) and all(len(row) == len(per_t) and all(number(s) for s in row) for row in dims),
            "Invalid model scores")
    require(all(v in (0, 1) for v in flags), "Invalid anomaly class")
    indices = [i for i, lab in enumerate(flags) if lab == 1]
    require(indices == [i for i,s in enumerate(totals) if s > total_t], "Classification and total threshold disagree")
    details = sorted(r["anomalyRowDetails"], key=lambda d: d["rowIndex"])
    require(len(indices) == classes["anomaly_count"] == r["anomalyRows"] and indices == [d["rowIndex"] for d in details],
            "Model classifications and outer anomaly rows differ")
    rows = []
    for i, d in zip(indices, details):
        require(times[i] == parse_time(d["sampleTime"]), f"Row {i}: sampleTime mismatch")
        require(rounded_equal(totals[i], d["totalScore"]) and rounded_equal(max(dims[i]), d["maxScore"]),
                f"Row {i}: inconsistent total/max score")
        cols = [j for j, s in enumerate(dims[i]) if s > per_t[j]]
        expected = [FEATURE_ORDER[j] for j in cols]
        reported = d["overThresholdPoints"]
        if sorted(expected) == sorted(reported):
            mapping = "confirmed-dc-codes"
        else:
            require(sorted(f"DC{j+1:04d}" for j in cols) == sorted(reported), f"Row {i}: unknown DC encoding")
            mapping = "verified-ordinal-dc-compatibility"
        rows.append({"rowIndex": i, "sampleTime": stamps[i], "totalScore": totals[i], "maxScore": max(dims[i]),
                     "overThresholdPoints": expected, "reportedPoints": reported, "pointMapping": mapping,
                     "dimensions": [{"columnIndex": j, "columnNumber": j + 1, "pointCode": FEATURE_ORDER[j],
                                     "score": dims[i][j], "threshold": per_t[j]} for j in cols]})
    return {"runId": r["runId"], "shipId": req["shipId"], "deviceId": req["deviceId"], "serNo": req["serNo"], "taskId": req["taskId"], "inferenceTaskId": r.get("taskId"),
            "startTime": req.get("startTime") or stamps[0],
            "endTime": req.get("endTime") or (times[-1] + timedelta(microseconds=1)).isoformat(sep=" "),
            "actualFirstTime": stamps[0], "actualLastTime": stamps[-1], "modelName": model["model_name"],
            "featureOrder": FEATURE_ORDER, "totalRows": n, "anomalyRows": len(rows), "threshold": total_t,
            "rows": rows, "serviceSegmentCount": len(r.get("anomalySegments", [])),
            "axisSource": provenance, "axisFile": file.name, "axisSHA256": hashlib.sha256(raw_bytes).hexdigest(),
            "publishedPaths": r.get("publishedPaths", []), "fillPolicy": window.get("fillPolicy")}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    for name in ("request", "response", "output"):
        p.add_argument("--" + name, required=True, type=Path)
    source = p.add_mutually_exclusive_group(required=True)
    source.add_argument("--window", type=Path)
    source.add_argument("--workspace-root", type=Path)
    p.add_argument("--window-request", type=Path)
    args = p.parse_args()
    report = run(args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"Verified {report['anomalyRows']} anomalous rows / {report['totalRows']}, {report['axisSource']}")


if __name__ == "__main__":
    main()

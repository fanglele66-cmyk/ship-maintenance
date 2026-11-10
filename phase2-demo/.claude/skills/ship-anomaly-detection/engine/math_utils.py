from __future__ import annotations

import math
from collections.abc import Iterable, Sequence


def mean(values: Sequence[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def median(values: Sequence[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return float(ordered[middle])
    return (ordered[middle - 1] + ordered[middle]) / 2.0


def quantile(values: Sequence[float], probability: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    position = max(0.0, min(1.0, probability)) * (len(ordered) - 1)
    lower = int(math.floor(position))
    upper = int(math.ceil(position))
    if lower == upper:
        return float(ordered[lower])
    weight = position - lower
    return float(ordered[lower] * (1.0 - weight) + ordered[upper] * weight)


def stdev(values: Sequence[float], *, sample: bool = False) -> float:
    if len(values) < 2:
        return 0.0
    center = mean(values)
    denominator = len(values) - 1 if sample else len(values)
    return math.sqrt(sum((value - center) ** 2 for value in values) / denominator)


def robust_sigma(values: Sequence[float], *, floor: float = 1e-6) -> float:
    if not values:
        return floor
    center = median(values)
    mad = median([abs(value - center) for value in values])
    estimate = 1.4826 * mad
    if estimate <= floor:
        estimate = stdev(values)
    return max(estimate, floor)


def finite(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value))


def feature_vector(
    values: dict[str, float],
    feature_spec: dict,
) -> list[float] | None:
    keys = list(feature_spec.get("keys", ["rpm", "load"]))
    centers = feature_spec.get("center", {})
    scales = feature_spec.get("scale", {})
    normalized: list[float] = []
    for key in keys:
        value = values.get(key)
        if not finite(value):
            return None
        scale = max(abs(float(scales.get(key, 1.0))), 1e-9)
        normalized.append((float(value) - float(centers.get(key, 0.0))) / scale)
    features = [1.0, *normalized]
    if int(feature_spec.get("degree", 2)) >= 2:
        for left in range(len(normalized)):
            for right in range(left, len(normalized)):
                features.append(normalized[left] * normalized[right])
    return features


def dot(left: Sequence[float], right: Sequence[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def predict(coefficients: Sequence[float], features: Sequence[float]) -> float:
    return dot(coefficients, features)


def fit_ridge(
    rows: Sequence[Sequence[float]],
    targets: Sequence[float],
    *,
    ridge: float = 1e-6,
) -> list[float]:
    if not rows or len(rows) != len(targets):
        raise ValueError("rows and targets must be non-empty and aligned")
    width = len(rows[0])
    gram = [[0.0 for _ in range(width)] for _ in range(width)]
    rhs = [0.0 for _ in range(width)]
    for row, target in zip(rows, targets):
        if len(row) != width:
            raise ValueError("feature rows have inconsistent widths")
        for i in range(width):
            rhs[i] += row[i] * target
            for j in range(width):
                gram[i][j] += row[i] * row[j]
    for i in range(1, width):
        gram[i][i] += ridge
    return solve_linear_system(gram, rhs)


def solve_linear_system(matrix: Sequence[Sequence[float]], rhs: Sequence[float]) -> list[float]:
    size = len(rhs)
    work = [list(row) + [float(rhs[index])] for index, row in enumerate(matrix)]
    for pivot in range(size):
        best = max(range(pivot, size), key=lambda row: abs(work[row][pivot]))
        if abs(work[best][pivot]) < 1e-12:
            work[best][pivot] = 1e-12
        if best != pivot:
            work[pivot], work[best] = work[best], work[pivot]
        pivot_value = work[pivot][pivot]
        work[pivot] = [value / pivot_value for value in work[pivot]]
        for row in range(size):
            if row == pivot:
                continue
            factor = work[row][pivot]
            if factor == 0:
                continue
            work[row] = [
                value - factor * pivot_value
                for value, pivot_value in zip(work[row], work[pivot])
            ]
    return [work[row][-1] for row in range(size)]


def rolling_window(values: Iterable[tuple[float, float]], size: int) -> list[tuple[float, float]]:
    sequence = list(values)
    return sequence[-size:]

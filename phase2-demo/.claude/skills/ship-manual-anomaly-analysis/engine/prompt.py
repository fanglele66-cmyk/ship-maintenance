from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from .contracts import validate_report


ACTION = "提交异常报告"
SKILL_LINE = "Skill：$ship-manual-anomaly-analysis"
SER_NO_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")
FIELD_ORDER = (
    "船舶ID",
    "ser_no",
    "设备",
    "系统",
    "关联传感器",
    "异常开始时间",
    "异常结束时间",
    "异常描述",
    "图片",
)
FIELD_ORDER_WITH_SENDER = (
    "船舶ID",
    "ser_no",
    "发送端",
    *FIELD_ORDER[2:],
)
SENDER_VALUES = {"船端": "ship", "岸基": "shore"}


class PromptContractError(ValueError):
    """Raised when the frontend prompt is not the fixed manual-report form."""


def _split_values(value: str) -> list[str]:
    return list(dict.fromkeys(item.strip() for item in re.split(r"[、,，;；]", value) if item.strip()))


BEIJING_TZ = timezone(timedelta(hours=8))


def _beijing_local_iso(value: str, field_name: str) -> str:
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError as exc:
        raise PromptContractError(f"{field_name} 必须是 ISO 8601 时间") from exc
    if parsed.tzinfo is not None and parsed.utcoffset() is not None:
        parsed = parsed.astimezone(BEIJING_TZ).replace(tzinfo=None)
    return parsed.replace(microsecond=0).isoformat()


def parse_fixed_prompt(text: str) -> dict[str, Any]:
    lines = [line.strip() for line in text.replace("\r\n", "\n").split("\n") if line.strip()]
    if not lines:
        raise PromptContractError("固定提示词不能为空")
    if lines[0] != ACTION:
        raise PromptContractError(f"首行必须为：{ACTION}")
    if lines[-1] != SKILL_LINE:
        raise PromptContractError(f"末行必须为：{SKILL_LINE}")

    body = lines[1:-1]
    if not any(line.startswith("ser_no：") for line in body):
        raise PromptContractError("ser_no 为必填字段，必须紧跟在船舶ID后")
    if len(body) == len(FIELD_ORDER):
        field_order = FIELD_ORDER
    elif len(body) == len(FIELD_ORDER_WITH_SENDER) and body[2].startswith("发送端："):
        field_order = FIELD_ORDER_WITH_SENDER
    else:
        raise PromptContractError(
            "固定提示词必须包含 9 个业务字段，或在ser_no后增加可选的发送端字段"
        )

    fields: dict[str, str] = {}
    for label, line in zip(field_order, body, strict=True):
        prefix = f"{label}："
        if not line.startswith(prefix):
            raise PromptContractError(f"字段顺序或全角冒号错误，当前行应以 {prefix} 开头")
        value = line[len(prefix):].strip()
        if not value and label != "图片":
            raise PromptContractError(f"{label} 不能为空")
        fields[label] = value

    sender_label = fields.get("发送端", "船端")
    if sender_label not in SENDER_VALUES:
        raise PromptContractError("发送端只允许填写：船端或岸基")
    ser_no = fields["ser_no"]
    if not SER_NO_PATTERN.fullmatch(ser_no):
        raise PromptContractError("ser_no 只允许字母、数字、下划线和连字符")

    systems = _split_values(fields["系统"])
    if not systems:
        raise PromptContractError("系统至少包含一个中文名称")
    sensors = _split_values(fields["关联传感器"])
    if not sensors:
        raise PromptContractError("关联传感器至少包含一个中文名称")
    image_value = fields["图片"]
    image_ids = [] if image_value in {"", "无", "无图片", "无附件"} else _split_values(image_value)
    start = _beijing_local_iso(fields["异常开始时间"], "异常开始时间")
    end = _beijing_local_iso(fields["异常结束时间"], "异常结束时间")
    if datetime.fromisoformat(end) <= datetime.fromisoformat(start):
        raise PromptContractError("异常结束时间必须晚于异常开始时间")

    report = {
        "ship_id": fields["船舶ID"],
        "ser_no": ser_no,
        "sender": SENDER_VALUES[sender_label],
        "equipment_name": fields["设备"],
        "system_name": systems[0],
        "system_names": systems,
        "sensor_names": sensors,
        "time_window": {"start_time": start, "end_time": end},
        "description": fields["异常描述"],
        "image_ids": image_ids,
    }
    validate_report(report)
    return report

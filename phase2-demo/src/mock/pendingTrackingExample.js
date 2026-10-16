// Independent fictional sample for the full decision-to-feedback demo.
export const pendingTrackingExample = {
  "id": "cyl5-drift",
  "issue": {
    "id": "cyl5-drift",
    "deviceId": "main-engine-1",
    "device": "主机",
    "type": "异动跟踪",
    "rank": 2,
    "title": "5号缸排温相对偏差扩大",
    "summary": "可比片段中，5号缸排温相对差3→6→9→12°C，排温355→358→361→364°C。现场与采集读数、对应工况及现象尚未核实。 建议审阅跟踪过程后安排现场核实。",
    "action": "判断并安排现场核实",
    "evidence": [
      "相对差3 → 6 → 9 → 12°C",
      "排温355 → 358 → 361 → 364°C",
      "尚无本次现场核实、派工和执行记录"
    ],
    "limit": "初始仅有异动跟踪，不视为已确认故障。"
  },
  "config": {
    "title": "5号缸排温相对偏差持续扩大",
    "device": "主机",
    "deviceId": "main-engine-1",
    "part": "5号缸",
    "direction": "偏差仍在扩大",
    "required": true,
    "scope": "核对5号缸现场排温与系统读数，记录核对时间、对应稳定工况及现场现象；不直接安排维修。",
    "reason": "多个可比片段中的偏差持续扩大，现场与采集数据尚未比对，需要核实变化真实性。"
  },
  "baseline": {
    "first": "第1可比片段",
    "established": "第2可比片段",
    "updated": "第4可比片段",
    "conditions": "可比运行片段；具体工况参数尚待核对。",
    "conclusion": "5号缸排温相对偏差持续扩大，可能是劣化的前期征兆；尚未确认故障或具体原因，需要派工核实。",
    "charts": [
      {
        "key": "gap",
        "name": "与其余缸平均排温的差值",
        "unit": "°C",
        "labels": [
          "第1片段",
          "第2片段",
          "第3片段",
          "第4片段"
        ],
        "values": [
          3,
          6,
          9,
          12
        ],
        "recordIds": [
          "cyl5-reference",
          "cyl5-established",
          null,
          "cyl5-request"
        ],
        "reference": "同工况缸间均值差；不是故障阈值"
      },
      {
        "key": "temperature",
        "name": "5号缸绝对排温",
        "unit": "°C",
        "labels": [
          "第1片段",
          "第2片段",
          "第3片段",
          "第4片段"
        ],
        "values": [
          355,
          358,
          361,
          364
        ],
        "recordIds": [
          "cyl5-reference",
          "cyl5-established",
          null,
          "cyl5-request"
        ],
        "reference": "可比片段中的排温记录"
      }
    ],
    "records": [
      {
        "id": "cyl5-reference",
        "at": "第1可比片段",
        "label": "起始比较参考",
        "text": "排温355°C，相对差3°C。",
        "assessment": "单个片段保留为比较背景，尚不直接确立故障。"
      },
      {
        "id": "cyl5-established",
        "at": "第2可比片段",
        "label": "反复偏差 · 建立关注",
        "text": "相对差扩大至6°C，后续比较开始呈现持续变化。",
        "assessment": "建立同一档案，继续比较可比片段及相关信号。"
      },
      {
        "id": "cyl5-request",
        "at": "第4可比片段",
        "label": "偏差扩大 · 请求人员核实",
        "text": "相对差依次增至9、12°C，现场核实信息尚未取得。",
        "assessment": "多个可比片段中的偏差持续扩大，现场与采集数据尚未比对，需要核实变化真实性。"
      }
    ]
  }
}

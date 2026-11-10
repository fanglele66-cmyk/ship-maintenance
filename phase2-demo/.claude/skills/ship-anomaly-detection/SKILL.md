---
name: ship-anomaly-detection
description: 启动时及每小时检测最近六小时主机数据，整理检测证据和待轮机长核实的事件。
---

# 船端 2.0 周期异常检测

入口为 scripts/run_local_detection.py，通过本地只读数据库构造 pointDataList，再调用保留的 engine.detector / longhang_engine 检测引擎。保留原统计、深度学习及停机工况路由。原船端契约见 references/original-skill.md，仅供算法来源参考，不运行旧发布器。
由服务端按启动时间调度，每小时一轮；每轮独立目录，保留最近六份完成产物。只对 confirmed 检测信号形成事件候选，confirmed 指信号触发成立，不代表设备故障已确认。各通道不可用的原因写入内部检测结果，不能用“未检出”冒充完整检测成功。
根据检测证据和本地知识生成 title、summary、interpretation、unverified、recommendation、steps JSON。严格区分检测现象、运行工况、待核实原因与已确认故障。第一责任人是轮机长。持续同一信号更新证据，不重复派工，不覆盖人工任务或备注。不自动闭环。
正常使用实时研判语气，不向使用者解释复刻、回放等工程实现。未取得的业务证据如实保留待确认。不得虚构读数或确定维修参数。

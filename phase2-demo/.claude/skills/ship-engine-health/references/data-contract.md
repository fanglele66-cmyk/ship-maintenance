# 可配置船舶健康分析数据合同

- 输入读取 `input/sensor-raw-data/*.json` 标准 `pointDataList` raw。
- 船舶与设备读取 `data/ship-profile.json`，仅分析 `collectEnabled=true` 且已绑定 analyzer 的设备。
- 接口身份、业务身份和设备 ID 全部来自 profile，不在 Skill 中写死。
- 每个完整样本所需点数来自 analyzer 的 `requiredPointCount`，点位映射来自配置路径；缺点不得补零。
- 健康分析可以关联已落盘的AI/OEM活跃事件，但不得修改事件状态。
- 输出继续使用 `template/result.schema.json`，设备字典中只允许出现当前 profile 配置的设备。

人工替换目标船舶的算法部件和 profile 后，健康分析器按 `healthEntrypoint` 动态加载，输出 Schema 不随船舶变化。

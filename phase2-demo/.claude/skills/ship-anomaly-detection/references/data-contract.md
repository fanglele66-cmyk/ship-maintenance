# 可配置船舶标准数据合同

当前唯一运行输入是工作空间 `input/sensor-raw-data/*.json` 中的标准 `pointDataList` 落盘格式。

- 船舶业务身份和接口身份读取 `data/ship-profile.json`。
- 设备 ID、业务兼容槽位、显示名和分析器绑定读取 `ship-profile.json.devices`。
- 点位目录读取 `dataSource.pointMappingPath` 指向的生成产物；模型点数和算法 mapping 读取对应 `analyzerProfiles`。
- 每条接口记录保留 `shipId/dataId/deviceDataId/pointDataId/collectTime/value` 六个字段，分析器不接受旧 `points[]` 快照。
- `_fetchMetadata.recordsPath` 必须为 `pointDataList`，并记录请求窗口、实际覆盖、分页、去重和完整样本数量。
- 加载器不区分真实、转接或本地模拟来源，按采集时间排序，默认在最新数据时刻之前6小时内选择最多12份 raw；选择窗口相对最新raw计算，不以电脑当前时间误删历史回放。
- 正常周期由 `fetch_sensor_data.py` 通过 profile 配置的标准传感器接口取得半小时窗口并原子写入 raw。完成数据准备后，配置目录中所有格式、身份、完整性和时间窗口合格的 raw 均进入同一加载器候选集合。

检测器只消费达到当前 analyzer `requiredPointCount` 的完整样本。任何点位缺失都不得补零；受影响通道必须停用或整份输入明确失败。

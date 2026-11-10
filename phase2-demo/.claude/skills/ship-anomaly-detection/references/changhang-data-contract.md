# 可配置船舶传感器数据契约

> 文件名为历史兼容路径；合同内容适用于所有按 profile 配置的船舶工作空间。

## 下游唯一输入

异常检测和健康分析只消费 `data/ship-profile.json.dataSource.rawDataDir` 中的标准 `*__raw-data.json`。记录使用 `shipId/dataId/deviceDataId/pointDataId/collectTime/value`；`value` 是最终工程值。

模型特征通过 analyzer 的 `mappingPath` 按固定模型索引解析。所需点数来自 `requiredPointCount`，不完整采样不得补零或参与检测。

## 标准接口

1. `dataSource.provider` 必须为 `standard_sensor_api`。
2. `fetch_sensor_data.py` 从 profile 读取接口身份、设备 ID、API 配置路径、点位产物路径和 raw 输出目录。
3. API 配置只保存地址、分页、超时和令牌引用，不保存船舶或设备请求身份。
4. 接口直接返回标准 `pointDataList`；分页、覆盖、去重和完整样本数写入 `_fetchMetadata`。
5. `sensor-point-mapping.json` 由首次点表请求生成，不要求人工上传，也不从旧船工作空间复制。

工作空间不支持旧数据适配器。标准接口失败时必须披露失败，不得静默调用其他船舶工作空间的脚本或读取其本地凭证。

## 更换船舶

更换船舶时由人员复制已验证工作空间，人工替换 `ship-profile.json`、接口配置、知识库和分析器部件；本地工程测试目录保留校验器时，可运行 `test/validate_ship_workspace.py` 做自动验收。切换只影响船舶配置和本船部件，不修改检测、健康、事件发布或前端 schema。

# 长航碧玉异常检测验证门禁

## 输入合同

- 每份标准 raw 必须使用 `pointDataList[]`，记录字段为 `shipId/dataId/deviceDataId/pointDataId/collectTime/value`。
- 当前主机每个完整采样必须包含 59 个唯一点位，模型顺序只由 mapping 的 `modelIndex` 决定。
- 半小时测试窗口使用 12 秒采样间隔，共 150 个完整采样、8,850 条记录；请求结束时刻与最后样本允许相差一个采样间隔。
- 缺点、重复点、未知设备、身份冲突或 `_fetchMetadata.recordsPath` 非 `pointDataList` 时必须明确失败。

## 本地门禁

1. `python -B -m unittest discover -s test -v` 全部通过。
2. 两份固定标准接口夹具均能加载为 150 个59点完整样本。
3. 旧接口在线桥接能从 ship_sop 工况接口取回59点样本、严格裁剪一个完整半小时，并生成合法 legacy JSON 与标准 raw。
4. 正常三行周期提示词不增加本地测试专用措辞；周期始终先尝试当前模式取数，随后不按来源过滤，统一从 `input/sensor-raw-data/` 的时间窗口合格raw中最多选择12份分析。
5. 确定性 preparation 能调用长航引擎并生成合法证据；正常发布继续通过既有周期、事件、analysis result 和 active-events Schema。
6. 健康分析只产生一台“主机”，并通过原健康结果 Schema。

## 正式接船前门禁

- 使用正式船舶、设备和59个点位ID重跑逐点审计。
- 至少验证正常巡航、中低速、停机、已知故障和重启瞬态窗口。
- 接口失败但存在合格 raw 时必须标记 `status=partial/usedCachedRawData=true`；没有 raw 时不得伪造分析结果。
- 连续异常跨周期复用原事件，正常窗口不得因历史 active-events 创建本轮事件。

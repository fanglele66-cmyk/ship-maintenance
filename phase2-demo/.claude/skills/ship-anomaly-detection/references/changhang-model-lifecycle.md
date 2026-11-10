# 长航检测模型生命周期

## 当前冻结资产

长航碧玉检测模型、统计基线、mapping 和归一化数据从 `ship_sop` 复制到本工作空间后独立运行。正式运行不得跨目录动态引用 `ship_sop`，也不得混入隔离区中的旧船型资产。

资产目录包括：

- `longhang_engine/`：长航检测实现；
- `baselines/`：物理与统计通道基线；
- `data/dl_cruise/`、`data/itransformer_forecast/`、`data/midlow_forecast/`、`data/nf_forecast/`：模型及归一化资产；
- `data/mappings/changhangbiyu_mapping.json`：59 点模型顺序和物理语义。

## 更新规则

1. 先在 `ship_sop` 完成训练、健康回放、故障样本复核和版本冻结。
2. 一次性复制同一版本的代码、mapping、基线、权重和元数据，不得只替换权重或阈值。
3. 核对 59 个 `modelIndex` 连续且唯一，所有模型必需点均可从 mapping 找到。
4. 使用正常、停机、中低速、已知故障和重启瞬态样本执行回归。
5. 验证 `channel_status`、候选/确认数量和事件时间范围后再接入正式周期。
6. 模型更新不允许修改业务事件 schema。

接口或平台 ID 改变时只更新数据源配置、船舶身份和根 mapping。只要 59 个特征的物理语义与 `modelIndex` 不变，就不重训模型；单位、量纲、物理语义或采样规律变化时必须重新做适用性验证。

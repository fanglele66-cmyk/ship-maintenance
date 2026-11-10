# 长航碧玉检测通道入口

当前工作空间只运行长航碧玉 RT-flex50 单主机通道。工况、点位、通道门槛、候选确认与模型资产见 [changhang-channel-design.md](changhang-channel-design.md)。

外层事件框架只负责把长航结果转换为既有业务 Schema，不重新解释长航阈值，不升级候选，也不运行其他船型检测器。

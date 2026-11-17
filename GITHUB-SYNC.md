# GitHub 代码同步说明

本次同步源：公司 GitLab `env/dev`，提交 `0ff66126965c49193d2d7f41521f1ec0dd3c8aec`。

应用源代码、测试、构建产物 `phase2-demo/dist`、部署脚本和 Windows 启动脚本均与该提交一致。GitHub 分支沿用自己的提交历史，不包含公司部署分支中的数据库或实际模型配置。

## 本地运行前需要补充

1. 将单独提供的 `ship-continuous-24h.db` 放到 `phase2-demo/deployment-data/telemetry/`；目录中保留了对应的 manifest、receipt 和说明。可在应用目录运行 `npm run deployment:check-data` 验证。
2. 参照 `phase2-demo/.local-ai/README.md` 配置模型；现有本地 `config.json` 可继续使用。
3. 安装依赖后按原说明构建和启动。运行状态保存在 `.local-data`，已有账号和业务记录保留。

公司容器部署说明中的“数据库及模型配置随仓库交付”针对 GitLab 版本；GitHub 构建容器前需要自行补齐上述两个文件。

以后同步仍应基于 GitHub 分支提交代码快照，并排除数据库和实际模型配置，不能直接合并带有这些文件的 GitLab 历史。

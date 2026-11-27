# GitHub 代码同步说明

本次同步源为公司 GitLab `env/dev` 的 `af4c030` 和 `bf73cd9`。前一笔补齐船端 Skills、报告产物并修复事件流转，后一笔调整任务回交后的首选建议。

上述两笔提交涉及的业务代码、测试和构建产物 `phase2-demo/dist` 已同步。GitHub 分支沿用自己的模型配置示例和提交历史。实际模型配置和遥测数据库按下文在本地补齐。

## 本地运行前需要补充

1. 将单独提供的 `ship-continuous-24h.db` 放到 `phase2-demo/deployment-data/telemetry/`；目录中保留了对应的 manifest、receipt 和说明。可在应用目录运行 `npm run deployment:check-data` 验证。
2. 参照 `phase2-demo/.local-ai/README.md` 配置模型。首选 GLM 的示例为 `phase2-demo/server/ai-project.example.json`，备用模型沿用本机或持久卷的配置。
3. 安装依赖后按原说明构建和启动。运行状态保存在 `.local-data`，已有账号和业务记录保留。

公司容器部署说明中的“数据库及模型配置随仓库交付”针对 GitLab 版本；GitHub 构建容器前需要自行补齐上述两个文件。

以后同步仍应基于 GitHub 分支提交代码快照，并排除数据库和实际模型配置，不能直接合并带有这些文件的 GitLab 历史。

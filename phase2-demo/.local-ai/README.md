# GitHub 版本模型配置

GitHub 版本不包含实际模型密钥。复制 `config.example.json` 为本目录的 `config.json`，填写获授权的模型密钥，并将 `enabled` 改为 `true`。配置只由后端读取，不进入前端构建产物。

实际 `config.json` 被 Git 忽略；公司 GitLab 版本单独提供已授权的初始配置。不要直接将公司交付分支历史合并或推送到 GitHub。

容器构建前也需要准备 `config.json`，Dockerfile 使用它初始化持久卷中的 AI 配置。现有持久卷不会被镜像里的初始配置覆盖。

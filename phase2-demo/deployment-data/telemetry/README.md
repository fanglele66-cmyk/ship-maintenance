# 船舶时序数据：公司 GitLab 交付目录

将本目录中的以下三个文件上传到服务器应用的 `phase2-demo/deployment-data/telemetry/`：

- `ship-continuous-24h.db`：当前使用的连续时序数据库。
- `manifest.json`：数据库文件名、测点数据覆盖范围与处理信息。
- `receipt.json`：数据库及清单 SHA-256、记录数、覆盖时间，供上传后核对。

这三个文件已从 `.local-data` 单独导出，随公司仓库交付。2026-11-16 起，`ship-continuous-24h.db` 改为普通 Git 二进制文件，清单和回执也直接由 Git 管理。正常拉取当前版本即可得到完整数据库，不再依赖 Git LFS 下载。数据库内容、文件名及 SHA-256 不变，历史提交中的旧 LFS 指针不改写。仍可手动上传这三个文件，保持文件名与 `manifest.json` 的对应关系。

沿用运维当前 Jenkinsfile 和 Dockerfile：普通检出取得完整文件，Docker 直接复制 `deployment-data` 到后端镜像。可在应用目录执行 `npm run deployment:check-data`，只读验证文件头、文件大小、SHA-256、SQLite 完整性和表结构；当前构建不会自动调用此校验脚本。

若使用 Compose 的外部目录挂载，容器读取的是宿主机本目录，挂载会遮住镜像内的数据库。请将该宿主机目录更新到包含普通数据库文件的新提交，或上传完整数据，不能只更新镜像。

后端默认优先读取此目录；如放在服务器其他位置，设置 `SHIP_TELEMETRY_DIR` 为该目录绝对路径。Node 与三个 Python 分析入口统一使用这份数据，只读打开数据库。不要将此目录放入 `public` 或 `dist`。

账号初始化文件已经单独提交在 `data/accounts-seed.json`，不需要手动上传账号数据库或 `accounts-initial.json`。新服务器首次启动后自动导入现有四个账号及其密码校验值，原密码继续使用。账号、事件、任务、报告、定时产物等可变数据继续保存在 `.local-data`（或 `SHIP_DATA_DIR`），代码更新不覆盖已有账号。

重新从旧运行目录导出可执行：

```sh
npm run deployment:export
```

导出器只读取旧数据库；已导出文件内容一致时可重复执行，内容不同时会拒绝覆盖，需确认新数据后另选目录。旧 `.local-data` 中的数据库和清单暂时保留用于兼容与核对，程序在独立数据目录存在时优先使用新副本。

模型初始配置另见 `.local-ai/config.json`，经所有者授权随公司仓库交付。完整启动方式见 [公司服务器容器部署](../../docs/公司服务器容器部署.md)。

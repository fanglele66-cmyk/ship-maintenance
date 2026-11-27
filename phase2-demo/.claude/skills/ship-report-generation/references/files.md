# 独立报告与页面字段

模型输出的 [patch.example.json](../template/patch.example.json) 是待校验的分析正文。[report.example.json](../template/report.example.json) 则是用同一示例、已提交记录及 2.0 的 `makeReport` 生成的完整报告。宿主负责关联和归档。

| 页面位置 | 正式产物 |
| --- | --- |
| 报告中心与详情 | id、kind、title、eventId、eventNumber、owner、at、markdown。排查、维修和维保报告另有 number、taskId、submissionNumber；详情可按事件和任务回溯。 |
| 步骤与附件 | submissionSnapshot 保存本次 scope、steps、records、summary、attachments 和时间。records 中的 result、note、executionStatus（适用时）、photos 是本次回交事实；新照片以 id、storage、contentHash、name 等元数据引用原件，sources 可同时含 form 和 chat。老照片可含 dataUrl。未发送或晚于此版提交时间的照片不并入本版。 |
| AI 分析及修订 | summary、analysisMarkdown、markdown 展示当前内容。产生 AI 结果后可附 generatedBy、generatedAt、sources、usage；original、revisions、updatedAt 记录已确认的修订或重新整理。 |
| 观察与闭环 | 观察报告关联 observationSnapshot 及实际窗口；闭环报告来自轮机长决定，与过程报告分别归档。关联观察事件中 linkedSource=true 的项目引用原报告。 |
| 上报岸基 | 发送记录的 id 用作页面报告 ID，正文取发送时的 syncedReport；includedReports 在适用时保存当时收录的报告。修改已发送版本会产生新的发送记录。只有轮机长的报告中心展示上报岸基报告。 |

后端以 `SHIP_DATA_DIR`（本地默认 `.local-data`）为根目录。每个正式报告独立保存在 `events/<eventId>/reports/r-<reportId>.json`。旧 ID 含特殊字符或过长时文件名为 `x-<原 ID 的 SHA-256>.json`；文件内 id 保留原值。原有 `workflow.sqlite` 和 `events/<eventId>/reports.json` 继续服务现有页面与同步。后端启动会按已有事件补齐或修复独立文件；同一报告更新原文件，再次正式回交或再次上报岸基使用新 ID。

仅浏览器演示的正式报告以独立 JSON File 保存在当前站点的 IndexedDB（库 `ship-demo-report-files`，对象库 `reports`，键为 `JSON.stringify([eventId, reportId])`）。其余演示工作区和原始照片沿用原存储。两种模式均保留原报告下载及照片打包入口；独立 JSON 中的原图引用可由该工作区解析。

# 船舶设备检修助手 · 二期展会演示

## 当前版本

- 分支：`phase2-demo-20261009`
- 二期源码目录：`phase2-demo/`
- 同步时间：2026-10-09
- 来源：当前公网版本 5，源码提交 `d24f3b9b0dae76d59ae31f178e0f77ab0503059a`
- 公网预览：https://ship-maintenance-phase2.celinezheng2001.chatgpt.site/#/situation

二期包含船舶与设备态势、关注事项跟踪、维保建议、待办处理及四条演示叙事线。仓库根目录保留原一期项目；运行二期请先进入下列目录。

## 本地启动

```sh
cd phase2-demo
npm ci
npm run dev
```

浏览器打开终端显示的地址，默认 `http://localhost:5173/#/situation`。安装 Node.js 20 或更新 LTS；首次安装依赖需要网络，模拟演示无需后端和 API 密钥。

```sh
npm run build
npm run preview
```

构建输出为 `phase2-demo/dist/`。部署说明和四条演示操作指南位于二期目录。

## 协作约定

后续二期修改在本分支的 `phase2-demo/` 中提交。当前分支基于团队仓库 main 创建，保留一期文件与历史；本次没有合并到 main。仓库原有 GitHub Pages 工作流仅在 main 推送时触发，二期公网仍使用上面的预览地址。

本次同步包含源代码、静态素材、依赖锁文件及操作文档，不包含依赖目录、构建产物、本机发布配置或压缩包。无需为日常修改重复保存源码包。

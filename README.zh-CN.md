# BeatAPI Workspace

一个开源、本地优先的 AI 图片与视频创作工作台。应用默认打开真正的 Home 首页，产品范围聚焦于项目、Studio、Canvas、共享素材、生成历史、可配置存储，以及 BeatAPI 官方 Provider。

本仓库不包含登录、账号、支付、订阅、本地积分、后台管理、RBAC 或 API Key 发放系统。

## 包含什么

- Studio：以提示词和参数为主的快速生成体验。
- Canvas：基于 React Flow 的多步骤节点画布。
- 本地项目、画布快照、生成历史和素材索引。
- 由代码统一维护的 BeatAPI 图片/视频模型目录。
- BeatAPI 任务提交、状态轮询和结果回填。
- 内置 Provider 固定使用 BeatAPI，用户填写自己的 BeatAPI API Key。
- 默认使用 BeatAPI 托管 R2，也允许切换到自己的 Cloudflare R2/S3。
- Provider 与存储配置保留在服务端，可选静态加密。
- 中英文界面。
- 默认 SQLite，可选部署到 Cloudflare D1。

## 快速开始

需要 Node.js 22+ 与 pnpm 10+。

```bash
pnpm install
cp .env.example .env.development
pnpm db:push
pnpm dev
```

打开 `http://localhost:3020` 会直接进入 Home。访问 Studio 或 Canvas 不会立即写入项目数据库，只有确认开始项目后才会创建记录。点击工作台顶部的连接配置按钮，可以填写你自己的 [BeatAPI API Key](https://beatapi.io/dashboard/apikeys) 并选择存储；也可以通过 `.env.development` 配置。

## 数据逻辑

```text
Studio / Canvas
  -> 本地服务端接口
  -> 导入文件立即保存到 data/project-assets，并写入 SQLite 素材索引
  -> 生成预检与 SQLite 一次性生成意图
  -> 仅在确认生成后，把已持久化的本地引用上传到 Provider
  -> BeatAPI 图片或视频任务接口
  -> 轮询 Provider 状态
  -> 写入本地生成历史与素材索引
```

API Key 与存储密钥只保留在服务端。项目和历史数据保存在本地 SQLite。在本地 SQLite 模式下，导入的图片和视频会先复制到项目自己的 `data/project-assets/<project-id>/` 目录，并写入 SQLite 素材索引，然后才加入 Canvas。Provider 返回的公开结果地址会直接进入本地素材索引，不强制重复复制。

Canvas 内容变化后会保存一份完整项目快照；存在未保存变化时，每 5 秒再检查一次，并在页面切到后台、刷新或关闭时强制落盘。已有内容的快照不会被未经确认的空快照覆盖。

用户选择文件或从 Finder 拖入文件时，不会立刻发送给 Provider，但会立即持久化在用户自己的电脑上，因此刷新、重启或开发热更新都不会丢失。用户确认“生成”后，服务端先检查项目、模型、提示词、并发限制和 BeatAPI 连接，再在 SQLite 中创建短时、一次性的生成意图；只有这时，已经持久化的本地引用才会上传到配置好的 Provider 存储。意图会绑定项目、模型和准确上传数量，并在提交付费任务时被消费。

`data/` 目录已被 Git 忽略，其中同时包含 SQLite 数据库和本地项目素材。把工作台迁移到另一台电脑时，应将整个目录一起备份或复制。

存储权益跟随 BeatAPI 计费：内置 Provider 固定通过官方 `https://api.beatapi.io` 接口，并使用用户自己的 BeatAPI API Key。图片、音频和字幕通过 BeatAPI Files 进入托管存储；官方部署通过独立的 `BEATAPI_MANAGED_R2_*` Secret 预配置 R2，处理 Files 暂不支持的视频输入。源码用户也可以通过 `R2_*` 配置自己的 Cloudflare R2 或其他 S3 兼容存储。两组凭据不会互相回退。

仓库不会内置或泄露共享 R2 密钥。所谓“默认配置好”，指官方部署通过部署 Secret 注入托管 R2；源码用户对受支持输入使用 BeatAPI 托管 Files，或自行接入自己的存储。

## 主要命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 在 `127.0.0.1:3020` 启动本地应用 |
| `pnpm typecheck` | 类型检查 |
| `pnpm test` | 单元与契约测试 |
| `pnpm i18n:check` | 检查中英文文案 |
| `pnpm build` | 生产构建 |
| `pnpm db:push` | 本地同步数据库结构 |
| `pnpm db:generate` | 生成可审阅的 SQLite/D1 迁移 |

## 安全提示

开发服务默认只监听 `127.0.0.1`，连接配置只允许在可信本地环境修改。如果部署到公网，请通过部署平台 Secret 配置 Provider 与存储凭据，并在应用前增加网络访问控制。

不要提交 `.env.development`、本地数据库或任何 Provider 凭据。

## 许可证

代码采用 [Apache License 2.0](./LICENSE)。许可证不授予 BeatAPI 商标、Logo、服务访问、模型供应商权利或第三方素材的使用权，详见 [TRADEMARKS.md](./TRADEMARKS.md)。

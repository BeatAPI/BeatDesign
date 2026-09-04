# BeatDesign 产品规划与当前完成状态

- 文档用途：给新加入的开发者、Codex、Claude Code 和其他 AI Agent 提供统一产品上下文
- 当前基线：BeatDesign v0.2 Phase 1 本地实现
- 最后核对：2026-09-04
- 事实边界：只有代码、测试和本文“已完成”栏目共同证明的能力才算完成；规划项不等于已发布
- 发布状态：v0.2.2 已发布；当前 `main` 在该版本之上继续包含 Canvas、Editor、MCP 与连接设置改进，尚未另行提升版本号。第三方市场审核仍按各自状态单独记录

## 1. BeatDesign 是什么

BeatDesign 是一个免费、开源、本地优先的 AI 图片/视频创作工作台。它把 Studio、节点 Canvas、项目 Assets、本地视频 Editor、生成历史和 BeatAPI 连接放在同一个 Project 中。

长期产品形态：

> One local creative workspace. Any agent.

用户可以独立使用 BeatDesign，也可以让 Codex、Claude Code 或其他通用 Agent 通过 MCP 操控画布和编辑器。BeatDesign 不在画布里重新内置一个通用 Agent。

## 2. 产品边界

### 开源 BeatDesign 负责

- 本地项目、素材、快照和时间线。
- Studio、Canvas、Editor、Assets 和 Generation History。
- 图片/视频生成、视频分析和后续音频能力入口。
- 本地媒体处理、预览、剪辑、诊断和导出。
- Command Kernel、MCP、Codex Skill 和可视化交接。
- BeatAPI 官方连接和 BYOK。

### BeatAPI 服务负责

- 远程 AI 模型能力。
- 异步任务、模型路由和服务计费。
- 用户通过自己的 BeatAPI API Key 使用服务。

### 不属于本仓库

- SaaS 账户、登录、支付、订阅、积分和管理后台。
- 通用聊天 Agent、通用 Router/Planner/Executor 平台。
- 社交平台发布、飞书连接和其他外部应用自动化。

## 3. 产品架构

```text
Studio ─────┐
Canvas ─────┼── Project / Assets / Generation / History
Editor ─────┘                    │
                                ▼
                         Local SQLite + Files
                                │
                         BeatAPI（确认后调用）
```

- Studio：引导式单次生成和分析。
- Canvas：复杂生成、参考素材、分支和血缘。
- Editor：时间组织、剪辑、音频、字幕和交付。
- Assets：媒体事实来源，所有工作空间共享。

未来 Agent 架构：

```text
Codex / Claude Code / Other Agent
               │
          BeatDesign MCP
               │
          Command Kernel
               │
 Studio / Canvas / Editor / Assets / Generation
```

## 4. 统一术语

| 名称 | 含义 |
|---|---|
| Asset | 本地真实媒体文件及其元数据 |
| Canvas Node | Asset、Generation 或 Timeline 在画布上的引用 |
| Generation | 产生 Asset 的异步任务，不绑定单一 placement |
| Timeline | 项目级剪辑文档 |
| Clip | Asset 在 Timeline 上的一次使用 |
| Take | 同一 Clip 的备选媒体版本，可恢复 Original |
| Canvas Edge | 用户视觉组织关系 |
| Generation Lineage | 真实生成或派生来源关系 |
| Command Kernel | UI 与 MCP 共用的唯一业务操作层 |

## 5. 已完成并有代码支撑的能力

### Project / Local-first

- 项目创建、打开、重命名和本地 SQLite 持久化。
- 界面支持英语、中文和日语，并可在主页、项目列表及工作区顶栏切换；英文使用无前缀路径，中文和日语分别使用 `/zh` 与 `/ja`。
- Canvas Snapshot 自动保存、页面隐藏时刷新和版本冲突保护。
- 本地上传图片、视频、音频后立即复制到项目目录。
- 生成图片、视频和封面在展示前本地化。
- 项目 Assets 和生成历史索引。
- BeatAPI 与存储凭证保留在服务端。

### Studio / Canvas

- Studio 图片、视频生成和 Standard/Deep 视频分析。
- React Flow 节点 Canvas。
- 图片、视频、音频 Asset Node。
- 图片/视频 Generation Node、Generation Output 与多个版本。
- 模型、提示词、画幅、时长、质量和参考素材配置。
- Canvas 节点连接、分组、复制、删除、撤销/重做。
- 音频节点和 Timeline Node。
- Asset、Canvas、Editor 之间的基础导航。

### Editor

- 项目级 TimelineDocument、Video/Overlay/Audio/Caption Track、Clip 和 Take。
- 视频和音频导入。
- 非破坏式 trim、split、move、delete 和 ripple delete。
- undo/redo。
- 音量、静音、淡入和淡出。
- 图片 Overlay 叠加，支持在预览中直接拖动，并可精确调整位置、宽度、透明度、旋转和淡入淡出；可通过 UI 或 MCP 替换为当前 Project 内任意图片 Asset，同时保留原有时间与变换参数；预览与 MP4 导出保持一致。
- 浏览器本地预览。
- 选区派生 MP4。
- BeatAPI 选区 AI redo。
- Redo 结果作为 Take 保存、激活和恢复 Original。
- 完整 Timeline H.264/AAC MP4 导出。
- 字幕在 Overlay 之后绘制，确保字幕始终位于最终画面层；支持四种共享样式预设，单条字幕可独立调整文字、时间、字号、最大宽度和垂直位置，UI 与 MCP 共用同一操作。
- 导出写回 Assets 和 Canvas Timeline Node。
- 缺失素材、Clip 重叠和视频轨空隙诊断。
- Editor 自动保存统一走 Command Kernel；并发写入使用 revision/CAS 和三方合并，不再用旧文档覆盖新版本。
- 右侧栏是可关闭、可重新打开且 Agent 中立的 Timeline Inspector，不内置或假装存在专有 Clip Agent；Codex、Claude Code、Cursor 等通用 Agent 通过 MCP 修改同一份 Timeline。
- 同一次加入时间线使用稳定 Clip ID 和幂等键，重复点击、网络重试不会重复插入同一批 Clip。
- Take 必须覆盖 Clip 时长；过短 Take 不可激活，诊断会阻止可能产生冻结尾帧的导出。

### 媒体技术

- 使用 WebCodecs + Mediabunny 在浏览器完成媒体检查、编码和 MP4 封装。
- 核心浏览器预览和 MP4 导出不要求系统 FFmpeg；MCP/Node 视频抽帧与权威时间线 MP4 导出使用 `PATH` 中的 `ffmpeg`/`ffprobe`，也可通过 `BEATDESIGN_FFMPEG` 和 `BEATDESIGN_FFPROBE` 指定。
- OpenReel 只作为时间线术语、文档模型和非破坏式编辑行为的参考；未打包其完整 UI 和应用外壳。
- 媒体 metadata 采用限并发队列并带超时释放；单个损坏媒体不会永久阻塞后续卡片。

### Command Kernel / Agent-ready 基础

- `POST /api/app/projects/:id/commands` 是 Canvas/Editor 业务命令的统一写入口。
- 命令请求使用严格运行时 Schema，拒绝未知命令、缺少稳定 ID 的 Clip/Take 操作和越界参数。
- 命令中的 Asset 会按当前 Project membership 重新验证，并由服务端写入权威媒体 URL。
- `project_command_receipt` 保存短期幂等回执；同一项目和幂等键只执行一次，并有限时、限量清理。
- 幂等键会绑定首次 command；复用到另一个 command 会返回 `INVALID_COMMAND`，不会静默冒用旧结果。
- UI 内部允许 revision-checked `editor.replace_document` 支撑 undo/redo 和本地自动保存；MCP 被明确禁止整份替换，只能调用 `editor.apply`。
- Generation 的 `AssetFirstGenerationRequest` 已成为服务端权威输入：适配器媒体参数由 Asset ID 和当前 generation intent 编译，旧的客户端 URL 字段不再决定引用事实。
- UI 命令入口不再接受客户端 `origin`；服务端固定写入 `ui`，MCP 入口在内核边界固定写入 `mcp`。
- Provider Contract 已将逻辑模型目录与 BeatAPI effectId、上传路径和上游模型名拆开；BeatAPI 是默认实现，Fork 可在源码扩展点注册其他 Provider。
- 本地 stdio MCP Server 提供 27 个工具（Project / Asset / Canvas / Generation / Editor），模型和参数通过 capability discovery 暴露；Canvas / Editor 增量操作使用完整 JSON Schema，Agent 可直接发现操作类型和参数。MCP 生成直接调用当前 Provider，本地产品不重复实现 API Key、余额、计费或限流策略，只透传 Provider 的结果与错误。`bdesign_project_target` 绑定当前会话项目，Project/Canvas/Editor view 工具返回 Codex Browser handoff；`bdesign_asset_import` 把本地文件导入项目 Asset 库；`bdesign_asset_extract_frame` 与 `bdesign_canvas_continue_from_tail` 负责抽帧续写；Editor MCP 可导入 SRT、放置和替换任意项目图片 Overlay、调整叠层与单条字幕参数，并通过 `bdesign_editor_render` 将权威时间线导出为项目内 MP4 Asset。
- Codex、Claude Code 与 WorkBuddy 接入包内含 `beatdesign-workspace` Skill，负责项目选择、字幕/续写工具编排、付费生成停点和可视化复核；三者共用同一 MCP 与本地 Project 数据，其中 Claude Code 和 WorkBuddy 使用本机 HTTP MCP。

## 6. v0.2 Phase 1 本地已实现

主 PRD：[BEATDESIGN_V0_2.md](./prd/BEATDESIGN_V0_2.md)

- 统一 asset-first 产品模型。
- Command Kernel 基础、严格请求 Schema、Project Asset 边界和短期幂等回执。
- Canvas 视频尾帧提取。
- 使用尾帧创建下一段视频生成节点。
- 多个 Canvas 视频一次创建/追加时间线。
- Canvas -> Timeline Node -> Editor 连续工作流。
- Editor 自动保存接入命令入口，并补齐冲突三方合并、重复操作保护和稳定播放头时间。
- 图片 Clip、时间线拖拽调整持续时间与图片/视频统一视觉轨。
- 本地 MCP Server 提供 27 个 Project、Asset、Canvas、Generation、Editor 工具；支持会话项目绑定、Canvas/Editor 可视化交接、从绝对路径导入本地素材、抽取尾帧续写、导入和精调 SRT 字幕、放置/替换/调整图片 Overlay，以及权威时间线 MP4 导出。
- MCP 增量 Canvas/Editor 命令在短暂 revision 竞争时会基于最新权威文档限次自动重放；持续冲突返回最新 revision 和明确重试提示。
- Canvas 与 Editor 每 2 秒并在页面重新聚焦时检查 MCP 写入的新 revision。

本阶段的本地验收边界：类型检查、自动测试、国际化检查、生产构建和浏览器关键路径。Git 提交、远端合并和公开 Release 属于后续独立状态。

2026-08-30 浏览器实操证据：保留了本地项目 `v0.2 QA – Canvas-to-Editor`。一段 10.01 秒本地 MP4 已完成“尾帧提取 -> 派生图片 Asset -> 下一段视频 Generation Node -> Timeline Node -> 打开 Editor -> 裁取 3.00–7.00 秒 -> 得到 4.00 秒 Clip -> 导出 H.264/AAC MP4 -> Render 写回 Assets”的闭环。实操同时发现并修复了开发服务器把 `Sec-Fetch-Dest: video/image/audio` 错当成静态文件、导致本地媒体 404 的问题。

2026-08-30 本轮内核验收：未知 command 返回 `INVALID_COMMAND`；伪造 Asset 返回 `NOT_FOUND`；相同幂等键连续提交两次只产生一条回执且返回同一 revision；`origin=mcp` 的整份 Timeline 替换被拒绝。当时的本地 MCP 工具目录为 20 个；Canvas / Editor 操作的完整 JSON Schema、未知 command、伪造 Asset、幂等回执、MCP 本地素材导入和 `origin=mcp` 禁止整份 Timeline 替换均有自动测试覆盖。当前工具数量见上方“已完成”栏目，发布门禁的最新测试数量以仓库当前 `pnpm test` 结果为准。

2026-08-30 MCP 可见联调证据：在已打开的本地 Canvas 中，通过 stdio MCP 修改生成节点提示词，页面在轮询周期内自动显示新内容；在已打开的 Editor 中，通过 `bdesign_editor_edit` 把图片 Clip 从 4.00 秒改为 3.50 秒，时间线和素材信息同步更新，无需刷新。联调完成后，Canvas 提示词与 Editor 时长均通过 MCP 恢复原值。该联调同时修复了 Canvas 在存在待保存本地布局时跳过 Agent revision 的问题。

## 7. 尚未完成

### 产品 P1

- 字幕转录入口。字幕轨、SRT 导入和四种字幕样式预设已完成基础版（UI + MCP）。
- 时间线吸附、缩放、音频波形和多选。
- 变速和音频变速策略。
- 交叉溶解、淡入淡出、黑场转场。
- 合成 Preview Frame、短区间预览和更完整 Diagnostics。
- AI Bridge 衔接片段。
- 多个命名 Timeline。
- 更广的浏览器/编码兼容矩阵和代理媒体。

### Agent / MCP 后续边界

- MCP Resources 和更完整的 schema versioning。
- Agent Activity、命令审计和实时 UI 事件桥。
- 外部市场正式审核与上架。仓库已提供 Codex 本地插件、可直接添加的 Claude Code 仓库插件市场，以及符合目录结构的 WorkBuddy MCP + Skill Connector；这些本地接入包不等于已通过第三方市场审核。
- 独立的 headless 像素预览与后台媒体 Worker；当前 MCP MP4 导出在本地 MCP Server 进程中完成。

当前可以称为“已支持本地 MCP 基础版”，但不能称为完整 Agent 编辑环境：像素级 Snapshot、独立后台媒体 Worker、实时 UI 事件和永久审计仍未实现。本地文件导入桥和 MCP 权威时间线 MP4 导出已完成；UI 当前使用 2 秒 revision 轮询和聚焦检查，而不是实时事件推送。

Canvas 的拖拽、缩放、视口和完整布局仍使用 revision-checked Snapshot 自动保存；Canvas/Timeline 业务 operation 已有 Command 合同，Timeline Node 回写也已接入 `/commands`。后续做 MCP parity 时，应继续把可语义化的 Canvas UI 动作迁移为 `canvas.apply`，不能让外部 Agent 调用完整 Snapshot 覆盖。

### 桌面端

- Electron/Tauri 壳。
- 内置 Node runtime、MCP 和媒体 Worker。
- 原生文件选择、系统集成、签名、公证和自动更新。
- 桌面封装阶段再评估是否内置 FFmpeg；当前开源 localhost 的核心 UI 不依赖它，但 MCP/Node 抽帧工具需要用户提供本地 `ffmpeg`。

## 8. 路线图

### v0.2：Canvas-to-Editor Creative Loop

- 统一模型和 Command Kernel。
- 尾帧续写。
- 多片段创建时间线。
- 人工操作闭环稳定。

### v0.3：Short-form Completion

- 图片、字幕、变速、基础转场。
- 波形、吸附和预览诊断。
- AI Bridge。

### v0.4：Agent Control

- 本地 MCP Server 基础版已前置完成。
- UI/MCP parity tests。
- Codex 优先接入。
- Agent 操作实时可见、可撤销、可审计。

### v0.5：Desktop Experience

- 桌面壳、一键安装、后台媒体 Worker。
- 更稳定的大文件和长任务处理。

## 9. 必须保持的设计原则

1. 没有 Agent 时，BeatDesign 仍然是完整可用的产品。
2. 每次生成先形成 Asset，再由 Canvas 或 Editor 引用。
3. Editor 锁定具体 Asset，不自动跟随 Canvas 切换版本。
4. UI 与 MCP 必须调用同一个 Command Kernel。
5. MCP 不直接写 SQLite，不盲目覆盖完整 Snapshot。
6. 本地操作不自动把素材上传到外部服务。
7. 付费生成必须经过 precheck 和用户确认。
8. Agent 操作必须可见、可撤销、可验证。
9. 生成操作和确定性剪辑/转码必须区分。
10. 开源仓库不混入 SaaS 账户、支付和积分系统。

## 10. 新 AI 接手时的阅读顺序

1. `AGENTS.md`
2. 本文 `docs/PRODUCT_PLAN_AND_STATUS.md`
3. `docs/prd/BEATDESIGN_V0_2.md`
4. `README.md`
5. `docs/ARCHITECTURE.md`
6. `docs/PROVIDERS.md`
7. `docs/prd/VIDEO_TIMELINE_PHASE_1.md`

修改产品前先运行：

```text
git status --short
pnpm typecheck
pnpm test
pnpm i18n:check
pnpm build
```

不要把“本地测试通过”“代码存在”“GitHub 已推送”“桌面端已发布”混为同一种完成状态。

## 11. 交给其他 AI 的检查清单

请先保持本文的产品边界，不要把 SaaS Template、内置通用 Agent 或桌面壳提前混入本阶段。然后重点检查：

1. `docs/prd/BEATDESIGN_V0_2.md` 的每条 Phase 1 验收标准，是否有对应实现和测试证据。
2. Canvas 与 Editor 的写操作是否真正复用 `src/core/commands/`，有没有 UI 独有且 MCP 未来无法复用的第二套业务逻辑。
3. Timeline Clip 是否始终引用具体 Asset；Canvas 切换 Generation pinned output 时，是否可能静默改变已经剪好的片段。
4. 多素材加入 Timeline 的顺序、重复调用、版本冲突重试和部分失败，是否会产生重复 Clip 或丢失更新。
5. 尾帧提取面对无效历史 URL、跨域媒体、零时长/极短视频和不支持解码的编码格式时，错误是否可理解且不留下半成品节点。
6. Canvas Snapshot 与 Timeline revision/CAS 是否覆盖 UI 与未来 MCP 并发写入；MCP 是否能避免整份覆盖文档。
7. 新增依赖、OpenReel 派生合同和 Mediabunny 使用是否满足许可证归档与分发要求。
8. 使用一段本地视频完整走通：Canvas 选中视频 -> 尾帧续写节点 -> 多选片段 -> 创建 Timeline -> trim/split -> 导出 MP4 -> Render 回到 Assets/Canvas。

审查输出请区分：阻断问题、Phase 1 应修问题、v0.3 建议和纯偏好；不要把 v0.3 功能缺失当成 v0.2 回归。

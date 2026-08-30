# BeatDesign v0.2 主 PRD：Canvas-to-Editor Creative Loop & Agent Control

- 状态：Phase 1 与 MCP v0.2 adapter implemented locally
- 目标版本：v0.2
- 产品范围：BeatDesign 开源本地工作台
- 更新时间：2026-08-30
- 关联文档：[产品规划与完成状态](../PRODUCT_PLAN_AND_STATUS.md)

## 1. 产品结论

BeatDesign v0.2 的目标不是在画布里增加一个内置聊天 Agent，而是把 BeatDesign 建成通用 Agent 可操控的本地视觉创作运行环境。

产品有三个用户可见工作空间：

1. Studio：最快完成一次生成或分析的引导式入口。
2. Canvas：组织素材、生成节点、版本分支和生成血缘。
3. Editor：组织时间、精确剪辑、音频、字幕、预览和导出。

三者共享同一个 Project、Assets、Generation、Media 和 History。Generation 是共享能力，不是第四个工作空间。

```text
通用 Agent / 用户界面
        │
        ▼
BeatDesign Command Kernel
        │
        ├── Project / Assets
        ├── Canvas
        ├── Generation
        └── Editor
                │
                ▼
       SQLite + 本地媒体 + BeatAPI
```

## 2. v0.2 主链路

本版本必须让用户先手动、后由 Agent 完成同一条创作链路：

```text
在 Canvas 生成视频 A
  -> 从 A 提取尾帧
  -> 以尾帧为下一段首帧创建视频生成节点 B
  -> 继续生成 B / C
  -> 选择 A、B、C 创建或追加 Timeline
  -> 在 Editor trim / split / move / delete
  -> 选择局部范围执行 BeatAPI AI redo
  -> 在 Original 与多个 Take 之间切换
  -> 诊断时间线
  -> 导出 MP4
  -> Render 回到 Assets 与 Canvas Timeline Node
```

## 3. 统一产品模型

### 3.1 Project

唯一项目边界。Studio、Canvas、Editor 和 Assets 都是同一 Project 的视图，不创建第二套后端或媒体副本。

### 3.2 Asset

本地媒体事实来源。每次上传、生成、帧提取、片段截取和时间线导出都先形成 Asset。

Asset 可以被 Canvas Node、Timeline Clip、Generation Reference 同时引用。删除视图中的引用不等于删除 Asset。

### 3.3 Canvas Node

Canvas 对 Asset、Generation 配置或 Timeline 的可视化引用。节点位置和连线表达用户当前的组织意图，不自动等价于生成血缘。

### 3.4 Generation

产生 Asset 的异步任务。核心请求不包含单一 `placement` 字段；生成完成后由 Canvas、Editor 或 Studio 再引用结果 Asset。

### 3.5 Timeline / Clip / Take

- Timeline：项目级剪辑文档。
- Clip：一个 Asset 在时间线上的一次使用，保存 start、in/out、duration 和音频参数。
- Take：同一 Clip 时间槽的备选媒体版本。激活 Take 不改变原 Clip 的位置和原始 Asset，可随时恢复 Original。

### 3.6 两类关系

1. Canvas Edge：用户排列、连接和关注关系。
2. Generation Lineage：真实的 `derived_from`、`first_frame`、`last_frame`、`continuation_of`、`redo_of`、`timeline_render` 等来源关系。

本轮先在派生 Asset metadata 与 Canvas 引用中记录尾帧和时间线关系；后续升级为独立可查询的 lineage contract。

## 4. Canvas 与 Editor 的结合

### 4.1 Canvas -> Editor

- 单个视频或音频：加入当前时间线。
- 多个视频：按照显式选择顺序创建/追加时间线。
- 创建 Timeline Node，展示时长、Clip 数量和最近 Render。
- Timeline Node 打开 `/editor/:projectId`。

### 4.2 Editor -> Canvas

- 将 Timeline Node 写回 Canvas。
- 导出 Render 更新 Timeline Node。
- 截取片段保存为派生 Asset。
- AI redo 结果保存为 Asset 并挂为 Clip Take。
- 后续支持从 Editor 展开某次生成在 Canvas 中的完整血缘。

### 4.3 稳定引用规则

Editor Clip 必须引用具体 `assetId`，不能动态跟随 Canvas Generation Node 的当前 pinned output。Canvas 切换版本时，Editor 只有在用户明确确认后才能替换 Clip。

## 5. v0.2 功能范围

### P0：本轮

- 统一产品术语与 asset-first Generation contract。
- Command Kernel 基础合同。
- Editor 现有核心操作接入统一 command executor。
- 视频尾帧本地提取并保存为派生 Asset。
- 尾帧节点与下一段视频 Generation Node 自动创建。
- 多选 Canvas 视频创建/追加时间线。
- Timeline Node 在 Canvas 中可见并可打开 Editor。
- revision/CAS 保持现有保护。
- Command 请求运行时 Schema、Project Asset 校验、稳定 ID 和短期幂等回执。
- Editor 并发保存三方合并；MCP/CLI 只能执行增量 `editor.apply`，不能整份替换时间线。
- Generation 服务端从 Asset ID 与 generation intent 编译权威媒体输入。
- 图片 Clip 与可拖动的图片持续时间。
- MCP 本地素材导入桥与 2 秒 UI revision 同步。
- 单元测试、类型检查、i18n 和生产构建通过。

### P1：产品成片能力

- 字幕轨和 SRT 导入。
- 时间线吸附、缩放、波形和多选。
- 变速。
- 交叉溶解、淡入淡出和黑场过渡。
- 合成帧 Preview 与更完整 Diagnostics。
- AI Bridge：使用前后帧生成衔接片段。

### P2：Agent Control

- 本地 MCP Server。`已完成基础版`
- Project、Canvas、Editor、Assets、Generation 工具组。`已完成基础版`
- 模型 capability discovery。`已完成`
- 只读 MCP Resources。`未完成`
- 付费生成确认、幂等键、结构化结果和操作历史。
- Agent 修改后 UI 实时刷新。
- Codex 优先接入，Claude Code 和其他宿主使用同一协议。

## 6. Command Kernel

Command Kernel 是 UI、MCP 和未来 CLI 的唯一写入入口。MCP 不直接修改 SQLite，也不整份覆盖 Canvas Snapshot。

统一结果目标：

```ts
type CommandResult = {
  ok: boolean;
  projectId: string;
  commandId: string;
  changedIds: string[];
  revision?: number;
  warnings: string[];
  jobId?: string;
  editorUrl?: string;
};
```

第一阶段命令域：

```text
project.*
asset.*
canvas.apply
generation.prepare / submit / status / cancel
editor.apply / validate / export
```

所有写命令必须支持稳定 ID、预期 revision、幂等和可审计 origin。API Key、余额、计费和限流由所选 Provider 后端负责；BeatDesign 只提交请求并呈现返回结果或错误。外部上传、不可恢复删除和覆盖导出仍保留明确确认边界。

## 7. MCP 工具目录

MCP 是 Command Kernel 的薄适配层，不重新实现业务逻辑。

```text
Project:    list / create / get / open
Canvas:     get / apply / search / focus
Editor:     get / apply / preview / validate / focus / history / export
Assets:     list / import / inspect
Generation: models / prepare / submit / status / cancel
```

工具返回 Asset ID、本地 URL、节点 ID、Clip ID、revision 和 job status，不通过 MCP 传输大型视频二进制。

## 8. 交互要求

### 8.1 视频节点“继续生成”

1. 用户选择一个有本地 URL 的视频 Asset 或 Generation Output。
2. 点击“尾帧续写”。
3. BeatDesign 在浏览器本地解码最后一个可用画面。
4. PNG 保存到项目 Assets，metadata 标记 `video_tail_frame`。
5. Canvas 在原视频右侧创建尾帧 Asset Node。
6. Canvas 在尾帧右侧创建视频 Generation Node，并把尾帧作为首帧参考。
7. Composer 自动聚焦到新节点，用户填写下一段提示词后确认生成。

### 8.2 多片段创建时间线

1. 用户按顺序选择多个可用视频结果。
2. 点击“创建时间线”。
3. BeatDesign 一次读取并持久化时间线，避免逐个写入产生冲突。
4. Clip 按选择顺序首尾排列。
5. Canvas 创建或更新 Timeline Node，并连接所选视频。
6. 用户点击 Timeline Node 打开 Editor。

## 9. 安全与失败边界

- 文件选择和帧提取保持本地，不因选择或预览自动上传给 BeatAPI。
- 尾帧只在用户明确触发后写入项目本地 Assets。
- 生成仍走现有 precheck 和一次性 intent；Provider 后端是 API Key、余额、计费与限流状态的唯一事实来源。
- Timeline 与 Canvas 保存继续使用 revision/CAS。
- 多操作命令必须原子应用到内存文档，再执行一次持久化。
- 页面未打开时，浏览器预览与导出不可假装完成；未来由本地媒体 Worker 承接 headless 执行。

## 10. 验收标准

### 人工闭环

- 从本地视频或生成结果成功提取尾帧。
- 尾帧成为可复用 Asset，并在刷新后仍存在。
- 新视频 Generation Node 正确引用尾帧。
- 两个以上视频可以一次创建连续 Timeline。
- Timeline Node 可打开 Editor。
- Clip 顺序、时长和 Asset 引用正确。
- 原有 trim、split、move、delete、AI redo、Take、导出无回归。

### Agent-ready 内核

- Editor operations 可由纯 command executor 调用。
- Canvas operations 有稳定 contract 和纯文档 executor。
- Generation request 是 asset-first 且不绑定单一 placement。
- 命令结果结构可被后续 MCP 直接包装。
- 未知命令、非本项目 Asset 和 MCP 整份 Timeline 替换会被拒绝。
- 相同幂等键的重试返回同一持久化结果，不重复创建 Clip。
- 幂等键复用于不同 command 时必须失败，不能返回不相关的旧结果。

### 工程门禁

```text
pnpm typecheck
pnpm test
pnpm i18n:check
pnpm build
```

当前基础版不暴露整份 Snapshot 替换；`editor.snapshot` 是语义时间点快照，像素预览、浏览器导出、本地文件导入和 UI 实时事件桥仍未完成。

## 11. 本版本非目标

- 不内置通用聊天 Agent。
- 不实现多个宿主的完整一键安装器与 headless 媒体 Worker。
- 不引入完整 OpenReel 应用外壳。
- 不要求系统安装 FFmpeg。
- 不做桌面签名、公证和自动更新。
- 不做多人协作、云项目同步、支付和账户系统。

# BeatDesign 视频时间线与音频画布第一阶段 PRD

- 状态：Draft for implementation
- 目标版本：Phase 1 / localhost open-source release
- 产品范围：BeatDesign 开源仓库，不包含 SaaS Template
- 主要参考：Updream 的画布—编辑器闭环、MiniMax Design 的 OpenReel 编辑器集成
- 更新时间：2026-08-29

## 1. 产品结论

下一阶段将 BeatDesign 从“本地 AI 图片/视频生成画布”升级为“本地优先的 AI 视频创作工作台”。

产品由两个互补工作空间组成：

1. Canvas：负责素材、提示词、生成任务、版本和来源关系。
2. Editor：负责时间线、精确裁剪、音频、字幕、预览和 MP4 导出。

第一阶段只完成 GitHub 开源版和 localhost 工作流。Electron 桌面壳、通用 Plugin SDK、MCP 和内置 Agent 均不在本阶段范围内。

第一阶段必须跑通的唯一主链路：

```text
BeatAPI 生成 10 秒视频
  -> 视频本地化为 Asset
  -> 添加到时间线
  -> 截取其中 3-4 秒
  -> 导出 MP4
  -> 将选区交给 BeatAPI 重做
  -> 新结果作为 Take 返回原 Clip
  -> 替换并再次导出
  -> 导出结果回到 Canvas
```

## 2. 为什么现在做

当前 BeatDesign 已具备：

- Project、Studio、Canvas、Assets 和 Generation History。
- 图片与视频生成、视频分析和 BeatAPI 连接。
- 本地 SQLite、项目快照和本地项目素材目录。
- 生成结果自动本地化和素材来源记录。
- 底层 `AssetType` 已包含 `audio`。

当前关键缺口：

- Canvas 只能正式表达图片、视频和分析结果，不能表达音频素材。
- 没有 TimelineDocument、Track、Clip、Take 和 Render Job。
- 不能从生成视频中精确选择一个范围。
- 不能组合多个生成片段并导出一个成片。
- 不能将时间线选区重新送入 BeatAPI 并无损替换。

## 3. 产品目标与非目标

### 3.1 目标

1. 用户克隆仓库后，只需安装项目依赖并启动 localhost，不需要单独安装 FFmpeg。
2. 将 OpenReel 编辑能力作为第一方模块集成到 BeatDesign。
3. 支持视频、图片和音频素材进入同一时间线。
4. 支持非破坏式 trim、split、move、delete 和 undo/redo。
5. 支持 1080p MP4/H.264/AAC 导出。
6. 支持导出到本地下载，也支持保存为 BeatDesign 项目素材并创建 Canvas 节点。
7. 支持选区生成派生素材并调用 BeatAPI 重做。
8. 支持一个 Clip 保留多个 Take，并允许预览、切换和替换。
9. 增加 Canvas 音频素材节点，并打通音频到时间线的路径。
10. 保持当前 BeatDesign 视觉系统和本地优先边界。

### 3.2 非目标

- 不做 Electron、macOS 签名、公证和自动更新。
- 不分发原生 FFmpeg 二进制。
- 不做通用 Plugin SDK。
- 不做 MCP 或画布内聊天 Agent。
- 不做完整剪映、Premiere 或 DaVinci 功能对齐。
- 不承诺 4K 长视频、ProRes、多机位和电影级调色。
- 不做多人协作、云项目同步和素材市场。
- 不做完整 Skill 商店；可在后续独立维护示例 Skill 集合。

## 4. 第一阶段用户范围

主要用户：

- 使用 BeatAPI 生成图片和短视频的独立创作者。
- 希望在本机管理素材、选择片段并快速重做的 AI 视频开发者。
- 希望通过 GitHub 直接运行一个完整 AI 视频工作台的开源用户。

建议第一阶段媒体边界：

- 项目时长：5-120 秒。
- 默认输出：1920x1080、30 FPS、MP4、H.264/AAC。
- 首发浏览器：Chrome 稳定版；Edge 作为兼容目标。
- 素材：MP4/MOV 视频、PNG/JPEG/WebP 图片、MP3/WAV/M4A/AAC 音频。
- 一个主视频轨、最多两个附加视频/图片轨、最多三个音频轨、一个字幕轨。

## 5. 信息架构

现有 AppShell 模式从：

```text
Studio | Canvas | Assets
```

扩展为：

```text
Studio | Canvas | Edit | Assets
```

`Edit` 是项目级视图，不创建第二套 Project。进入方式包括：

- 顶部 WorkspaceSwitcher 的 Edit。
- 视频节点上下文工具栏中的“添加到时间线”。
- Timeline Node 中的“打开编辑器”。
- Assets 中素材菜单的“添加到时间线”。

项目层级：

```text
Project
├── CanvasSnapshot
├── Assets
├── Generations
└── Timelines
    ├── Timeline A
    └── Timeline B
```

## 6. Canvas 新增节点

### 6.1 Audio Asset Node

第一阶段必须新增音频素材节点。它代表可连接、可播放、可送入时间线或模型的音频 Asset，不承担精确音频编辑。

字段：

```text
id
assetId
type: audio
audioRole: music | voice | sound_effect | source_audio | reference
name
url
durationSec
waveformPeaks
sourceGenerationId?
sourceAssetId?
```

节点能力：

- 播放、暂停、跳转。
- 显示波形、时长和音频用途。
- 添加到当前时间线。
- 作为 BeatAPI reference/driving audio。
- 从视频节点“提取音频”后生成。
- 展示本地化、缺失和失败状态。

节点视觉：

- 推荐尺寸 320x104。
- 使用 `--beat-surface`、`--beatcanvas-line` 和 8px 圆角。
- 波形使用冷蓝 `--beat-graph`，不使用新的紫色或绿色品牌色。
- Play 按钮使用中性高对比色；只有生成、重做、导出等主动作使用橙色。
- 时间码使用 Geist Mono 和 tabular numerals。
- 被选中时沿用 Canvas 冷蓝边框和外发光。

### 6.2 Timeline Node

Timeline Node 是 Canvas 对一个 TimelineDocument 的入口和结果摘要，不把完整时间线塞进无限画布。

字段：

```text
id
timelineId
name
durationSec
aspectRatio
lastRenderAssetId?
coverAssetId?
clipCount
updatedAt
```

节点能力：

- 打开编辑器。
- 接收图片、视频、音频 Asset 连接。
- 显示最新成片封面、项目时长和 Clip 数量。
- 导出成功后更新最新 Render。
- 将 Render 拖出/连接到下游生成节点。

节点视觉：

- 推荐尺寸 360x220。
- 上部为 16:9/9:16 预览区域，下部为简化时间线条带。
- 节点标签使用 `Timeline` 或本地化名称，不命名为 Plugin。
- “打开编辑器”是中性导航动作；“导出”与“AI 重做”才使用橙色主动作。

### 6.3 Derived Clip Asset

截取选区后创建新的 Video Asset Node，而不是创建新的特殊节点类型。

通过 metadata 表达：

```text
assetClass: derived
parentAssetId
sourceInSec
sourceOutSec
operation: timeline_extract
timelineId
clipId
```

节点显示“截取 3.2-6.8s”等来源徽标。

### 6.4 本阶段不新增的节点

- 不新增独立 Music、Voice、Sound Effect 节点类型；统一为 Audio Asset + audioRole。
- 不新增 Subtitle Canvas Node；字幕第一阶段属于 TimelineDocument。
- 不新增 Agent Node、MCP Node 和 Skill Node。
- 不新增 FFmpeg Node；媒体引擎是内部实现细节。

## 7. Editor 界面设计

### 7.1 总体布局

Editor 使用当前 AppShell 的 56px 顶栏和全屏生产工作区，不增加永久全局侧边栏。

```text
┌──────────────────────────────────────────────────────────────┐
│ Back to Canvas | Timeline name | Saved | Ratio | Export      │
├──────────────┬───────────────────────────────┬───────────────┤
│              │                               │               │
│ Project      │          Preview              │   Inspector   │
│ Assets       │                               │               │
│              │                               │               │
├──────────────┴───────────────────────────────┴───────────────┤
│ Toolbar: Undo Redo Split Delete Snap Zoom                    │
├──────────────────────────────────────────────────────────────┤
│ Video 2  ─────────────────────────────────────────────       │
│ Video 1  ───── Clip A ───── Clip B ───────────────────       │
│ Audio 1  ───────── Waveform ──────────────────────────       │
│ Captions ───── Cue ───── Cue ───── Cue ───────────────       │
└──────────────────────────────────────────────────────────────┘
```

布局建议：

- 左侧素材区：260-300px，可折叠。
- 右侧 Inspector：280-320px，无选择时折叠或显示项目设置。
- Timeline：默认 260px 高，可上下拖动。
- Preview：占据剩余空间。
- 小于 960px 时，素材区和 Inspector 改为抽屉；时间线仍保持可操作。

### 7.2 与 BeatDesign UI 匹配

必须直接复用现有 Token：

- 背景：`--beat-bg`。
- 主表面：`--beat-surface`。
- 抬升表面：`--beat-surface-2`。
- 边线：`--beat-border` / `--beatcanvas-line`。
- 文本：`--beat-text-1/2/3`。
- 品牌动作：`--beat-accent`。
- 选择、吸附、轨道焦点：`--beat-graph`。
- 成功、警告、错误：现有 Canvas semantic tokens。

字体：

- UI：Figtree / CJK fallback。
- 时间码、FPS、时长、导出数据：Geist Mono。

形状：

- 控件 4-8px 圆角。
- Panel 12px 圆角。
- Preview/媒体 16px 圆角。
- 不把 OpenReel 默认皮肤直接搬入 BeatDesign。
- 不引入第二套紫色、渐变主色和高饱和多色按钮。

交互：

- 80ms/160ms 微交互，不给拖动、播放头或 trim handle 增加延迟感。
- 所有 Timeline 操作支持键盘和可见焦点。
- 状态不能只靠颜色表达。
- 所有触控目标尽可能达到 44px。

### 7.3 第一阶段显示的工具

左侧：

- Project Assets。
- Videos / Images / Audio 筛选。
- 搜索。
- 添加到时间线。

顶部：

- 返回 Canvas。
- Timeline 名称。
- 自动保存状态。
- 画幅。
- Export。

Preview：

- 播放、暂停。
- 前后跳转。
- 当前时间/总时长。
- 静音。
- 预览缩放。
- 适应画布。

Timeline：

- Select、Split、Delete。
- Trim handles。
- Drag move。
- Snap。
- Undo/Redo。
- Timeline zoom。
- Track lock/mute/solo。
- Add track。

Inspector：

- Transform：position、scale、rotation、fit。
- Audio：volume、mute、fade in/out。
- Speed：第一阶段只支持 0.5x、1x、2x；如实现风险高可移至 Phase 1.1。
- Clip metadata：素材名称、source in/out、timeline start/end。

### 7.4 默认隐藏的 OpenReel 功能

- Graphics、SVG、Stickers、Backgrounds。
- 高级 Effects 和模板。
- LUT、Scopes、复杂 Color Grading。
- Keyframes、Speed Ramp、Optical Flow、Stabilization。
- Recording、Webcam、Screen Capture。
- Multicam、3D、Motion Tracking。
- AI Agent、Chat、MCP、任意第三方模型 Provider。
- Templates Marketplace、Stock Media、Music Marketplace。

代码可以保留在 Fork 中，但不进入首发导航和默认 Bundle；无法按需拆包的模块应在 Fork 中删除或延迟加载。

## 8. OpenReel 引入方案

### 8.1 引入方式

OpenReel 以固定 commit 的 Fork 形式进入 BeatDesign，不使用 Git Submodule。

推荐先作为同仓第一方 micro-frontend：

```text
packages/openreel-editor
  -> 独立 Vite build
  -> 同源挂载在 /editor-runtime/
  -> BeatDesign /editor/:timelineId 路由承载
```

理由：

- OpenReel 当前是完整应用而不是稳定的 UI npm 包。
- 隔离 OpenReel 的 React、Zustand、Worker、WASM 和样式依赖。
- 避免立即将 OpenReel 大量状态耦合到 Canvas 组件。
- 后续同步上游更新更清晰。
- 可以通过同源 API 和 typed bridge 与 BeatDesign 通信。

第一阶段 bridge 不是通用 Plugin SDK，只定义本编辑器需要的固定协议：

```text
host.ready
host.getTimeline
host.saveTimeline
host.listAssets
host.resolveAsset
host.saveDerivedAsset
host.submitGeneration
host.getGenerationStatus
editor.selectionChanged
editor.exportProgress
editor.projectChanged
```

### 8.2 保留

- `packages/core` 中 timeline、actions、undo/redo、media、playback。
- WebCodecs Export Backend。
- MediaBunny 容器读写。
- WebGPU/Canvas2D Preview。
- Web Audio、waveform 和基础音频能力。
- Trim、split、ripple delete、move、snap。
- Text/caption 基础模型。
- 项目 JSON schema 和版本迁移能力。
- 缺失素材检查所需能力。

### 8.3 删除

- OpenReel 内置 Agent、Chat 和模型配置界面。
- KieAI 或其他与 BeatAPI 重复的生成 Provider。
- OpenReel 自带账户、云同步、订阅或远程项目功能。
- Desktop、mobile 和原生安装器代码，不进入 BeatDesign Phase 1 构建。
- OpenReel Welcome、Recent Projects 和独立项目首页。
- 重复的导航、主题切换和品牌外壳。
- 与 BeatDesign Assets/Generations 重复的云素材来源。

### 8.4 替换

- OpenReel IndexedDB 项目保存 -> BeatDesign Timeline service + local SQLite。
- OpenReel 最近项目 -> BeatDesign Project/Timeline 列表。
- OpenReel 媒体导入 -> BeatDesign Asset Adapter。
- OpenReel 下载导出 -> BeatDesign Render service；仍保留“下载文件”选项。
- OpenReel 生成能力 -> BeatAPI Generation service。
- OpenReel UI tokens -> BeatDesign `--beat-*` 和 `--beatcanvas-*`。
- OpenReel toast/dialog -> BeatDesign 现有组件和 i18n。

### 8.5 暂时保留但关闭入口

- 字幕样式、基础转场、基础特效、图形、关键帧。
- 后续可以逐项打开，不在第一阶段重写。

## 9. FFmpeg 与浏览器媒体方案

### 9.1 第一阶段

用户不安装系统 FFmpeg。

默认媒体链路：

```text
Preview        -> WebCodecs + WebGPU/Canvas2D
Audio          -> Web Audio
MP4 mux        -> MediaBunny
Export         -> OpenReel WebCodecsBackend
Fallback       -> ffmpeg.wasm（可选、短素材）
```

第一阶段不把原生 macOS/Windows/Linux FFmpeg 二进制提交到 Git 仓库。

### 9.2 ffmpeg.wasm 策略

- 不作为 P0 导出主引擎。
- 如必须启用，以依赖方式安装并从 localhost 自托管 Core，不从 CDN 动态获取。
- 只用于不兼容素材转码、短选区截取或浏览器能力 Fallback。
- 默认先采用单线程版本，避免第一阶段强制 COOP/COEP；多线程与长视频性能留到后续。
- 在 `THIRD_PARTY_NOTICES.md` 中单独记录 wrapper、core 和 FFmpeg license。
- 在许可证方案正式确认前，可通过 feature flag 关闭 wasm fallback，不阻塞 WebCodecs 主链路。

### 9.3 桌面阶段

Electron 阶段再把合规的原生 FFmpeg/ffprobe 作为 Sidecar 放入安装包。届时替换 Export Backend，不重写 Timeline、Preview、项目格式和 Canvas 闭环。

## 10. 核心数据模型

### 10.1 TimelineDocument

```ts
type TimelineDocument = {
  schemaVersion: 1;
  id: string;
  projectId: string;
  name: string;
  width: number;
  height: number;
  frameRate: number;
  sampleRate: number;
  channels: number;
  tracks: TimelineTrack[];
  markers: TimelineMarker[];
  durationSec: number;
  createdAt: string;
  updatedAt: string;
};
```

### 10.2 Track

```ts
type TimelineTrack = {
  id: string;
  kind: 'video' | 'audio' | 'subtitle' | 'text' | 'graphics';
  name: string;
  order: number;
  locked: boolean;
  hidden: boolean;
  muted: boolean;
  solo: boolean;
  clips: TimelineClip[];
};
```

### 10.3 Clip

```ts
type TimelineClip = {
  id: string;
  assetId: string;
  trackId: string;
  timelineStartSec: number;
  sourceInSec: number;
  sourceOutSec: number;
  durationSec: number;
  speed: number;
  volume: number;
  fadeInSec: number;
  fadeOutSec: number;
  activeTakeId: string | null;
  takeIds: string[];
};
```

### 10.4 Take

```ts
type ClipTake = {
  id: string;
  clipId: string;
  assetId: string;
  generationId: string | null;
  source: 'original' | 'derived' | 'beatapi';
  prompt: string | null;
  modelId: string | null;
  status: 'ready' | 'pending' | 'failed';
  createdAt: string;
};
```

### 10.5 RenderJob

```ts
type RenderJob = {
  id: string;
  projectId: string;
  timelineId: string;
  status: 'queued' | 'rendering' | 'saving' | 'succeeded' | 'failed' | 'cancelled';
  progress: number;
  format: 'mp4';
  width: number;
  height: number;
  frameRate: number;
  resultAssetId: string | null;
  error: string | null;
};
```

### 10.6 数据库范围

建议新增：

- `timeline_document`
- `timeline_take`
- `render_job`

TimelineDocument 第一阶段可以整体 JSON 保存并使用 revision/CAS，避免过早把每个 Clip 拆成关系表。Take 与 RenderJob 单独建表以便关联 Generation 和 Asset。

Canvas snapshot 升级时必须兼容旧项目；旧项目打开后不得丢失图片或视频节点。

## 11. 功能需求

### FR-1 创建与打开时间线

- 一个 Project 可以有多个 Timeline。
- 第一次添加素材时可以自动创建“Timeline 1”。
- 用户可以从 Canvas、Assets 或 Edit 进入。
- 重启 localhost 后时间线可恢复。

### FR-2 素材进入时间线

- 图片、视频、音频均可添加。
- 同一 Asset 重复添加时复用 Asset，不重复复制文件。
- 默认添加到兼容轨道；没有轨道时自动创建。
- OpenReel 内部只保存 `assetId` 和相对引用，不保存临时 Blob URL 作为真相。

### FR-3 非破坏式剪辑

- 支持 trim、split、move、delete、ripple delete。
- 原始 Asset 不改变。
- Clip 的 sourceIn/sourceOut 不得越界。
- 同轨 Clip 默认不允许重叠。
- 所有 P0 剪辑操作必须进入 Undo/Redo。

### FR-4 音频

- Canvas 可创建和恢复 Audio Asset Node。
- Timeline 可添加音频轨和音频 Clip。
- Preview 可同步播放音视频。
- 支持 volume、mute、fade in/out。
- 第一阶段不要求自动字幕、Beat Sync 和降噪。

### FR-5 选区派生素材

- 用户可选择一个 Clip 或时间范围。
- “截取为新素材”生成新的本地 Video Asset。
- 派生 Asset 记录 parent、sourceIn/out、timeline、clip 和 operation。
- 新 Asset 可出现在 Assets 和 Canvas。

### FR-6 BeatAPI 重做

- 用户选择 Clip/选区并点击“AI 重做”。
- 弹出与现有 BeatDesign Composer 一致的轻量生成面板。
- 显示模型、提示词、参考输入和付费确认。
- 使用派生视频或首尾帧作为 BeatAPI 输入。
- 返回结果必须先本地化，再进入 Take。
- 失败不改变当前 Clip。
- 成功后用户可预览新 Take 并选择替换。

第一阶段只保证一种已验证的 BeatAPI 视频编辑/视频转视频路径。模型能力由现有 effect registry 和 adapter 决定，不在 Editor 内建立第二套模型目录。

### FR-7 MP4 导出

- 默认 1080p/30fps/H.264/AAC。
- 支持下载文件和保存到项目。
- 保存到项目后创建 Render Asset，并允许创建 Canvas Output Node。
- 显示进度、取消、成功和失败状态。
- 导出期间不冻结整个界面。
- 导出结果不得包含未解释黑帧、重叠 Clip 或丢失素材。

### FR-8 自动保存与恢复

- 时间线变更采用 dirty state + debounce 自动保存。
- 页面隐藏、刷新和离开前执行 flush。
- 使用 revision/CAS 防止旧状态覆盖新状态。
- 保存失败要明确提示，不得伪装为 Saved。
- 空文档不得覆盖已有非空文档。

## 12. 关键状态和错误处理

必须处理：

- Asset 文件丢失。
- 不支持的 Codec。
- 浏览器不支持 WebCodecs/WebGPU。
- 导出内存不足。
- 导出取消。
- BeatAPI 任务失败或超时。
- 派生素材保存失败。
- 页面刷新时仍在保存。
- 时间线文档版本冲突。
- Audio duration/metadata 读取失败。
- Clip 超出源时长。
- 同轨重叠和可见视频空隙。

Editor 必须提供只读 Diagnostics：

- `timeline_gap`
- `clip_overlap`
- `media_missing`
- `caption_overlap`
- `caption_out_of_video`
- `tiny_clip`
- `empty_track`

P0 导出前自动运行 Diagnostics；Error 级问题阻止导出，Warning 级问题允许用户确认后继续。

## 13. 测试与验收计划

### 13.1 单元测试

- Clip trim 数学和边界。
- Split 后 sourceIn/sourceOut 连续。
- Ripple delete 后轨道位置。
- Move 和 snap 计算。
- Take 创建、切换、替换和回滚。
- Audio 节点序列化、反序列化和旧快照兼容。
- Timeline schema normalize/migrate。
- RenderJob 状态机。
- revision/CAS 冲突。
- 空时间线保护。

### 13.2 集成测试

- BeatDesign Asset -> OpenReel MediaItem。
- OpenReel Project JSON -> Timeline service -> reload。
- Export Blob -> localhost -> project-assets -> Asset index。
- 选区 -> Derived Asset -> generation intent。
- 模拟 BeatAPI 成功、失败、超时和取消。
- Take 替换后 Timeline 保存和恢复。
- 音频 Asset 添加到音频轨并恢复。

### 13.3 E2E 主路径

使用一个固定 10 秒测试视频：

1. 打开 Canvas。
2. 将视频添加到 Timeline。
3. Trim 为 3.2-6.8 秒。
4. 保存并刷新页面。
5. 验证 Clip 仍为 3.6 秒。
6. 导出 MP4。
7. 本地 probe 输出：分辨率、时长、FPS、音频流。
8. 选择该 Clip 并创建 Derived Asset。
9. 使用 mock BeatAPI 返回新视频。
10. 新视频成为 Take。
11. 切换并替换当前 Clip。
12. 再次导出。
13. 保存到项目并在 Canvas 创建 Output Node。

### 13.4 媒体测试矩阵

- 横屏 MP4、有音频。
- 横屏 MP4、无音频。
- 竖屏 MP4。
- MOV 输入。
- MP3、WAV、M4A。
- 图片作为定长 Clip。
- 两个连续视频 Clip。
- 视频 + 背景音乐。
- 30 秒、60 秒、120 秒时间线。
- 缺失文件和损坏文件。

### 13.5 视觉与音频 QA

- Preview 与导出画面比例一致。
- Trim 后第一帧、最后一帧符合选区。
- 无意外黑帧。
- 转场未启用时是硬切。
- 音画同步。
- 音频无意外静音、爆音和截断。
- Canvas Output Node 展示真实导出封面。
- 音频节点波形、时长和播放状态一致。

### 13.6 回归门槛

每个合并批次必须通过：

```text
pnpm typecheck
pnpm i18n:check
pnpm test
pnpm build
```

同时保留 Canvas 的：

- Zoom、pan、connect、selection、undo/redo。
- 项目快照与空状态保护。
- 生成任务和本地化。
- Assets/Studio/Canvas 模式切换。
- 当前 Start Here 空状态视觉。

## 14. 实施里程碑

### M0：技术验证

- Fork 并固定 OpenReel commit。
- 在 BeatDesign 仓库内完成独立构建。
- 加载一个本地 10 秒 MP4。
- Preview、trim、split、MP4 export 可用。
- 不要求保存、Canvas 或 BeatAPI。

退出条件：用户不安装系统 FFmpeg即可完成 10 秒 -> 3.6 秒 -> MP4。

### M1：本地项目闭环

- Timeline service 和数据库。
- Asset Adapter。
- 自动保存、刷新恢复。
- Canvas Timeline Node。
- Audio Asset Node。
- Export 保存到项目并返回 Canvas。

退出条件：重启 localhost 后项目、视频、音频、时间线和导出节点都可恢复。

### M2：BeatAPI 重做闭环

- 选区派生素材。
- 现有 effect registry 接入。
- 付费确认。
- Generation -> Take。
- Take 预览、替换和回滚。

退出条件：选区可重做，失败不破坏原 Clip，成功可替换并导出。

### M3：可靠性与发布准备

- Diagnostics。
- Export progress/cancel。
- 不支持格式提示与 fallback。
- 许可证和 Third Party Notices。
- 中英文文案。
- README、架构文档、示例项目和演示素材。

退出条件：主路径、媒体矩阵、回归门槛全部通过。

## 15. 开源用户体验

目标启动方式：

```bash
pnpm install
pnpm db:push
pnpm dev
```

要求：

- 不要求 `brew install ffmpeg`。
- 不要求 Git Submodule。
- 不从 CDN 动态加载 OpenReel、WASM、字体或编辑器核心。
- 没有 BeatAPI key 时仍可导入、剪辑和导出本地视频。
- 用户只在调用 BeatAPI 时配置 key。
- README 明确支持的浏览器、格式、时长和已知限制。
- 提供一个体积可控、许可证清楚的测试素材和示例时间线。

## 16. 开源与许可证

- BeatDesign 主项目继续使用 Apache-2.0。
- OpenReel Fork 保留 MIT License、版权声明和上游 commit。
- Mediabunny、FFmpeg wrapper/core、字体、图标和测试素材单独记录。
- 新增 `THIRD_PARTY_NOTICES.md`。
- 如启用 ffmpeg.wasm core，必须明确其实际 license，不将其声明为 Apache-2.0。
- 第一阶段不复制 MiniMax Design 打包文件、其 FFmpeg 二进制或专有 Host 代码。

## 17. 发布判定

第一阶段被认为完成，当且仅当：

1. 新用户从 GitHub 克隆后无需安装系统 FFmpeg即可剪辑和导出。
2. 10 秒生成视频可在 Timeline 中精确截取 3-4 秒。
3. 时间线、音频节点和本地素材可在刷新/重启后恢复。
4. MP4 可下载，也可保存到项目并回到 Canvas。
5. 选区可调用 BeatAPI 重做并作为 Take 返回。
6. 原 Clip 和原 Asset 始终可以恢复。
7. 主 E2E、媒体 QA 和项目回归全部通过。
8. 不引入侧边 Agent、Electron、通用 Plugin SDK 或 MCP。

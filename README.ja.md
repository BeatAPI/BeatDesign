<p align="center">
  <img src="./docs/assets/beatdesign-readme-cover-v3.jpg" alt="BeatDesignの無限Canvasとローカル動画Editor" width="100%" />
</p>

<h1 align="center">BeatDesign</h1>

<p align="center">
  <strong>ローカルで動くHiggsfieldのオープンソース代替</strong><br />
  無限Canvasで画像と動画のワークフローを組み立て、ブラウザーネイティブのEditorで仕上げ、MCP対応Agentから同じProjectを操作できます。
</p>

<p align="center">
  <a href="https://design.beatapi.io">ウェブサイト</a> ·
  <a href="#クイックスタート">クイックスタート</a> ·
  <a href="#agentからbeatdesignを使う">MCP</a> ·
  <a href="./docs/PRODUCT_PLAN_AND_STATUS.md">製品ステータス</a>
</p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.zh-CN.md">简体中文</a> ·
  <strong>日本語</strong>
</p>

BeatDesignは、AI画像・動画制作のための独立したオープンソース、ローカルファーストのワークスペースです。Higgsfieldのような一貫した制作フローを、自分のマシンで実行、確認、拡張したい人に向けて作られています。

## 2つの制作モード、1つのProject

### 無限Canvas

プロンプト、画像、動画、音声を配置できます。ノードを接続し、アイデアを分岐させ、生成結果を比較して再利用し、ビジュアルワークフロー全体を1つのProjectに保存します。

### 動画Editor

Canvasの結果をローカルTimelineへ送ります。トリミング、分割、移動、音声ミックス、SRT字幕の読み込み、AIによる別Takeの作成、プレビュー、ブラウザーでのMP4書き出しに対応します。

Studioは集中した生成画面を提供します。Assetsでは、読み込み済み・生成済みのファイルをCanvas、Editor、MCPから共通して利用できます。

## BeatDesignを選ぶ理由

- **デフォルトでローカル保存。** Project、メディア、Canvasの状態、Timeline、生成履歴はローカルワークスペースに保存されます。
- **CanvasとEditorがつながる。** 生成結果は再利用可能なProject Assetとなり、1つのツール内に閉じ込められません。
- **好きなAgentを使える。** Codex、Claude Code、CursorなどのMCP Hostが、ブラウザーに表示されている同じProjectを読み取り、更新できます。
- **生成サービスは自分で設定。** BeatAPIが組み込みProviderです。ローカルでの読み込み、配置、編集、プレビュー、書き出しにAPI Keyは不要です。
- **Forkしやすい設計。** Provider Adapter、Projectストレージ、Command Kernelには明確な拡張ポイントがあります。

## アイデアから完成動画まで

```text
プロンプトまたはローカルメディア
        ↓
無限Canvas ───── 接続、生成、分岐、比較
        ↓
共有Assets ───── 画像、動画、音声、派生Clip
        ↓
動画Editor ───── トリミング、配置、プレビュー、MP4書き出し
        ↑
任意のMCP Agent ─ 同じローカルProjectを操作
```

## クイックスタート

Node.js 22以上、`pnpm` 10以上、macOSまたはWindows上の最新Chromeが必要です。

```bash
pnpm install
pnpm db:push
pnpm dev
```

[http://127.0.0.1:3020](http://127.0.0.1:3020)を開きます。

画像・動画の生成や分析、AI再生成を使う場合にのみ、自分の[BeatAPI API Key](https://beatapi.io/dashboard/apikeys)を追加します。ローカルファイルを選択しただけではProviderへアップロードされません。

### 起動方法を選ぶ

| コマンド | 起動するもの |
| --- | --- |
| `pnpm dev` | ビジュアルワークスペース |
| `pnpm dev:agent` | ビジュアルワークスペースとローカルHTTP MCP Endpoint |
| `pnpm mcp` | コーディングAgent向けstdio MCP Server |

## AgentからBeatDesignを使う

BeatDesignはProject、Asset、Canvas、生成、Editor操作をカバーする26個のローカルMCPツールを提供します。Agentによる変更は同じProjectサービスを通り、ブラウザーのワークスペースに表示されます。

MCP Hostへ接続した後は、次のように依頼できます。

> 最新のBeatDesign Projectを開き、このClipをTimelineへ追加して字幕を読み込み、確認できるようにEditorを開いてください。

## プラットフォーム互換性

| コーディングAgent / プラットフォーム | ステータス | クイックセットアップ |
| --- | --- | --- |
| [Claude Code](./integrations/claude-code/beatdesign/README.md) | ✅ 対応 | [プラグインまたはMCP設定](./integrations/claude-code/) |
| [Codex](./integrations/codex/beatdesign/README.md) | ✅ 対応 | [プラグイン設定](./integrations/codex/beatdesign/README.md) |
| [ZCode](./integrations/zcode/config.example.json) | ✅ 対応 | [MCP設定](./integrations/zcode/config.example.json) |
| [OpenCode](./integrations/opencode/) | ✅ 対応 | [MCP設定](./integrations/opencode/) |
| [Cursor](./integrations/cursor/mcp.json.example) | ✅ 対応 | [MCP設定](./integrations/cursor/mcp.json.example) |
| [Windsurf](./integrations/windsurf/mcp_config.json.example) | ✅ 対応 | [MCP設定](./integrations/windsurf/mcp_config.json.example) |
| [VS Code + GitHub Copilot](./integrations/vscode/mcp.json.example) | ✅ 対応 | [MCP設定](./integrations/vscode/mcp.json.example) |
| [Cline / Roo Code](./integrations/cline/mcp_settings.json.example) | ✅ 対応 | [MCP設定](./integrations/cline/mcp_settings.json.example) |
| [Qwen Code](./integrations/qwen/settings.example.json) | ✅ 対応 | [MCP設定](./integrations/qwen/settings.example.json) |
| [Gemini CLI](./integrations/gemini/settings.example.json) | ✅ 対応 | [MCP設定](./integrations/gemini/settings.example.json) |
| [Hermes Agent](./integrations/hermes/config.yaml.snippet) | ✅ 対応 | [MCP設定](./integrations/hermes/config.yaml.snippet) |
| [Kiro](./integrations/kiro/mcp.json.example) | ✅ 対応 | [MCP設定](./integrations/kiro/mcp.json.example) |
| [Trae](./integrations/trae/mcp.json.example) | ✅ 対応 | [MCP設定](./integrations/trae/mcp.json.example) |
| [WorkBuddy](./integrations/workbuddy/beatdesign/README.md) | ✅ 対応 | [Connector設定](./integrations/workbuddy/beatdesign/README.md) |
| [QwenWork](./integrations/qwenwork/mcp.json.example) | ✅ 対応 | [HTTP Connector](./integrations/qwenwork/mcp.json.example) |
| [Doubao Work](./integrations/doubao-work/mcp.json.example) | ✅ 対応 | [HTTP Connector](./integrations/doubao-work/mcp.json.example) |

[Agent連携ガイドの詳細を見る →](./integrations/README.md)

## 現在利用できる機能

- 画像・動画生成とStandard、Deep動画分析。
- Canvas上の画像、動画、音声、生成、Timeline、テキストノード。
- Studio、Canvas、Editor、MCPで共有されるProject Assets。
- 画像、動画、音声、SRT字幕トラックに対応した非破壊Timeline編集。
- WebCodecsとMediabunnyによるローカルプレビューとブラウザー上のH.264/AAC MP4書き出し。
- 英語、中国語、日本語のインターフェース。
- ローカルstdioとStreamable HTTP MCP Transport。

BeatDesignの現行リリースは、ローカルでのショート動画制作に重点を置いています。ホスト型コラボレーション、複数の名前付きTimeline、高度なトランジション、速度変更、波形、デスクトップパッケージは今後の範囲です。

[実装済み機能と計画の全体を見る →](./docs/PRODUCT_PLAN_AND_STATUS.md)

## プロジェクトガイド

- [製品ステータス](./docs/PRODUCT_PLAN_AND_STATUS.md)
- [MCP設定](./docs/MCP.md)
- [アーキテクチャ](./ARCHITECTURE.md)
- [Provider連携](./PROVIDERS.md)
- [コントリビューション](./CONTRIBUTING.md)
- [セキュリティ](./SECURITY.md)

## ライセンス

BeatDesignは[Apache License 2.0](./LICENSE)で提供されます。BeatAPIおよびBeatDesignの商標、第三者モデルへのアクセス、同梱される第三者コンポーネントには、それぞれの条件が適用されます。[第三者に関する通知](./third_party/)と[商標ポリシー](./TRADEMARKS.md)をご覧ください。

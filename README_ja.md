# okbot

自分の API URL とキーで、選んだモデルサービスに接続するパーソナル AI アシスタント。

[简体中文](./README.md) · [English](./README_en.md) · [日本語](./README_ja.md) · [한국어](./README_ko.md) · [Русский](./README_ru.md)

[Windows 版](https://github.com/superman2003/okbot/releases/tag/custom-0.1.25-1) · [問題報告](https://github.com/superman2003/okbot/issues) · [MIT](./LICENSE)

## 📥 ダウンロード

現在のリリースは **Windows x64 インストーラー** [okbot-0.1.25-win-x64.exe](https://github.com/superman2003/okbot/releases/download/custom-0.1.25-1/okbot-0.1.25-win-x64.exe)（約160 MB）を提供します。[リリースページ](https://github.com/superman2003/okbot/releases/tag/custom-0.1.25-1)に `SHA256SUMS` もあります。

Electron、magpie、DeepSeek Harness、Cua Driver を同梱します。Node.js と Go の別途インストールは不要です。このビルドは未署名です。ウィンドウを閉じるとトレイに格納され、トレイから終了できます。他の OS はソースビルドを参照してください。

## モデルサービスの設定

1. 初回画面、または設定のモデル接続からカスタム上流を開きます。
2. **API Base URL** と **API Key** を入力します。例：`https://your-api.example/v1`。
3. モデル一覧を取得して選択します。一覧がない場合は正確な ID を入力できます。
4. モデルをテストします。短いリクエストを送信し、通常の API 料金が発生する場合があります。
5. 保存して使用します。接続と既定モデルは端末に保存され、再起動後も使えます。

**OpenAI Chat Completions 互換 API** に対応します。`/chat/completions` は必須で、`/models` は任意です。他のプロトコルだけを提供するサービスは直接使えません。ルート URL には `/v1` を補い、カスタムパスは保持します。

リクエストは設定したサービスに送信されます。料金、制限、機能はサービスとモデルに依存します。既存の公式 API・OKINTO 接続も保持しています。個別のモデル設定があるボットや会話は別途切り替えてください。

## 機能と変更点

- URL・キーの設定、モデル取得、選択、ID 入力とテスト。
- 接続元ごとのルーティングと上流モデルの名前空間の保持。
- 接続と既定モデルの端末保存。保存済みキーは末尾のみ表示。
- 上流のボット、ペルソナ、ワークスペース、記憶、ツール、バックグラウンド処理を継承。
- アプリ内チャット、WeChat、Feishu などのチャネル実装を保持。
- Windows EXE、ローカル起動スクリプト、パッケージの動作確認。

ツール、コンピューター操作、マルチモーダル機能はモデルと接続方法によって異なります。

## ソースから実行

**Node.js 22.13+** と **Go 1.26.8+** が必要です。Setup はゲートウェイとランタイムを準備します。

```bash
git clone https://github.com/superman2003/okbot.git
cd okbot
npm ci
npm run setup
npm run build
npm start
```

通常のコンソールは `http://127.0.0.1:3600/` です。準備とコンパイル後、Windows では `Start-Okbot.cmd` も利用できます。既定のポートは3610で、認証済みページを開きます。

ソース版のデータは `data/`、Windows デスクトップ版は `%APPDATA%\anymodel bot\data` にあります。キー、会話、依存関係、ビルド出力はリポジトリに含めません。

## Windows インストーラーのビルド

Windows x64 で実行します。

```bash
npm run dist -- --win nsis --x64
```

出力先は `release/` です。開発時は `npm run electron:dev` を使用します。固定バージョンのコンポーネントを取得し、Cua Driver の SHA256 を検証します。

## ドキュメントと参加

- [開発ガイド](./docs/development_ja.md)
- [貢献ガイド](./CONTRIBUTING_ja.md)
- [セキュリティ報告](./SECURITY_ja.md)
- [ボット一覧](./bots)
- [不具合・機能提案](https://github.com/superman2003/okbot/issues)

## 出典とライセンス

[superman2003](https://github.com/superman2003) が保守し、[wmn1525/AnyModelBot](https://github.com/wmn1525/AnyModelBot) を基に開発しています。元のプロジェクトは [modelflare-ai/AnyModelBot](https://github.com/modelflare-ai/AnyModelBot) です。元のコードと貢献履歴を保持しています。

[MIT ライセンス](./LICENSE) を継承します。再配布時は元の著作権と許諾表示を保持してください。同梱コンポーネントのライセンスは [第三者通知](./THIRD_PARTY_NOTICES_ja.md) と [LICENSES](./LICENSES) を参照してください。元の作者と依存プロジェクトに感謝します。

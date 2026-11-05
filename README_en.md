# okbot

A personal AI assistant that connects to the model service you choose with your own API URL and key.

[简体中文](./README.md) · [English](./README_en.md) · [日本語](./README_ja.md) · [한국어](./README_ko.md) · [Русский](./README_ru.md)

[Windows download](https://github.com/superman2003/okbot/releases/tag/custom-0.1.25-1) · [Issues](https://github.com/superman2003/okbot/issues) · [MIT license](./LICENSE)

## 📥 Download

The current release provides a **Windows x64 installer**: [okbot-0.1.25-win-x64.exe](https://github.com/superman2003/okbot/releases/download/custom-0.1.25-1/okbot-0.1.25-win-x64.exe), about 160 MB. The [release page](https://github.com/superman2003/okbot/releases/tag/custom-0.1.25-1) includes `SHA256SUMS`.

Electron, the magpie gateway, DeepSeek Harness and Cua Driver are included. No separate Node.js or Go installation is needed. The local build is unsigned. Closing the window hides the app to the tray; use the tray menu to quit.

Upstream supports several operating systems. This release provides only the Windows x64 installer above; other platforms can use the source build workflow.

## Configure your model service

1. Open the first-launch form, or Settings → Models → Custom upstream → Configure.
2. Enter your **API Base URL** and **API Key**, for example `https://your-api.example/v1`.
3. Fetch upstream models and select one, or enter its exact ID if the service does not expose a catalog.
4. Test the selected model. This sends one short request and may incur normal API charges.
5. Save and use the model. The connection and default model are stored locally and survive restarts.

This entry supports **OpenAI-compatible Chat Completions**: `/chat/completions` is required and `/models` is optional. Services offering only other protocols cannot use this entry directly. Root URLs get `/v1`; custom API paths are preserved. A listed model is visible to the key; use the test to check chat availability.

Requests go to your configured service, which determines capabilities, quotas and billing. Existing official-provider and OKINTO connections remain available. Bots or conversations with their own model selection must be switched separately.

## Features and changes

- **Custom upstream:** enter URL/key, discover models, select or type an ID, and test it.
- **Separate routing:** distinguish the custom source from other sources and preserve upstream IDs and namespaces.
- **Local settings:** persist the connection and default model; the UI only returns the saved key's suffix.
- **Bots and memory:** retain upstream personas, workspaces, memory, tools and background tasks.
- **Chat channels:** retain in-app chat, WeChat, Feishu and other channel implementations.
- **Windows distribution:** installer EXE, local launcher scripts and packaged-runtime checks.

Tool use, computer control and multimodal features depend on the selected model and integration. Connecting an upstream does not give every model these capabilities.

## Run from source

Requires **Node.js 22.13+** and **Go 1.26.8+**. Setup initializes and builds the gateway and installs the agent runtime.

```bash
git clone https://github.com/superman2003/okbot.git
cd okbot
npm ci
npm run setup
npm run build
npm start
```

The local console defaults to `http://127.0.0.1:3600/`. After setup and compilation, Windows users can also run `Start-Okbot.cmd`; it defaults to `127.0.0.1:3610`, starts the service and opens its authenticated page.

Source-run data lives in `data/`. Windows desktop data defaults to `%APPDATA%\anymodel bot\data`. Keys, chat data, dependencies and build output are excluded from version control.

## Build the Windows installer

On Windows x64:

```bash
npm run dist -- --win nsis --x64
```

Output is written to `release/`. Use `npm run electron:dev` for desktop development. Packaging downloads pinned components and verifies the Cua Driver SHA256.

## Documentation and contributing

- [Development](./docs/development_en.md)
- [Contributing](./CONTRIBUTING_en.md)
- [Security reporting](./SECURITY.md)
- [Bot catalog](./bots)
- [Bug reports and feature requests](https://github.com/superman2003/okbot/issues)

## Upstream and license

Maintained by [superman2003](https://github.com/superman2003), based on [wmn1525/AnyModelBot](https://github.com/wmn1525/AnyModelBot), originally from [modelflare-ai/AnyModelBot](https://github.com/modelflare-ai/AnyModelBot). This edition adds the features and packaging improvements described above. Original code and contribution history are retained.

The project retains the [MIT license](./LICENSE). Keep the original copyright and permission notices when redistributing. Bundled components retain their own licenses; see [third-party notices](./THIRD_PARTY_NOTICES_en.md) and [LICENSES](./LICENSES). Thanks to the upstream authors and dependency maintainers.

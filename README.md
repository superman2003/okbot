# okbot

自己填写 API 地址和 Key，连接你选择的模型服务的个人 AI 助手。

[简体中文](./README.md) · [English](./README_en.md) · [日本語](./README_ja.md) · [한국어](./README_ko.md) · [Русский](./README_ru.md)

[下载 Windows 安装包](https://github.com/superman2003/okbot/releases/tag/custom-0.1.27-1) · [问题反馈](https://github.com/superman2003/okbot/issues) · [MIT 许可证](./LICENSE)

## 📥 下载

当前发布提供 **Windows x64 安装版**：[okbot-0.1.27-win-x64.exe](https://github.com/superman2003/okbot/releases/download/custom-0.1.27-1/okbot-0.1.27-win-x64.exe)，约 160 MB。[发布页](https://github.com/superman2003/okbot/releases/tag/custom-0.1.27-1)附带 `SHA256SUMS` 校验文件。

安装包已包含 Electron、magpie 模型网关、DeepSeek Harness 运行时和 Cua Driver，无需另装 Node.js 或 Go。本地构建未做数字签名。关闭窗口默认收到托盘，可通过托盘菜单退出。

上游支持多个操作系统；本仓库本次发布仅提供上述 Windows x64 安装包，其他平台可参考源码构建流程。

**微信双向同步：** 在主聊天页顶部选择微信会话后，可直接输入并继续同一段对话，两端共用上下文。电脑端内容以「电脑端消息」由机器人转发到微信，机器人回复也同步到微信。历史自动刷新，更早的记录可分页加载。微信发送窗口或额度受限时，电脑仍可继续聊天；在微信发一条消息后恢复待发内容的同步。

## 自定义模型服务

1. 首次打开，或进入「设置 → 模型 → 自定义中转站 → 配置」。
2. 填写 **API Base URL** 与 **API Key**，例如 `https://your-api.example/v1`。
3. 点击「获取上游模型」，从列表选择模型；上游不提供列表时可手填准确的模型 ID。
4. 点击「测试所选模型」确认能回复。此操作会发送一次简短请求，可能产生上游 API 费用。
5. 点击「保存并使用此模型」。连接与默认模型会保存在本机，重启后继续使用。

此入口支持 **OpenAI Chat Completions 兼容接口**，需要 `/chat/completions`；`/models` 可选。仅提供其他协议的接口不能直接使用此入口。站点根地址自动补 `/v1`，自定义 API 路径会保留。获取列表表示 Key 可见的模型，实际对话能力以测试结果为准。

模型请求发送到你配置的服务，能力、额度和费用由该服务及模型决定。原有官方 API 和 OKINTO 接入路径仍保留。已有机器人或对话单独指定过模型时，需要在对应位置切换模型。

## 功能与本版改动

- **自定义上游：** 填写 URL 与 Key，获取、选择、手填和测试模型。
- **独立模型路由：** 自定义来源与原有来源分开识别，保留上游模型 ID 和命名空间。
- **本机保存：** 保存连接及默认模型，界面只显示已保存 Key 的尾号。
- **机器人与记忆：** 继承上游的人设、工作区、记忆、工具调用与后台任务能力。
- **聊天渠道：** 保留应用内聊天，以及微信、飞书等渠道的接入实现。
- **Windows 打包：** 提供安装版 EXE、本地启动脚本及打包后的运行时验证。

工具调用、电脑操作和多模态能力取决于所选模型与接入方式；自定义入口不代表上游的每个模型都具备这些能力。

## 从源码运行

需要 **Node.js 22.13+** 和 **Go 1.26.8+**。`setup` 会初始化并构建网关、安装智能体运行时。

```bash
git clone https://github.com/superman2003/okbot.git
cd okbot
npm ci
npm run setup
npm run build
npm start
```

本地控制台默认是 `http://127.0.0.1:3600/`。完成上述安装和编译后，Windows 也可双击 `Start-Okbot.cmd`：脚本默认使用 `127.0.0.1:3610`，启动服务并打开带访问令牌的页面。

源码运行的数据位于仓库的 `data/`；Windows 桌面版默认位于 `%APPDATA%\anymodel bot\data`。Key、聊天数据、依赖和构建产物不提交到仓库。

## 构建 Windows 安装包

在 Windows x64 环境执行：

```bash
npm run dist -- --win nsis --x64
```

结果写入 `release/`。开发时可用 `npm run electron:dev` 打开桌面版。打包脚本会下载固定版本组件并校验 Cua Driver 的 SHA256。

## 文档与参与

- [开发文档](./docs/development.md)
- [贡献指南](./CONTRIBUTING.md)
- [安全问题反馈](./SECURITY.md)
- [机器人目录](./bots)
- [报告 Bug 或提出功能建议](https://github.com/superman2003/okbot/issues)

## 来源与许可证

本项目由 [superman2003](https://github.com/superman2003) 维护，基于 [wmn1525/AnyModelBot](https://github.com/wmn1525/AnyModelBot) 二次开发；原始项目来自 [modelflare-ai/AnyModelBot](https://github.com/modelflare-ai/AnyModelBot)。本版新增功能与打包改进见上文，原有代码及贡献历史保留。

项目沿用 [MIT 许可证](./LICENSE)，允许依照许可修改、使用和分发。再次分发时请保留原版权与许可声明。随附组件遵守各自许可证，详见 [第三方声明](./THIRD_PARTY_NOTICES.md) 和 [LICENSES](./LICENSES)。感谢原作者和各依赖项目的贡献。

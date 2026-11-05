// 桌面版冒烟测试：启动 Electron（Linux 无显示时自动用 xvfb-run），加载界面、截图、检查 /amb/api/status、内置网关已运行且 /magpie/ 不再对外（404），然后干净退出。
// 用法：node scripts/electron-smoke.mjs [可执行文件路径，默认 node_modules 中的 electron + 当前目录]
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const exe = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
const channelMode = process.argv.includes("--channels");
let mockServer;
const channelSent = [];
const modelCalls = [];
// Use a canonical path for Electron's isolated profile.
const dataDir = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), "amb-electron-"));
const shot = path.join(dataDir, "smoke.png");
let cmd = exe ? path.resolve(exe) : require("electron");
let args = !exe || process.argv.includes("--dev") ? ["."] : [];
if (process.platform === "linux") args.push("--no-sandbox");
if (process.platform === "linux" && !process.env.DISPLAY) {
  // Xvfb 没有 GPU：不关 GPU 时 capturePage 会报 UnknownVizError
  args = ["-a", "-s", "-screen 0 1400x900x24", cmd, ...args, "--disable-gpu"];
  cmd = "xvfb-run";
}
const childEnv = { ...process.env, AMB_DATA_DIR: dataDir, AMB_UI_PORT: "0", AMB_ELECTRON_SMOKE: shot, AMB_LOG_STDOUT: "1", AMB_CATALOG: "off", AMB_PWSH_AUTO_INSTALL: "0" };
if (channelMode) {
  mockServer = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    const json = (value) => res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(value));
    if (req.url === "/v1/models") return json({ data: [{ id: "mock" }] });
    if (req.url === "/v1/chat/completions") {
      modelCalls.push(body);
      const reply = `smoke-bot-reply:${body.messages.at(-1).content}`;
      res.writeHead(200, { "content-type": "text/event-stream" });
      return res.end(`data: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\ndata: [DONE]\n\n`);
    }
    if (req.url === "/ilink/bot/getupdates") {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return json({ ret: 0, msgs: [], get_updates_buf: "smoke-cursor" });
    }
    if (req.url === "/ilink/bot/sendmessage") { channelSent.push(body.msg); return json({ ret: 0 }); }
    if (req.url === "/ilink/bot/getconfig") return json({ ret: 0, typing_ticket: "smoke-ticket" });
    if (req.url === "/ilink/bot/sendtyping") return json({ ret: 0 });
    res.writeHead(404).end();
  });
  await new Promise((resolve) => mockServer.listen(0, "127.0.0.1", resolve));
  const mockUrl = `http://127.0.0.1:${mockServer.address().port}`;
  const { Store } = await import("../dist/src/store/db.js");
  const store = new Store(path.join(dataDir, "anymodel.db"));
  store.createBot({ id: "default", name: "Smoke Bot", defaultModel: "mock" });
  const local = store.ensureConversation("default", "web", "console");
  store.addMessage(local.id, "user", "smoke-local-only");
  const channel = store.ensureConversation("default", "weixin", "smoke-peer", "Smoke WeChat");
  store.addMessage(channel.id, "user", "smoke-wechat-first");
  for (let i = 0; i < 105; i++) store.addMessage(channel.id, "assistant", `smoke-history-${i}`);
  store.addMessage(channel.id, "user", "smoke-wechat-seed");
  store.saveChannelAccount({ key: "default", channel: "weixin", label: "Smoke WeChat", defaultBot: "default", enabled: true, credentials: {}, createdAt: Date.now() });
  store.saveWeixinAccount({ botId: "default", botToken: "smoke-token", ilinkBotId: "smoke-bot", baseUrl: mockUrl, ownerUserId: "smoke-peer" });
  store.upsertWeixinPeer({ botId: "default", userId: "smoke-peer", contextToken: "smoke-context", quotaRemaining: 10, windowStartedAt: Date.now() });
  store.setConversationAccount(channel.id, "default");
  store.close();
  childEnv.AMB_ELECTRON_SMOKE_CHANNELS = "1";
  childEnv.AMB_MAGPIE_BASE_URL = `${mockUrl}/v1`;
  childEnv.AMB_WEIXIN_API_BASE = mockUrl;
  childEnv.AMB_AGENT = "off";
}
delete childEnv.ELECTRON_RUN_AS_NODE;
// Keep early startup diagnostics available even when no SMOKE line is emitted.
const stdoutPath = path.join(dataDir, "stdout.log");
const stderrPath = path.join(dataDir, "stderr.log");
const stdout = fs.openSync(stdoutPath, "w");
const stderr = fs.openSync(stderrPath, "w");
let r;
try {
  r = await new Promise((resolve) => {
    const child = spawn(cmd, args, { env: childEnv, stdio: ["ignore", stdout, stderr], windowsHide: true });
    const timeout = setTimeout(() => child.kill(), 120_000);
    child.once("error", (error) => { clearTimeout(timeout); resolve({ error }); });
    child.once("exit", (status, signal) => { clearTimeout(timeout); resolve({ status, signal }); });
  });
} finally {
  fs.closeSync(stdout);
  fs.closeSync(stderr);
  mockServer?.closeAllConnections();
  await new Promise((resolve) => mockServer ? mockServer.close(resolve) : resolve());
}
const out = fs.readFileSync(stdoutPath, "utf8") + fs.readFileSync(stderrPath, "utf8");
const line = out.split("\n").find((l) => l.startsWith("SMOKE "));
if (!line) {
  console.error({ status: r.status, signal: r.signal, error: r.error?.message, dataDir });
  console.error(out.slice(-3000));
  process.exit(1);
}
const res = JSON.parse(line.slice(6));
console.log(res, "截图：", shot);
const sentText = channelSent.map((m) => m.item_list?.[0]?.text_item?.text || "");
const twoWay = !channelMode || (sentText.some((text) => text.includes("smoke-desktop-send") && !text.includes("smoke-bot-reply")) && sentText.some((text) => text.includes("smoke-bot-reply:smoke-desktop-send")) && modelCalls.some((call) => call.messages.some((m) => m.content === "smoke-wechat-seed")));
const ok = r.status === 0 && res.hasUi && twoWay && (channelMode ? res.channelHistory : res.customUpstreamForm && res.magpieState === "running") && res.product === "okbot" && res.title === "okbot" && res.windowTitle === "okbot" && res.status === 200 && res.magpie === 404 && fs.existsSync(shot);
if (channelMode) console.log({ twoWay, channelMessages: channelSent.length, modelRequests: modelCalls.length });
process.exit(ok ? 0 : 1);

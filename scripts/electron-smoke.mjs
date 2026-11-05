// 桌面版冒烟测试：启动 Electron（Linux 无显示时自动用 xvfb-run），加载界面、截图、检查 /amb/api/status、内置网关已运行且 /magpie/ 不再对外（404），然后干净退出。
// 用法：node scripts/electron-smoke.mjs [可执行文件路径，默认 node_modules 中的 electron + 当前目录]
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const exe = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
const channelMode = process.argv.includes("--channels");
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
  const { Store } = await import("../dist/src/store/db.js");
  const store = new Store(path.join(dataDir, "anymodel.db"));
  store.createBot({ id: "default", name: "Smoke Bot", defaultModel: "mock" });
  const local = store.ensureConversation("default", "web", "console");
  store.addMessage(local.id, "user", "smoke-local-only");
  const channel = store.ensureConversation("default", "weixin", "smoke-peer", "Smoke WeChat");
  store.addMessage(channel.id, "user", "smoke-wechat-first");
  for (let i = 0; i < 105; i++) store.addMessage(channel.id, "assistant", `smoke-history-${i}`);
  store.addMessage(channel.id, "user", "smoke-wechat-seed");
  store.close();
  childEnv.AMB_ELECTRON_SMOKE_CHANNELS = "1";
  childEnv.AMB_MAGPIE_BASE_URL = "http://127.0.0.1:9/v1";
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
  r = spawnSync(cmd, args, { env: childEnv, stdio: ["ignore", stdout, stderr], windowsHide: true, timeout: 120_000 });
} finally {
  fs.closeSync(stdout);
  fs.closeSync(stderr);
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
const ok = r.status === 0 && res.hasUi && (channelMode ? res.channelHistory : res.customUpstreamForm && res.magpieState === "running") && res.product === "okbot" && res.title === "okbot" && res.windowTitle === "okbot" && res.status === 200 && res.magpie === 404 && fs.existsSync(shot);
process.exit(ok ? 0 : 1);

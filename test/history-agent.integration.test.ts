import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { App } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { findAppRoot } from "../src/magpie/supervisor.js";
import { locateDshRuntime } from "../src/agent/host.js";
import { groupPeer } from "../src/store/db.js";
import { artifactId } from "../src/core/history.js";
import { listen, mockIlink, readJson, until } from "./helpers.js";

const d = locateDshRuntime(findAppRoot()) ? describe : describe.skip;
d("real agent discovers a different bot's group video and forwards it to WeChat", () => {
  let app: App, dir: string, base: string, group: string, ref: string;
  let model: Awaited<ReturnType<typeof listen>>;
  let wx: Awaited<ReturnType<typeof mockIlink>>;
  const toolCalls: string[] = [];
  beforeAll(async () => {
    wx = await mockIlink();
    model = await listen(async (req, res) => {
      const json = (body: unknown) => res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(body));
      if (req.url === "/v1/models") return json({ data: [{ id: "history-model" }] });
      const b = await readJson(req);
      const messages = JSON.stringify(b.messages);
      let tool = "", args: object = {};
      if (b.tools?.length) {
        expect(b.tools.some((t: any) => t.function?.name === "chat_history")).toBe(true);
        expect(b.tools.some((t: any) => t.function?.name === "send_to_weixin")).toBe(true);
        if (!messages.includes("ToolFixtureGroup")) { tool = "chat_history"; args = { op: "list" }; }
        else if (!messages.includes(ref)) { tool = "chat_history"; args = { op: "read", groupId: group }; }
        else if (!messages.includes("destination")) { tool = "send_to_weixin"; args = { artifactIds: [ref] }; }
      }
      const text = "已找到群聊视频，微信接口已接收。";
      if (!b.stream) return json({ choices: [{ message: { role: "assistant", content: text }, finish_reason: "stop" }] });
      let delta: any = { role: "assistant", content: text };
      if (tool) { toolCalls.push(tool); delta = { role: "assistant", tool_calls: [{ index: 0, id: `call_${toolCalls.length}`, type: "function", function: { name: tool, arguments: JSON.stringify(args) } }] }; }
      const chunk = (choices: any[]) => `data: ${JSON.stringify({ id: "chat_history", object: "chat.completion.chunk", model: b.model, choices })}\n\n`;
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(chunk([{ index: 0, delta }]) + chunk([{ index: 0, delta: {}, finish_reason: tool ? "tool_calls" : "stop" }]) + "data: [DONE]\n\n");
    });
    dir = fs.mkdtempSync(path.join(process.env.AMB_DSH_BUNDLE_TEST_DATA_ROOT || fs.realpathSync.native(os.tmpdir()), "amb-history-agent-"));
    app = new App(loadConfig({ dataDir: dir, env: { AMB_UI_PORT: "0", AMB_MAGPIE_BASE_URL: `${model.url}/v1`, AMB_DEFAULT_MODEL: "history-model", AMB_WEIXIN_API_BASE: wx.url, AMB_WEIXIN_CDN_BASE: wx.cdnBase } }), { printQrToTerminal: false, fileLog: false, weixinPollTimeoutMs: 1000 });
    await app.start(); base = app.web!.url.replace(/\/$/, "");
    await fetch(`${base}/amb/api/channel-accounts/default/weixin/login`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    await until(() => !!app.store.getWeixinAccount("default"), 8000);
    app.store.upsertWeixinPeer({ botId: "default", userId: "owner@im.wechat", contextToken: "ctx-1", quotaRemaining: 10, windowStartedAt: Date.now() });
    app.store.createBot({ id: "maker", name: "Maker" }); app.store.createBot({ id: "partner", name: "Partner" });
    group = app.store.createGroup("ToolFixtureGroup", ["maker", "partner"]).id;
    const conv = app.store.ensureConversation("maker", "web", groupPeer(group), "ToolFixtureGroup", "group");
    const media = path.join(dir, "workspaces", "maker", "media"); fs.mkdirSync(media, { recursive: true });
    const file = path.join(media, "group-result.mp4"); fs.writeFileSync(file, Buffer.concat([Buffer.from("000000186674797069736f6d0000020069736f6d", "hex"), Buffer.alloc(512)]));
    ref = artifactId(app.store.addMessage(conv.id, "assistant", "The group video is ready", undefined, { files: [file] }), 0);
  }, 120000);
  afterAll(async () => { await app?.stop(); await model?.close(); await wx?.close(); if (dir && !process.env.AMB_DSH_BUNDLE_TEST_DATA_ROOT) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20 }); });
  it("executes history list → history read → send file through the registered tools", async () => {
    const r = await fetch(`${base}/amb/api/bots/default/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "把之前群聊里生成的视频发到我的微信" }) });
    expect(r.status).toBe(200);
    expect((await r.json() as any).reply).toContain("微信接口已接收");
    await app.outbox.idle();
    expect(toolCalls).toEqual(["chat_history", "chat_history", "send_to_weixin"]);
    expect(wx.state.sent.some((m) => m.to === "owner@im.wechat" && m.item?.video_item)).toBe(true);
  }, 180000);
});

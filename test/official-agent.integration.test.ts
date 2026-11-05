/**
 * 集成测试：真实 DSH 代理 + 真实内置 magpie + mock 厂商。官方 API 的主要用法就是代理：
 * 每家都走自己该走的接口（OpenAI 走 Responses，Anthropic 走 Messages，其余走 Chat），带用户自己的 Key，不碰 Modelflare。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { App } from "../src/app.js";
import { locateDshRuntime } from "../src/agent/host.js";
import { loadConfig } from "../src/config.js";
import { findAppRoot, resolveMagpieBinary } from "../src/magpie/supervisor.js";
import { listen, readJson } from "./helpers.js";

const d = resolveMagpieBinary() && locateDshRuntime(findAppRoot()) ? describe : describe.skip;

const KEYS = { deepseek: "sk-deepseek-key-1111", anthropic: "sk-ant-key-2222", openai: "sk-openai-key-3333" };
const MODELS: Record<string, string> = { [KEYS.deepseek]: "deepseek-v4-flash", [KEYS.anthropic]: "claude-opus-5-5", [KEYS.openai]: "gpt-5.6-sol" };

function sse(res: http.ServerResponse, events: Array<[string | undefined, unknown]>): void {
  res.writeHead(200, { "content-type": "text/event-stream" });
  res.end(events.map(([e, v]) => `${e ? `event: ${e}\n` : ""}data: ${typeof v === "string" ? v : JSON.stringify(v)}\n\n`).join(""));
}

function replyChat(res: http.ServerResponse, model: string, text: string): void {
  const chunk = (o: object) => [undefined, { id: "c1", object: "chat.completion.chunk", model, ...o }] as [undefined, object];
  sse(res, [chunk({ choices: [{ index: 0, delta: { role: "assistant", content: text } }] }), chunk({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }), chunk({ choices: [], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), [undefined, "[DONE]"]]);
}

function replyMessages(res: http.ServerResponse, model: string, text: string): void {
  const ev = (type: string, o: object = {}) => [type, { type, ...o }] as [string, object];
  sse(res, [
    ev("message_start", { message: { id: "msg_1", type: "message", role: "assistant", model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } }),
    ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } }),
    ev("content_block_delta", { index: 0, delta: { type: "text_delta", text } }),
    ev("content_block_stop", { index: 0 }),
    ev("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } }),
    ev("message_stop"),
  ]);
}

function replyResponses(res: http.ServerResponse, model: string, text: string): void {
  let seq = 0;
  const ev = (type: string, o: object = {}) => [type, { type, sequence_number: seq++, ...o }] as [string, object];
  const id = "resp_1";
  const done = { type: "message", id: "msg_1", role: "assistant", status: "completed", content: [{ type: "output_text", text, annotations: [] }] };
  const base = { id, object: "response", model, status: "in_progress", output: [] };
  sse(res, [
    ev("response.created", { response: base }),
    ev("response.in_progress", { response: base }),
    ev("response.output_item.added", { output_index: 0, item: { ...done, status: "in_progress", content: [] } }),
    ev("response.content_part.added", { output_index: 0, item_id: "msg_1", content_index: 0, part: { type: "output_text", text: "", annotations: [] } }),
    ev("response.output_text.delta", { output_index: 0, item_id: "msg_1", content_index: 0, delta: text }),
    ev("response.output_text.done", { output_index: 0, item_id: "msg_1", content_index: 0, text }),
    ev("response.content_part.done", { output_index: 0, item_id: "msg_1", content_index: 0, part: done.content[0] }),
    ev("response.output_item.done", { output_index: 0, item: done }),
    ev("response.completed", { response: { ...base, status: "completed", output: [done], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } } }),
  ]);
}

d("官方 API（真实代理）", () => {
  let vendor: Awaited<ReturnType<typeof listen>>;
  let app: App;
  let base: string;
  let dataDir: string;
  const turns: Array<{ path: string; key: string; model: string; skill?: string }> = [];

  beforeAll(async () => {
    vendor = await listen(async (req, res) => {
      const url = req.url?.split("?")[0] ?? "";
      // 网关问模型列表时 Authorization 和 x-api-key 都带；真正的对话请求每家只带自己那一种
      const key = [String(req.headers["x-api-key"] ?? ""), String(req.headers.authorization ?? "").replace(/^Bearer /, "")].find((k) => MODELS[k]);
      const json = (status: number, v: unknown) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(v));
      if (!key) return json(401, { error: { message: "Incorrect API key provided" } });
      if (url.endsWith("/models")) return json(200, { data: [{ id: MODELS[key] }] });
      const b = await readJson(req);
      turns.push({ path: url, key, model: b.model, skill: req.headers["x-modelflare-skill"] as string | undefined });
      const text = `来自 ${url} 的回复`;
      if (url.endsWith("/v1/messages")) return replyMessages(res, b.model, text);
      if (url.endsWith("/responses")) return replyResponses(res, b.model, text);
      if (url.endsWith("/chat/completions")) return replyChat(res, b.model, text);
      return json(404, { error: { message: "no route" } });
    });
    process.env.AMB_OFFICIAL_BASE_URL = vendor.url + "/v1";
    process.env.AMB_MODELFLARE_ISSUER = "http://127.0.0.1:9";
    dataDir = fs.mkdtempSync(path.join(process.env.AMB_DSH_BUNDLE_TEST_DATA_ROOT || fs.realpathSync.native(os.tmpdir()), "amb-official-agent-"));
    app = new App(loadConfig({ dataDir, env: { AMB_UI_PORT: "0", AMB_WEIXIN_API_BASE: "http://127.0.0.1:9" } }), { printQrToTerminal: false });
    await app.start();
    base = app.web!.url.replace(/\/$/, "");
    for (const [id, key] of Object.entries(KEYS)) {
      const r = await fetch(`${base}/amb/api/official/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ key }) });
      expect(r.status).toBe(200);
    }
  }, 120_000);

  afterAll(async () => {
    delete process.env.AMB_OFFICIAL_BASE_URL;
    delete process.env.AMB_MODELFLARE_ISSUER;
    await app?.stop();
    await vendor?.close();
    // The bundle runner removes its own test-data tree after Electron exits and releases Windows handles.
    if (!process.env.AMB_DSH_BUNDLE_TEST_DATA_ROOT) fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  });

  const chat = async (text: string) => {
    const r = await fetch(`${base}/amb/api/bots/default/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    expect(r.status).toBe(200);
    return ((await r.json()) as { reply: string }).reply;
  };

  it.each([
    ["deepseek", "official-deepseek/deepseek-v4-flash", "/chat/completions", KEYS.deepseek, "deepseek-v4-flash"],
    ["anthropic", "official-anthropic/claude-opus-5-5", "/v1/messages", KEYS.anthropic, "claude-opus-5-5"],
    ["openai", "official-openai/gpt-5.6-sol", "/responses", KEYS.openai, "gpt-5.6-sol"],
  ])("%s：代理走它自己的接口，带用户的 Key，不带 Modelflare 的请求头", async (_id, model, api, key, upstream) => {
    app.setDefaultModel(model);
    turns.length = 0;
    const reply = await chat("你好");
    expect(reply).toContain(`来自 `);
    expect(reply).toContain(api);
    const last = turns.at(-1)!;
    expect(last.path.endsWith(api)).toBe(true);
    expect(last).toMatchObject({ key, model: upstream });
    expect(turns.every((t) => t.skill === undefined)).toBe(true);
  }, 180_000);

  it("只有官方 Key 时代理不会以为自己能生图", () => {
    // 代理的技能目录里没有 media（去掉 App 的 mediaReady 这条会变红：它会写在这里）
    const skills = fs.globSync("**/skills/*/SKILL.md", { cwd: dataDir }).map((f) => path.basename(path.dirname(f)));
    expect(skills).not.toContain("media");
  });
});

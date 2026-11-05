import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { App } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { findAppRoot, resolveMagpieBinary } from "../src/magpie/supervisor.js";
import { locateDshRuntime } from "../src/agent/host.js";
import { listen, readJson } from "./helpers.js";

const hasRuntime = !!locateDshRuntime(findAppRoot());
const d = resolveMagpieBinary() ? describe : describe.skip;
d("custom Anthropic upstream with real gateway and agent", () => {
  let app: App;
  let server: Awaited<ReturnType<typeof listen>>;
  let dir: string;
  let base: string;
  const key = "[redacted]";
  const model = "vendor/shared-model";
  const calls: Array<{ path: string; protocol: string; authMode: string; body: any }> = [];
  const api = async (p: string, body?: unknown, method = "POST") => {
    const r = await fetch(`${base}/amb/api${p}`, { method: body ? method : "GET", headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json() as any };
  };
  const start = async (enableAgent = hasRuntime) => {
    app = new App(loadConfig({ dataDir: dir, env: { AMB_UI_PORT: "0", AMB_AGENT: enableAgent ? "dsh" : "off" } }), { printQrToTerminal: false, fileLog: false });
    await app.start(); base = app.web!.url.replace(/\/$/, "");
  };
  beforeAll(async () => {
    server = await listen(async (req, res) => {
      const url = new URL(req.url!, "http://localhost");
      const bearer = req.headers.authorization === `Bearer ${key}` && req.headers["x-api-key"] === undefined;
      const anthropic = ((req.headers["x-api-key"] === key && req.headers.authorization === undefined) || bearer) && req.headers["anthropic-version"] === "2023-06-01";
      const openai = bearer && req.headers["anthropic-version"] === undefined;
      const json = (status: number, body: unknown) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
      if (!anthropic && !openai) return json(401, { error: { message: "wrong protocol authentication" } });
      if (url.pathname === "/relay/v1/models") {
        if (anthropic && !url.searchParams.has("after_id")) return json(200, { data: [{ id: model }], has_more: true, last_id: model });
        return json(200, { data: [{ id: model }, { id: "claude-only" }], has_more: false });
      }
      const body = await readJson(req);
      calls.push({ path: url.pathname, protocol: anthropic ? "anthropic" : "openai", authMode: bearer ? "bearer" : "api-key", body });
      if (url.pathname === "/relay/v1/chat/completions" && openai) {
        const text = "openai-reply";
        if (!body.stream) return json(200, { choices: [{ message: { role: "assistant", content: text } }] });
        res.writeHead(200, { "content-type": "text/event-stream" });
        return res.end(`data: ${JSON.stringify({ id: "chat_mock", object: "chat.completion.chunk", model: body.model, choices: [{ index: 0, delta: { role: "assistant", content: text } }] })}\n\ndata: ${JSON.stringify({ id: "chat_mock", object: "chat.completion.chunk", model: body.model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 } })}\n\ndata: [DONE]\n\n`);
      }
      if (url.pathname !== "/relay/v1/messages" || !anthropic) return json(404, { error: { message: "no such endpoint" } });
      if (!Number.isFinite(body.max_tokens) || body.max_tokens <= 0 || body.messages.some((m: any) => m.role === "system")) return json(400, { error: { message: "invalid Messages body" } });
      const text = "anthropic-reply";
      const message = { id: "msg_native", type: "message", role: "assistant", model: body.model, content: [{ type: "text", text }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 4, output_tokens: 3 } };
      if (!body.stream) return json(200, message);
      const events: Array<[string, any]> = [
        ["message_start", { message: { ...message, content: [], stop_reason: null, usage: { input_tokens: 4, output_tokens: 0 } } }],
        ["content_block_start", { index: 0, content_block: { type: "text", text: "" } }],
        ["content_block_delta", { index: 0, delta: { type: "text_delta", text } }],
        ["content_block_stop", { index: 0 }],
        ["message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 3 } }],
        ["message_stop", {}],
      ];
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(events.map(([type, data]) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`).join(""));
    });
    dir = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), "amb-anthropic-"));
    await start();
  }, 60000);
  afterAll(async () => { await app?.stop(); await server?.close(); if (dir) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10 }); });

  it("lists paginated models, tests Messages, and saves the protocol without returning a key", async () => {
    const body = { protocol: "anthropic", baseUrl: `${server.url}/relay/v1/messages`, key, model };
    const list = await api("/upstream/models", body);
    expect(list.status).toBe(200); expect(list.json.models).toEqual(["claude-only", model]);
    expect((await api("/upstream/test", body)).status).toBe(200);
    app.agent.apiFallbacks.set(`custom-upstream/${model}`, "anthropic-messages", "old endpoint rejected this protocol");
    const saved = await api("/upstream", { ...body, models: list.json.models }, "PUT");
    expect(saved.status).toBe(200);
    expect(saved.json).toMatchObject({ protocol: "anthropic", baseUrl: `${server.url}/relay/v1`, connected: true });
    expect(JSON.stringify(saved)).not.toContain(key);
    expect(app.agent.apiFallbacks.get(`custom-upstream/${model}`)).toBeUndefined();
  });

  it("translates plain chat through Messages and retains system prompts and upstream model IDs", async () => {
    const result = await app.models.streamChat({ model: `custom-upstream/${model}`, messages: [{ role: "system", content: "native-system" }, { role: "user", content: "native-user" }] }, () => {});
    expect(result).toBe("anthropic-reply");
    expect(calls.at(-1)).toMatchObject({ path: "/relay/v1/messages", protocol: "anthropic", body: { model } });
    expect(JSON.stringify(calls.at(-1)!.body.system)).toContain("native-system");
  });

  it.skipIf(!hasRuntime)("drives the real agent over Messages and refreshes the route when switching the same model", async () => {
    const chat = async () => {
      const r = await api("/bots/default/chat", { text: "hello protocol" });
      expect(r.status).toBe(200); return r.json.reply as string;
    };
    expect(await chat()).toContain("anthropic-reply");
    expect(calls.at(-1)!.body.tools.length).toBeGreaterThan(0);
    for (const protocol of ["openai", "anthropic"] as const) {
      const r = await api("/upstream", { protocol, baseUrl: `${server.url}/relay/v1`, model }, "PUT");
      expect(r.status).toBe(200);
      expect((await app.agent.host("default").routeFor(`custom-upstream/${model}`)).api).toBe(protocol === "anthropic" ? "anthropic-messages" : "openai-completions");
      expect(await chat()).toContain(`${protocol}-reply`);
      expect(calls.at(-1)!.protocol).toBe(protocol);
    }
  }, 180000);

  it("uses Bearer consistently for Anthropic discovery, testing and real gateway calls", async () => {
    const body = { protocol: "anthropic", authMode: "bearer", baseUrl: `${server.url}/relay/v1`, model };
    expect((await api("/upstream", body, "PUT")).status).toBe(200);
    expect((await api("/upstream/models", body)).status).toBe(200);
    expect((await api("/upstream/test", body)).status).toBe(200);
    expect(await app.models.streamChat({ model: `custom-upstream/${model}`, messages: [{ role: "user", content: "bearer request" }] }, () => {})).toBe("anthropic-reply");
    expect(calls.at(-1)).toMatchObject({ protocol: "anthropic", authMode: "bearer", path: "/relay/v1/messages" });
  });

  it("restores protocol and saved key after restart, rejects unknown protocols without mutating the connection", async () => {
    expect((await api("/upstream", { protocol: "invalid", baseUrl: server.url, key, model }, "PUT")).status).toBe(400);
    await app.stop(); await start(false);
    const restored = (await api("/upstream")).json;
    expect(restored).toMatchObject({ protocol: "anthropic", authMode: "bearer", baseUrl: `${server.url}/relay/v1`, model, connected: true });
    expect((await api("/upstream/test", { baseUrl: restored.baseUrl, model })).status).toBe(200);
  }, 60000);
});

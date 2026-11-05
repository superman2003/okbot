import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { App } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { resolveMagpieBinary } from "../src/magpie/supervisor.js";
import { mockOpenAI } from "./helpers.js";

const d = resolveMagpieBinary() ? describe : describe.skip;
d("custom upstream with real gateway", () => {
  let app: App;
  let upstream: Awaited<ReturnType<typeof mockOpenAI>>;
  let dir: string;
  let base: string;
  const key = "sk-custom-private-key-9876";
  const api = async (p: string, method = "GET", body?: unknown) => {
    const res = await fetch(`${base}/amb/api${p}`, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: await res.json() as any };
  };
  const start = async () => {
    app = new App(loadConfig({ dataDir: dir, env: { AMB_UI_PORT: "0", AMB_AGENT: "off" } }), { printQrToTerminal: false });
    await app.start();
    base = app.web!.url.replace(/\/$/, "");
  };
  beforeAll(async () => {
    upstream = await mockOpenAI({ key, models: ["vendor/model-a", "claude-relay-only", ...Array.from({ length: 35 }, (_, i) => `chat-${i}`)] });
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "amb-custom-"));
    await start();
  });
  afterAll(async () => {
    await app?.stop();
    await upstream?.close();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("discovers and tests without saving, and rejects invalid credentials", async () => {
    expect((await api("/upstream/models", "POST", { baseUrl: upstream.url, key: "wrong" })).status).toBe(400);
    const r = await api("/upstream/models", "POST", { baseUrl: upstream.url, key });
    expect(r.json.models).toHaveLength(37);
    expect((await api("/upstream/test", "POST", { baseUrl: upstream.url, key, model: "vendor/model-a" })).json.ok).toBe(true);
    expect((await api("/upstream")).json.connected).toBe(false);
    expect(JSON.stringify(r)).not.toContain(key);
  });

  it("saves all models, sets the default and routes namespaced and Claude models through Chat Completions", async () => {
    const r = await api("/upstream", "PUT", { baseUrl: upstream.url, key, model: "vendor/model-a", models: upstream.models });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ connected: true, keyTail: "9876", model: "vendor/model-a" });
    expect(JSON.stringify(r)).not.toContain(key);
    expect((await api("/modelflare")).json.custom).toBe(true);
    expect(app.config.llm.defaultModel).toBe("custom-upstream/vendor/model-a");
    const models = (await api("/models")).json.models;
    expect(models).toContain("custom-upstream/chat-34");
    expect(models).toContain("custom-upstream/vendor/model-a");
    for (const id of ["vendor/model-a", "claude-relay-only"]) {
      const model = app.routeModel("default", `custom-upstream/${id}`);
      const answer = await app.models.streamChat({ model, messages: [{ role: "user", content: "hello" }] }, () => {});
      expect(answer).toContain(id);
      expect(upstream.calls.at(-1)).toMatchObject({ model: id, auth: `Bearer ${key}`, api: "chat" });
    }
  });

  it("reuses the key only at the same URL and persists across an app restart", async () => {
    expect((await api("/upstream/models", "POST", { baseUrl: upstream.url })).status).toBe(200);
    expect((await api("/upstream/models", "POST", { baseUrl: upstream.url + "/other" })).status).toBe(400);
    expect((await api("/upstream", "PUT", { baseUrl: upstream.url, model: "manual-model" })).status).toBe(200);
    await app.stop();
    await start();
    expect((await api("/upstream")).json).toMatchObject({ connected: true, model: "manual-model" });
    expect(app.config.llm.defaultModel).toBe("custom-upstream/manual-model");
    expect(fs.readFileSync(path.join(dir, "logs", "app.log"), "utf8")).not.toContain(key);
  });

  it("disconnects without silently routing old selections to a different provider", async () => {
    expect((await api("/upstream", "DELETE")).status).toBe(200);
    expect((await api("/upstream")).json.connected).toBe(false);
    expect(app.config.llm.defaultModel).toBe("");
    expect(app.routeModel("default", "custom-upstream/vendor/model-a")).toBe("custom-upstream/vendor/model-a");
  });
});

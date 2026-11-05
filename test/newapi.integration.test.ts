import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { App } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { resolveMagpieBinary } from "../src/magpie/supervisor.js";
import { listen, readJson } from "./helpers.js";

const suite = resolveMagpieBinary() ? describe : describe.skip;
suite("New API through the real managed gateway", () => {
  let upstream: Awaited<ReturnType<typeof listen>>;
  let app: App;
  let origin: string;
  const calls: string[] = [];
  beforeAll(async () => {
    upstream = await listen(async (req, res) => {
      const url = new URL(req.url!, "http://mock");
      calls.push(url.pathname);
      const json = (body: unknown, status = 200) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
      if (url.pathname === "/api/status") return json({ data: { quota_per_unit: 500000, quota_display_type: "USD" } });
      if (url.pathname === "/api/pricing") return json({ data: [{ model_name: "chat-test", quota_type: 0, model_ratio: 1, completion_ratio: 2, enable_groups: ["default"], supported_endpoint_types: ["openai"] }], group_ratio: { default: 1 } });
      if (req.headers.authorization !== "Bearer sk-newapi-test") return json({ error: { message: "Invalid token" } }, 401);
      if (url.pathname === "/v1/models") return json({ data: [{ id: "chat-test", object: "model" }] });
      if (url.pathname === "/v1/dashboard/billing/subscription") return json({ hard_limit_usd: 20 });
      if (url.pathname === "/v1/dashboard/billing/usage") return json({ total_usage: 250 });
      if (url.pathname === "/v1/chat/completions") {
        expect(await readJson(req)).toMatchObject({ model: "chat-test", stream: true });
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "New API connected" } }] })}\n\n`);
        return res.end("data: [DONE]\n\n");
      }
      return json({ error: { message: "not found" } }, 404);
    });
    process.env.AMB_NEWAPI_BASE_URL = upstream.url;
    app = new App(loadConfig({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), "amb-newapi-")), env: { AMB_UI_PORT: "0", AMB_AGENT: "off" } }), { printQrToTerminal: false });
    await app.start();
    origin = app.web!.url.replace(/\/$/, "") + "/amb/api";
  });
  afterAll(async () => {
    await app?.stop();
    await upstream?.close();
    delete process.env.AMB_NEWAPI_BASE_URL;
  });
  const api = async (route: string, method = "GET", body?: unknown) => {
    const res = await fetch(origin + route, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, data: await res.json() as any };
  };
  it("connects with a key, fetches balance and metadata, and routes streaming chat to New API", async () => {
    expect((await api("/account")).data).toMatchObject({ loginAvailable: false });
    expect((await api("/account/login", "POST", {})).status).toBe(409);
    expect((await api("/modelflare", "PUT", { apiKey: "bad" })).status).toBe(400);
    const connected = await api("/modelflare", "PUT", { apiKey: "  sk-newapi-test  " });
    expect(connected.data).toMatchObject({ connected: true, baseUrl: upstream.url + "/v1", models: ["chat-test"] });
    expect(JSON.stringify(connected.data)).not.toContain("sk-newapi-test");
    expect((await api("/account")).data).toMatchObject({ source: "key", balanceUsd: 17.5, usedUsd: 2.5, balanceUnit: "USD" });
    expect((await api("/models/info")).data.models["chat-test"]).toMatchObject({ endpoints: ["openai"], price: { input: 2, output: 4 } });
    expect(calls).not.toContain("/v1/model-profiles");
    const output = await app.models.streamChat({ model: app.routeModel("default", "chat-test"), messages: [{ role: "user", content: "hello" }] }, () => {});
    expect(output).toBe("New API connected");
    expect((await api("/modelflare", "DELETE")).data.connected).toBe(false);
    expect((await api("/account")).data).toMatchObject({ source: "none", balanceUsd: null });
  });
});

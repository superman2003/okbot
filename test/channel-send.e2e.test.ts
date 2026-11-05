import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { App } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { mockIlink, mockOpenAI, until } from "./helpers.js";

describe("two-way desktop / WeChat conversation", () => {
  let app: App;
  let llm: Awaited<ReturnType<typeof mockOpenAI>>;
  let ilink: Awaited<ReturnType<typeof mockIlink>>;
  let dir: string;
  let base: string;
  const peer = "owner@im.wechat";
  const conv = `default:weixin:${peer}`;
  const endpoint = `/conversations/${encodeURIComponent(conv)}/messages`;
  const api = async (url: string, body?: unknown) => {
    const r = await fetch(`${base}/amb/api${url}`, { method: body ? "POST" : "GET", headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json() as any };
  };
  const start = async () => {
    app = new App(loadConfig({ dataDir: dir, env: { AMB_MAGPIE_BASE_URL: `${llm.url}/v1`, AMB_UI_PORT: "0", AMB_AGENT: "off", AMB_WEIXIN_API_BASE: ilink.url } }), { printQrToTerminal: false, weixinPollTimeoutMs: 1000, fileLog: false });
    await app.start(); base = app.web!.url.replace(/\/$/, "");
  };
  const desktop = (text: string, requestId: string = crypto.randomUUID()) => api(endpoint, { text, requestId });
  const finished = (text: string) => until(() => app.store.listMessages(conv).some((m) => m.role === "assistant" && m.content.includes(text)) && app.runtime.busySince(conv) === undefined, 10000);
  beforeAll(async () => {
    llm = await mockOpenAI(); ilink = await mockIlink();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "amb-two-way-"));
    await start();
    expect((await api("/channel-accounts/default/weixin/login", {})).status).toBe(200);
    await until(() => !!app.store.getWeixinAccount("default"), 8000);
    ilink.push(peer, "phone-first"); await finished("phone-first");
  });
  afterAll(async () => {
    await app?.stop(); await llm?.close(); await ilink?.close();
    if (dir) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10 });
  });

  it("desktop input uses the phone context, and both input and bot response reach WeChat", async () => {
    expect((await api(endpoint)).json.composer).toMatchObject({ canSend: true, syncReady: true });
    expect((await desktop("desktop-first")).status).toBe(202);
    await finished("desktop-first");
    await app.outbox.idle();
    expect(llm.calls.at(-1)!.messages.map((m) => m.content)).toEqual(expect.arrayContaining(["phone-first", "desktop-first"]));
    expect(ilink.state.sent.some((m) => m.to === peer && m.text.includes("电脑端消息") && m.text.includes("desktop-first"))).toBe(true);
    expect(ilink.state.sent.some((m) => m.to === peer && m.text.includes("你说：desktop-first"))).toBe(true);
    expect(app.store.listMessages(conv).filter((m) => m.content === "desktop-first")).toHaveLength(1);
    expect((await api("/bots/default/chat")).json.messages).toEqual([]);
  });

  it("a later phone message sees what was said on desktop", async () => {
    ilink.push(peer, "phone-after-desktop"); await finished("phone-after-desktop");
    expect(llm.calls.at(-1)!.messages.map((m) => m.content)).toEqual(expect.arrayContaining(["desktop-first", "[mock-a] 你说：desktop-first", "phone-after-desktop"]));
  });

  it("retries generate one turn and one echo; reusing an ID for different input is rejected", async () => {
    const id = crypto.randomUUID();
    const before = llm.calls.length;
    await Promise.all([desktop("retry-once", id), desktop("retry-once", id)]);
    await finished("retry-once"); await app.outbox.idle();
    expect((await desktop("retry-once", id)).json.duplicate).toBe(true);
    expect((await desktop("different-message", id)).status).toBe(409);
    expect(llm.calls.length - before).toBe(1);
    expect(ilink.state.sent.filter((m) => m.text.includes("电脑端消息") && m.text.includes("retry-once"))).toHaveLength(1);
  });

  it("phone and desktop arrivals share the same queue without losing or duplicating input", async () => {
    await desktop("desktop-concurrent");
    ilink.push(peer, "phone-concurrent");
    await finished("phone-concurrent");
    expect(llm.calls.at(-1)!.messages.map((m) => m.content)).toContain("desktop-concurrent");
    for (const text of ["desktop-concurrent", "phone-concurrent"]) expect(app.store.listMessages(conv).filter((m) => m.role === "user" && m.content === text)).toHaveLength(1);
  });

  it("expired phone quota does not block desktop chat or invent a new inbound window", async () => {
    await app.outbox.idle();
    const p = app.store.getWeixinPeer("default", peer)!;
    const expiredAt = Date.now() - 25 * 3600_000;
    app.store.upsertWeixinPeer({ ...p, quotaRemaining: 0, windowStartedAt: expiredAt });
    const sent = ilink.state.sent.length;
    expect((await desktop("desktop-while-expired")).status).toBe(202);
    await finished("desktop-while-expired"); await app.outbox.idle();
    expect(ilink.state.sent).toHaveLength(sent);
    expect(app.store.getWeixinPeer("default", peer)!.windowStartedAt).toBe(expiredAt);
    expect((await api(endpoint)).json.composer).toMatchObject({ canSend: true, syncReady: false, pendingSync: 2 });
    ilink.push(peer, "phone-resume-sync"); await finished("phone-resume-sync"); await app.outbox.idle();
    expect(ilink.state.sent.slice(sent).some((m) => m.text.includes("desktop-while-expired"))).toBe(true);
    expect(app.store.heldOutbox(conv)).toHaveLength(0);
  });

  it("completed request deduplication survives a restart", async () => {
    const id = crypto.randomUUID();
    await desktop("before-restart", id); await finished("before-restart");
    const before = llm.calls.length;
    await app.stop(); await start();
    expect((await desktop("before-restart", id)).json.duplicate).toBe(true);
    expect(llm.calls).toHaveLength(before);
  });

  it("rejects unauthorized destinations, invalid requests and disconnected channels", async () => {
    const other = app.store.ensureConversation("default", "weixin", "unapproved-person");
    expect((await api(`/conversations/${encodeURIComponent(other.id)}/messages`, { text: "not allowed", requestId: crypto.randomUUID() })).status).toBe(409);
    expect((await desktop("", crypto.randomUUID())).status).toBe(400);
    expect((await desktop("hello", "bad")).status).toBe(400);
    expect((await desktop("x".repeat(24001))).status).toBe(400);
    await app.updateChannelAccount("default", "weixin", { enabled: false });
    expect((await desktop("disconnected")).status).toBe(409);
    expect((await api(endpoint)).json.composer.canSend).toBe(false);
  });
});

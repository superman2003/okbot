import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { App } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { mockIlink, mockOpenAI, until } from "./helpers.js";
// @ts-expect-error Browser helper module is intentionally plain JavaScript.
import { chatConversations, initialConversation, mergeMessages } from "../ui/lib/conversations.js";

describe("WeChat history in the desktop chat", () => {
  let app: App;
  let llm: Awaited<ReturnType<typeof mockOpenAI>>;
  let ilink: Awaited<ReturnType<typeof mockIlink>>;
  let dir: string;
  let base: string;
  const conv = "default:weixin:owner@im.wechat";
  const api = async (url: string, body?: unknown) => {
    const r = await fetch(`${base}/amb/api${url}`, { method: body ? "POST" : "GET", headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json() as any };
  };
  beforeAll(async () => {
    llm = await mockOpenAI();
    ilink = await mockIlink();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "amb-channel-history-"));
    app = new App(loadConfig({ dataDir: dir, env: { AMB_MAGPIE_BASE_URL: `${llm.url}/v1`, AMB_UI_PORT: "0", AMB_AGENT: "off", AMB_WEIXIN_API_BASE: ilink.url } }), { printQrToTerminal: false, weixinPollTimeoutMs: 1000, fileLog: false });
    await app.start();
    base = app.web!.url.replace(/\/$/, "");
    expect((await api("/channel-accounts/default/weixin/login", {})).status).toBe(200);
    await until(() => !!app.store.getWeixinAccount("default"), 8000);
  });
  afterAll(async () => {
    await app?.stop(); await llm?.close(); await ilink?.close();
    if (dir) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10 });
  });

  it("actual incoming WeChat messages appear in the desktop transcript, separately from app chat", async () => {
    ilink.push("owner@im.wechat", "phone-message-one");
    await until(() => app.store.listMessages(conv).some((m) => m.role === "assistant") && app.runtime.busySince(conv) === undefined, 8000);
    const r = await api(`/conversations/${encodeURIComponent(conv)}/messages?limit=100`);
    expect(r.status).toBe(200);
    expect(r.json.messages.map((m: any) => m.content)).toEqual(["phone-message-one", "[mock-a] 你说：phone-message-one"]);
    expect(r.json).toMatchObject({ conversation: { channel: "weixin" }, busy: false, hasMore: false });
    expect((await api("/bots/default/chat")).json.messages).toEqual([]);
    const rows = (await api("/conversations?bot=default")).json.conversations;
    expect(chatConversations(rows).map((c: any) => c.id)).toContain(conv);
    expect(initialConversation(rows, "")).toBe(conv);
    expect(initialConversation(rows, "console")).toBe("console");
    expect(initialConversation(rows, "missing-conversation")).toBe(conv);
  });

  it("incremental reads pick up a new round once, including the bot reply", async () => {
    const previous = (await api(`/conversations/${encodeURIComponent(conv)}/messages`)).json.messages;
    const last = previous.at(-1).id;
    ilink.push("owner@im.wechat", "phone-message-two");
    await until(() => app.store.listMessages(conv).some((m) => m.role === "assistant" && m.content.includes("phone-message-two")), 8000);
    const r = await api(`/conversations/${encodeURIComponent(conv)}/messages?after=${last}&limit=100`);
    expect(r.json.messages).toHaveLength(2);
    const merged = mergeMessages(previous, r.json.messages);
    expect(mergeMessages(merged, r.json.messages)).toHaveLength(4);
    expect(merged.map((m: any) => m.id)).toEqual([...new Set(merged.map((m: any) => m.id))].sort((a: any, b: any) => a - b));
  });

  it("older history is paginated without losing records or crossing conversations", async () => {
    const other = app.store.ensureConversation("default", "weixin", "other-user");
    app.store.addMessage(other.id, "user", "other-user-private-message");
    for (let i = 0; i < 540; i++) {
      app.store.addMessage(conv, i % 2 ? "assistant" : "user", `history-${i}`);
      if (i % 25 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    let r = (await api(`/conversations/${encodeURIComponent(conv)}/messages?limit=100`)).json;
    let all = r.messages;
    while (r.hasMore) {
      r = (await api(`/conversations/${encodeURIComponent(conv)}/messages?before=${r.messages[0].id}&limit=100`)).json;
      all = mergeMessages(all, r.messages);
    }
    expect(all).toHaveLength(544);
    expect(all.every((m: any) => m.conversationId === conv)).toBe(true);
    expect(all.some((m: any) => m.content === "other-user-private-message")).toBe(false);
    expect(chatConversations([{ channel: "web", peerId: "group:abc", messageCount: 3 }, { channel: "web", peerId: "console", messageCount: 1 }])).toEqual([]);
  });

  it("rejects invalid cursors and detects a transcript cleared in WeChat", async () => {
    const root = `/conversations/${encodeURIComponent(conv)}/messages`;
    for (const query of ["limit=0", "limit=501", "before=-1", "after=bad", "after=1&before=2", "after=9007199254740993"]) expect((await api(`${root}?${query}`)).status).toBe(400);
    const last = app.store.listMessages(conv).at(-1)!.id;
    app.store.clearMessages(conv);
    app.store.addMessage(conv, "user", "after-reset");
    const r = (await api(`${root}?after=${last}`)).json;
    expect(r.cursorValid).toBe(false);
    expect(r.messages.map((m: any) => m.content)).toEqual(["after-reset"]);
  });
});

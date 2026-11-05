import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { App } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { artifactId } from "../src/core/history.js";
import { groupPeer } from "../src/store/db.js";
import { GroupChats } from "../src/core/groups.js";
import { mockIlink, mockOpenAI, until } from "./helpers.js";

describe("shared group history and WeChat artifact forwarding", () => {
  let app: App;
  let llm: Awaited<ReturnType<typeof mockOpenAI>>;
  let ilink: Awaited<ReturnType<typeof mockIlink>>;
  let dir: string, base: string, group: string, source: string, video: string, fileRef: string;
  const owner = "owner@im.wechat";
  beforeAll(async () => {
    llm = await mockOpenAI(); ilink = await mockIlink();
    dir = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), "amb-history-forward-"));
    app = new App(loadConfig({ dataDir: dir, env: { AMB_UI_PORT: "0", AMB_AGENT: "off", AMB_MAGPIE_BASE_URL: `${llm.url}/v1`, AMB_WEIXIN_API_BASE: ilink.url, AMB_WEIXIN_CDN_BASE: ilink.cdnBase } }), { printQrToTerminal: false, weixinPollTimeoutMs: 1000, fileLog: false });
    await app.start(); base = app.web!.url.replace(/\/$/, "");
    await fetch(`${base}/amb/api/channel-accounts/default/weixin/login`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    await until(() => !!app.store.getWeixinAccount("default"), 8000);
    app.store.upsertWeixinPeer({ botId: "default", userId: owner, contextToken: "ctx-1", quotaRemaining: 10, windowStartedAt: Date.now() });
    app.store.createBot({ id: "producer", name: "Video Producer" });
    app.store.createBot({ id: "reviewer", name: "Reviewer" });
    group = app.store.createGroup("Research Group", ["producer", "reviewer"]).id;
    source = app.store.ensureConversation("reviewer", "web", "console").id;
    app.store.addMessage(source, "user", "Send the video from the group to my WeChat");
    app.store.addMessage(groupPeer(group), "user", "Create the video");
    const producer = app.store.ensureConversation("producer", "web", groupPeer(group), "Research Group", "group");
    const media = path.join(dir, "workspaces", "producer", "media");
    fs.mkdirSync(media, { recursive: true });
    video = path.join(media, "shared-video.mp4");
    fs.writeFileSync(video, Buffer.concat([Buffer.from("000000186674797069736f6d0000020069736f6d", "hex"), Buffer.alloc(512)]));
    const mid = app.store.addMessage(producer.id, "assistant", "The group video is ready", undefined, { files: [video] });
    fileRef = artifactId(mid, 0);
  });
  afterAll(async () => { await app?.stop(); await llm?.close(); await ilink?.close(); if (dir) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20 }); });

  it("a different bot can discover the group and resolve its recorded video, with paginated history", () => {
    const list = app.history.list("reviewer", source);
    expect(list.groups.some((g) => g.groupId === group)).toBe(true);
    expect(list.weixin).toHaveLength(1);
    const history = app.history.read("reviewer", source, { groupId: group, limit: 1 });
    expect(history.hasMore).toBe(true);
    expect(history.messages[0]).toMatchObject({ speaker: "Video Producer", files: [{ artifactId: fileRef, name: "shared-video.mp4", kind: "video", available: true }] });
    expect(JSON.stringify(history)).not.toContain(dir);
    const older = app.history.read("reviewer", source, { groupId: group, beforeId: history.beforeId });
    expect(older.messages.some((m) => m.text === "Create the video")).toBe(true);
    let shared = "";
    const groupChats = new GroupChats({ store: app.store, runTurn: async (_bot, _group, input) => { shared = input; return "done"; } });
    groupChats.send(group, "@Reviewer find the existing group video");
    expect(shared).toContain(fileRef);
    expect(shared).toContain("shared-video.mp4");
    expect(shared).not.toContain(video);
  });

  it("forwards the actual video bytes through the real WeChat outbox and records a usable copy in the destination", async () => {
    const r = await app.history.send("reviewer", source, { artifactIds: [fileRef] }) as any;
    await app.outbox.idle();
    expect(r.files).toMatchObject([{ artifactId: fileRef, status: "sent" }]);
    expect(ilink.state.sent.some((m) => m.to === owner && !!m.item)).toBe(true);
    const conv = app.store.listConversations("default").find((c) => c.channel === "weixin" && c.peerId === owner)!;
    const message = app.store.listMessages(conv.id).at(-1)!;
    expect(message.files).toHaveLength(1);
    const copied = message.files![0];
    expect(copied.startsWith(path.join(dir, "workspaces", "default"))).toBe(true);
    expect(fs.readFileSync(copied)).toEqual(fs.readFileSync(video));
    const response = await fetch(`${base}/amb/api/conversations/${encodeURIComponent(conv.id)}/file?path=${encodeURIComponent(copied)}`);
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(fs.readFileSync(video));
  });

  it("repeating the same transfer does not send or record it twice", async () => {
    const before = ilink.state.sent.length;
    await Promise.all([app.history.send("reviewer", source, { artifactIds: [fileRef] }), app.history.send("reviewer", source, { artifactIds: [fileRef] })]);
    await app.outbox.idle();
    expect(ilink.state.sent).toHaveLength(before);
  });

  it("does not describe a media-failure fallback text as successful file delivery", async () => {
    const row = app.store.listOutbox({ limit: 100 }).find((r) => r.kind === "file" && r.id.startsWith("artifact-forward:"))!;
    app.store.updateOutbox(row.id, { progress: 1 });
    const result = await app.history.send("reviewer", source, { artifactIds: [fileRef] }) as any;
    expect(result.files[0].status).toBe("failed");
    expect(result.note).not.toBe("微信接口已接收文件");
    app.store.updateOutbox(row.id, { progress: 0 });
  });

  it("owner messages from WeChat can read group history, while allowed guests cannot", () => {
    const mine = app.store.ensureConversation("default", "weixin", owner);
    app.store.setConversationAccount(mine.id, "default");
    expect(app.history.read("default", mine.id, { groupId: group }).messages.some((m) => m.files.length > 0)).toBe(true);
    const guest = app.store.ensureConversation("default", "weixin", "guest");
    app.store.setConversationAccount(guest.id, "default");
    app.access.allow("default", "weixin", "guest", "test");
    expect(app.history.list("default", guest.id).groups).toEqual([]);
    expect(() => app.history.read("default", guest.id, { groupId: group })).toThrow("无权");
    expect(() => app.history.read("producer", source, { groupId: group })).toThrow("当前会话");
  });

  it("refuses arbitrary paths, nonexistent files and cross-workspace symlinks", async () => {
    await expect(app.history.send("reviewer", source, { artifactIds: [video] })).rejects.toThrow("编号");
    const conv = app.store.ensureConversation("producer", "web", groupPeer(group), "", "group");
    const missing = app.store.addMessage(conv.id, "assistant", "old file", undefined, { files: [path.join(dir, "workspaces", "producer", "missing.mp4")] });
    await expect(app.history.send("reviewer", source, { artifactIds: [artifactId(missing, 0)] })).rejects.toThrow("删除");
    const secret = path.join(dir, "credential.txt"); fs.writeFileSync(secret, "private-account-data");
    const forbidden = app.store.addMessage(conv.id, "assistant", "bad file", undefined, { files: [secret] });
    await expect(app.history.send("reviewer", source, { artifactIds: [artifactId(forbidden, 0)] })).rejects.toThrow("工作区");
  });

  it("reports held delivery accurately and releases it when the owner writes from WeChat", async () => {
    app.store.addMessage(source, "user", "Send the video again");
    const peer = app.store.getWeixinPeer("default", owner)!;
    app.store.upsertWeixinPeer({ ...peer, quotaRemaining: 0, windowStartedAt: Date.now() - 25 * 3600_000 });
    const before = ilink.state.sent.length;
    const result = await app.history.send("reviewer", source, { artifactIds: [fileRef] }) as any;
    expect(result.files[0].status).toBe("held");
    expect(ilink.state.sent).toHaveLength(before);
    ilink.push(owner, "resume transfers");
    await until(() => ilink.state.sent.length > before, 8000);
    await until(() => app.store.listMessages(`default:weixin:${owner}`).some((m) => m.role === "assistant" && m.content.includes("resume transfers")) && app.runtime.busySince(`default:weixin:${owner}`) === undefined, 8000);
    await app.outbox.idle();
    expect(ilink.state.sent.slice(before).some((m) => !!m.item)).toBe(true);
  });

  it("the group attachment button endpoint forwards only files recorded in that group", async () => {
    const messageId = Number(fileRef.split(":")[1]);
    const res = await fetch(`${base}/amb/api/groups/${group}/forward`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messageId, fileIndex: 0 }) });
    expect(res.status).toBe(200);
    expect((await res.json() as any).files[0].status).toBe("sent");
    const other = app.store.ensureConversation("default", "web", "console");
    const otherId = app.store.addMessage(other.id, "assistant", "unrelated");
    const invalid = await fetch(`${base}/amb/api/groups/${group}/forward`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messageId: otherId, fileIndex: 0 }) });
    expect(invalid.status).toBe(404);
  });
});

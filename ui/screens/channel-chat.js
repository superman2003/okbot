// Channel transcripts use the same stored messages as WeChat/Feishu; no copied histories.
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { html, Icon, IconButton, Notice, Skeleton } from "../components/ui.js";
import { BotAvatar } from "../components/avatar.js";
import { Markdown, Linkified } from "../components/markdown.js";
import { DeliveredFiles } from "../components/files.js";
import { PromptCard, WorkLine, MsgActions } from "./chat.js";
import { mergeMessages } from "../lib/conversations.js";
import { api } from "../lib/api.js";
import { fmtSep } from "../lib/format.js";
import { t } from "../lib/i18n.js";

export function ChannelChat({ bot, conversationId, picker, infoOpen, onToggleInfo, onLocal }) {
  const [messages, setMessages] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [unseen, setUnseen] = useState(false);
  const [stopping, setStopping] = useState(false);
  const scroller = useRef(null);
  const stick = useRef(true);
  const newest = useRef(0);
  const oldest = useRef(0);
  const alive = useRef(true);
  const loading = useRef(false);
  const refreshRef = useRef(null);
  const restore = useRef(null);
  const endpoint = `/conversations/${encodeURIComponent(conversationId)}/messages`;
  const accept = (r, reset = false) => {
    setSnapshot(r);
    setMessages((old) => reset ? r.messages : mergeMessages(old || [], r.messages));
    if (reset) {
      oldest.current = r.messages[0]?.id || 0;
      newest.current = r.messages.at(-1)?.id || 0;
      setHasOlder(r.hasMore);
    } else if (r.messages.length) newest.current = r.messages.at(-1).id;
    setError("");
  };
  useEffect(() => {
    alive.current = true;
    const ac = new AbortController();
    const refresh = async () => {
      if (loading.current) return;
      loading.current = true;
      try {
        let r = await api(`${endpoint}?limit=100${newest.current ? `&after=${newest.current}` : ""}`, { signal: ac.signal });
        if (!alive.current) return;
        // /reset can clear the transcript while this window is open.
        if (r.cursorValid === false || r.latestMessageId < newest.current) {
          r = await api(`${endpoint}?limit=100`, { signal: ac.signal });
          if (!alive.current) return;
          accept(r, true);
        } else accept(r, !newest.current);
        if (!r.busy) setStopping(false);
      } catch (e) { if (alive.current && e.name !== "AbortError") setError(e.message); }
      finally { loading.current = false; }
    };
    refreshRef.current = refresh;
    refresh();
    const timer = setInterval(() => document.visibilityState === "visible" && refresh(), 2000);
    window.addEventListener("focus", refresh);
    return () => { alive.current = false; ac.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [conversationId]);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (restore.current) {
      el.scrollTop += el.scrollHeight - restore.current.height;
      restore.current = null;
    } else if (stick.current) el.scrollTop = el.scrollHeight;
    else setUnseen(true);
  }, [messages, snapshot?.busy, snapshot?.turn?.interim?.join("\n")]);
  const older = async () => {
    if (loadingOlder || !oldest.current) return;
    setLoadingOlder(true);
    try {
      const r = await api(`${endpoint}?limit=100&before=${oldest.current}`);
      if (!alive.current) return;
      restore.current = { height: scroller.current?.scrollHeight || 0 };
      oldest.current = r.messages[0]?.id || oldest.current;
      setMessages((old) => mergeMessages(old || [], r.messages));
      setHasOlder(r.hasMore);
      setError("");
    } catch (e) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setLoadingOlder(false); }
  };
  const stop = async () => {
    setStopping(true);
    try {
      await api(`/conversations/${encodeURIComponent(conversationId)}/stop`, { method: "POST", body: {} });
      refreshRef.current?.();
    } catch (e) { if (alive.current) { setError(e.message); setStopping(false); } }
  };
  const channel = snapshot?.conversation.channel;
  const channelName = channel ? t(`info.channel.${channel}`) : t("chat.sync.channel");
  let previousDay = "";
  return html`<section class="chat channel-chat" data-screen="channel-chat" aria-label=${t("chat.sync.transcript", { channel: channelName })}>
    <header class="chat-head">
      <button type="button" class="head-bot bot-hover" title=${t("chat.infoPanel")} onClick=${onToggleInfo}>
        <${BotAvatar} bot=${bot} size=${22} state=${snapshot?.busy ? "thinking" : "idle"} /><span class="name">${bot.name}</span>
      </button>
      ${picker}<span class="grow"></span>
      <${IconButton} icon="refresh" label=${t("common.refresh")} onClick=${() => refreshRef.current?.()} />
      <${IconButton} icon="panel" label=${t("chat.infoPanel")} on=${infoOpen} onClick=${onToggleInfo} />
    </header>
    <div class="chat-scroll" ref=${scroller} onScroll=${() => {
      const el = scroller.current;
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (stick.current) setUnseen(false);
    }}>
      <div class="chat-col" role="log" aria-live="polite" aria-busy=${!!snapshot?.busy}>
        ${error && html`<${Notice} tone="red" action=${html`<button type="button" class="text" onClick=${() => refreshRef.current?.()}>${t("common.retry")}</button>`}>${t("chat.error.loadHistory", { error })}<//>`}
        ${messages === null && !error && html`<${Skeleton} w="60%" />`}
        ${hasOlder && html`<button type="button" class="text history-older" disabled=${loadingOlder} onClick=${older}>${t(loadingOlder ? "common.loading" : "chat.sync.older")}</button>`}
        ${messages?.length === 0 && html`<p class="hint">${t("info.noMessages")}</p>`}
        ${(messages || []).map((m) => {
          const day = fmtSep(m.createdAt);
          const separator = day !== previousDay;
          previousDay = day;
          const parts = m.interim?.at(-1) === m.content ? m.interim.slice(0, -1) : m.interim || [];
          const text = [...parts, m.content].filter(Boolean).join("\n\n");
          return html`${separator && html`<div class="time-sep">${day}</div>`}<div key=${m.id} class=${`msg-row ${m.role === "user" ? "user" : "assistant"}`}>
            ${m.steps > 0 && html`<${WorkLine} count=${m.steps} load=${() => api(`/conversations/${encodeURIComponent(conversationId)}/messages/${m.id}/activity`).then((r) => r.steps)} />`}
            <div class="msg">${m.role === "user" ? html`<${Linkified} text=${text} />` : html`<${Markdown} text=${text} />`}</div>
            <${DeliveredFiles} files=${m.files} conv=${conversationId} canOpen=${snapshot?.canOpen} />
            <${MsgActions} text=${text} at=${m.createdAt} />
          </div>`;
        })}
        ${snapshot?.busy && html`<div class="msg-row assistant"><${WorkLine} live stopping=${stopping} startedAt=${snapshot.turn?.since} steps=${snapshot.turn?.steps} />
          ${snapshot.turn?.interim?.length > 0 && html`<div class="msg"><${Markdown} text=${snapshot.turn.interim.join("\n\n")} /></div>`}
          <button type="button" class="text danger" disabled=${stopping} onClick=${stop}>${t(stopping ? "chat.work.stopping" : "info.turn.stop")}</button>
        </div>`}
        ${snapshot?.pending?.map((p) => html`<div class="msg-row assistant" key=${p.id}><${PromptCard} requestId=${p.id} /></div>`)}
      </div>
    </div>
    ${unseen && html`<button type="button" class="to-bottom" aria-label=${t("chat.toBottom")} onClick=${() => { stick.current = true; scroller.current.scrollTop = scroller.current.scrollHeight; setUnseen(false); }}><${Icon} name="down" /><span class="new"></span></button>`}
    <div class="composer-dock"><div class="channel-sync-note">
      <span>${t("chat.sync.readonly", { channel: channelName })}</span>
      <button type="button" class="btn" onClick=${onLocal}>${t("chat.sync.openLocal")}</button>
    </div></div>
  </section>`;
}

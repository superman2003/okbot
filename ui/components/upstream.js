import { useEffect, useState } from "preact/hooks";
import { html, Spinner } from "./ui.js";
import { api } from "../lib/api.js";
import { t } from "../lib/i18n.js";

/** Discovering/testing never writes credentials. Saving is an explicit separate action. */
export function UpstreamForm({ onConnected, onBack }) {
  const [baseUrl, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState([]);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState("load");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    api("/upstream").then((r) => {
      if (!alive) return;
      setSaved(r); setUrl(r.baseUrl); setModel(r.model); setModels(r.models);
    }).catch((e) => alive && setError(e.message)).finally(() => alive && setBusy(""));
    return () => { alive = false; };
  }, []);
  const changed = () => { setError(""); setMessage(""); };
  const action = async (kind) => {
    if (busy) return;
    setBusy(kind); changed();
    try {
      const body = { baseUrl: baseUrl.trim(), key: key.trim(), model: model.trim(), models };
      if (kind === "discover") {
        const r = await api("/upstream/models", { method: "POST", body });
        setModels(r.models);
        if (!r.models.includes(model)) setModel(r.models[0] || "");
        setMessage(t("official.custom.found", { count: r.models.length }));
      } else if (kind === "test") {
        await api("/upstream/test", { method: "POST", body });
        setMessage(t("official.custom.testOk"));
      } else if (kind === "remove") {
        await api("/upstream", { method: "DELETE" });
        setKey("");
        await onConnected();
      } else {
        await api("/upstream", { method: "PUT", body });
        setKey("");
        await onConnected();
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(""); }
  };
  const canKey = !!key.trim() || (saved?.connected && baseUrl.trim() === saved.baseUrl);
  return html`<form class="list upstream-form" onSubmit=${(e) => { e.preventDefault(); action("save"); }}>
    <p class="hint">${t("official.custom.note")}</p>
    <label class="k" for="upstream-url">${t("official.custom.url")}</label>
    <input id="upstream-url" class="field mono" type="url" placeholder="https://your-api.example/v1" required value=${baseUrl} disabled=${!!busy}
      onInput=${(e) => { setUrl(e.target.value); setModels([]); setModel(""); changed(); }} />
    <label class="k" for="upstream-key">API Key</label>
    <input id="upstream-key" class="field mono" type="password" autocomplete="off" spellcheck="false" value=${key} disabled=${!!busy}
      placeholder=${saved?.connected ? t("official.custom.keepKey", { tail: saved.keyTail }) : "sk-…"}
      onInput=${(e) => { setKey(e.target.value); setModels([]); changed(); }} />
    <button type="button" class="btn block" disabled=${!!busy || !baseUrl.trim() || !canKey} onClick=${() => action("discover")}>
      ${busy === "discover" && html`<${Spinner} />`}${t("official.custom.discover")}
    </button>
    <label class="k" for="upstream-model">${t("official.custom.model")}</label>
    ${models.length > 0 && html`<select class="field" aria-label=${t("official.custom.choose")} value=${models.includes(model) ? model : ""} disabled=${!!busy}
      onChange=${(e) => { if (e.target.value) setModel(e.target.value); changed(); }}>
      <option value="">${t("official.custom.choose")}</option>
      ${models.map((id) => html`<option key=${id} value=${id}>${id}</option>`)}
    </select>`}
    <input id="upstream-model" class="field mono" value=${model} placeholder=${t("official.custom.manual")} required disabled=${!!busy}
      onInput=${(e) => { setModel(e.target.value); changed(); }} />
    <p class="hint">${t("official.custom.modelNote")}</p>
    <button type="button" class="btn block" disabled=${!!busy || !model.trim() || !canKey || !baseUrl.trim()} onClick=${() => action("test")}>
      ${busy === "test" && html`<${Spinner} />`}${t("official.custom.test")}
    </button>
    <p class="hint">${t("official.custom.testNote")}</p>
    ${error && html`<div class="err-text" role="alert">${error}</div>`}
    ${message && html`<p class="hint" role="status">${message}</p>`}
    <button type="submit" class="btn primary lg block" disabled=${!!busy || !model.trim() || !canKey || !baseUrl.trim()}>
      ${busy === "save" && html`<${Spinner} />`}${t("official.custom.save")}
    </button>
    ${saved?.connected && html`<button type="button" class="text danger" disabled=${!!busy} onClick=${() => action("remove")}>${t("official.custom.remove")}</button>`}
    ${onBack && html`<div class="login-links"><button type="button" class="text" onClick=${onBack} disabled=${!!busy}>${t("official.custom.back")}</button></div>`}
  </form>`;
}

/** User-configured model upstream. No vendor-specific account APIs. */
export const CUSTOM_PROVIDER = "custom-upstream";
export type UpstreamProtocol = "openai" | "anthropic";
export type UpstreamAuth = "api-key" | "bearer";
export interface UpstreamConnectionInput { baseUrl?: unknown; key?: unknown; protocol?: unknown; authMode?: unknown }
export const ANTHROPIC_VERSION = "2023-06-01";
export function normalizeUpstreamProtocol(value: unknown): UpstreamProtocol {
  if (value === undefined || value === "openai") return "openai";
  if (value === "anthropic") return "anthropic";
  throw new Error("请选择 OpenAI Chat Completions 或 Anthropic Messages 协议");
}
export function normalizeUpstreamAuth(value: unknown, protocol: UpstreamProtocol): UpstreamAuth {
  if (value !== undefined && value !== "api-key" && value !== "bearer") throw new Error("请选择有效的 API 鉴权方式");
  return protocol === "openai" ? "bearer" : value === "bearer" ? "bearer" : "api-key";
}
export const isCustomModel = (model: string): boolean => model.trim().startsWith(`${CUSTOM_PROVIDER}/`);
export const customModel = (model: string): string => isCustomModel(model) ? model.trim() : `${CUSTOM_PROVIDER}/${model.trim()}`;

export function normalizeUpstreamUrl(value: unknown, protocol: UpstreamProtocol = "openai"): string {
  if (typeof value !== "string" || value.length > 2048) throw new Error("请输入有效的 API Base URL");
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("请输入完整的 http:// 或 https:// API 地址"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("API 地址仅支持 HTTP(S)，不能包含账号、密码、查询参数或片段");
  }
  let pathname = url.pathname.replace(/\/+$/, "");
  pathname = protocol === "anthropic" ? pathname.replace(/\/(messages|models)$/, "") : pathname.replace(/\/(chat\/completions|responses|models)$/, "");
  if (protocol === "anthropic" && !pathname.endsWith("/v1")) pathname += "/v1";
  url.pathname = pathname || "/v1";
  return url.toString().replace(/\/+$/, "");
}

export function validateUpstreamKey(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 4096 || /\s/.test(value.trim())) throw new Error("请输入有效的 API Key");
  return value.trim();
}

export function validateUpstreamModel(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 512 || /[\x00-\x1f\x7f]/.test(value)) throw new Error("请选择或填写模型 ID");
  return value.trim();
}

async function request(baseUrl: string, key: string, path: string, init: RequestInit, fetchImpl: typeof fetch, protocol: UpstreamProtocol, authMode: UpstreamAuth): Promise<any> {
  let res: Response;
  try {
    const auth: Record<string, string> = protocol === "anthropic" ? { ...(authMode === "bearer" ? { Authorization: `Bearer ${key}` } : { "x-api-key": key }), "anthropic-version": ANTHROPIC_VERSION } : { Authorization: `Bearer ${key}` };
    res = await fetchImpl(`${baseUrl}${path}`, { ...init, redirect: "error", headers: { ...auth, Accept: "application/json", "Content-Type": "application/json" }, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new Error("上游连接失败或超时，请检查 API 地址、网络及代理设置");
  }
  if (!res.ok) {
    const detail = res.status === 401 ? "API Key 无效" : res.status === 403 ? "Key 无权访问此接口或模型" : res.status === 404 ? "接口不存在，请检查 Base URL；也可以手填模型 ID" : res.status === 429 ? "上游限流或额度不足" : "上游请求失败";
    throw new Error(`${detail}（HTTP ${res.status}）`);
  }
  try { return await res.json(); } catch { throw new Error("上游未返回有效 JSON，请检查 API 地址"); }
}

export async function discoverUpstream(baseUrl: string, key: string, fetchImpl: typeof fetch = fetch, protocol: UpstreamProtocol = "openai", authMode: UpstreamAuth = "api-key"): Promise<string[]> {
  const models = new Set<string>();
  const cursors = new Set<string>();
  let path = "/models";
  for (let page = 0; page < 100; page++) {
    const body = await request(baseUrl, key, path, { method: "GET" }, fetchImpl, protocol, authMode);
    if (!Array.isArray(body?.data)) throw new Error("模型列表格式不兼容：需要 data 数组，可手填模型 ID");
    for (const m of body.data) {
      if (typeof m?.id === "string" && m.id.trim() && m.id.length <= 512 && !/[\x00-\x1f\x7f]/.test(m.id)) models.add(m.id.trim());
    }
    if (models.size > 10000) throw new Error("模型列表过大，请手填需要的模型 ID");
    if (protocol !== "anthropic" || !body.has_more) break;
    const cursor = body.last_id;
    if (typeof cursor !== "string" || !cursor || cursor.length > 512 || cursors.has(cursor) || page === 99) throw new Error("上游模型分页异常，请手填模型 ID");
    cursors.add(cursor);
    path = `/models?after_id=${encodeURIComponent(cursor)}`;
  }
  if (!models.size) throw new Error("此 Key 未返回可用模型，请检查权限或手填模型 ID");
  return [...models].sort();
}

export async function testUpstream(baseUrl: string, key: string, model: string, fetchImpl: typeof fetch = fetch, protocol: UpstreamProtocol = "openai", authMode: UpstreamAuth = "api-key"): Promise<void> {
  const messages = [{ role: "user", content: "Reply with OK only." }];
  const body = await request(baseUrl, key, protocol === "anthropic" ? "/messages" : "/chat/completions", {
    method: "POST", body: JSON.stringify({ model, stream: false, messages, ...(protocol === "anthropic" ? { max_tokens: 64 } : {}) }),
  }, fetchImpl, protocol, authMode);
  if (protocol === "anthropic") {
    if (!Array.isArray(body?.content) || !body.content.some((b: any) => b?.type === "text" && typeof b.text === "string" && b.text.trim())) throw new Error("模型没有返回有效回复，请检查 Anthropic Messages 接口和模型 ID");
    return;
  }
  if (!body?.choices?.[0]?.message?.content) throw new Error("模型没有返回有效回复，请选择支持 Chat Completions 的对话模型");
}

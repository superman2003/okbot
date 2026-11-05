/** User-configured OpenAI-compatible upstream. No vendor-specific account APIs. */
export const CUSTOM_PROVIDER = "custom-upstream";
export const isCustomModel = (model: string): boolean => model.trim().startsWith(`${CUSTOM_PROVIDER}/`);
export const customModel = (model: string): string => isCustomModel(model) ? model.trim() : `${CUSTOM_PROVIDER}/${model.trim()}`;

export function normalizeUpstreamUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) throw new Error("请输入有效的 API Base URL");
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("请输入完整的 http:// 或 https:// API 地址"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("API 地址仅支持 HTTP(S)，不能包含账号、密码、查询参数或片段");
  }
  url.pathname = url.pathname.replace(/\/+$/, "").replace(/\/(chat\/completions|responses|models)$/, "") || "/v1";
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

async function request(baseUrl: string, key: string, path: string, init: RequestInit, fetchImpl: typeof fetch): Promise<any> {
  let res: Response;
  try {
    res = await fetchImpl(`${baseUrl}${path}`, { ...init, redirect: "error", headers: { Authorization: `Bearer ${key}`, Accept: "application/json", "Content-Type": "application/json" }, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new Error("上游连接失败或超时，请检查 API 地址、网络及代理设置");
  }
  if (!res.ok) {
    const detail = res.status === 401 ? "API Key 无效" : res.status === 403 ? "Key 无权访问此接口或模型" : res.status === 404 ? "接口不存在，请检查 Base URL；也可以手填模型 ID" : res.status === 429 ? "上游限流或额度不足" : "上游请求失败";
    throw new Error(`${detail}（HTTP ${res.status}）`);
  }
  try { return await res.json(); } catch { throw new Error("上游未返回有效 JSON，请检查 API 地址"); }
}

export async function discoverUpstream(baseUrl: string, key: string, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const body = await request(baseUrl, key, "/models", { method: "GET" }, fetchImpl);
  if (!Array.isArray(body?.data)) throw new Error("模型列表格式不兼容：需要 OpenAI 格式的 data 数组，可手填模型 ID");
  const models = [...new Set<string>(body.data.filter((m: any) => typeof m?.id === "string" && m.id.trim() && m.id.length <= 512 && !/[\x00-\x1f\x7f]/.test(m.id)).map((m: any) => m.id.trim()))].sort();
  if (!models.length) throw new Error("此 Key 未返回可用模型，请检查权限或手填模型 ID");
  return models;
}

export async function testUpstream(baseUrl: string, key: string, model: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const body = await request(baseUrl, key, "/chat/completions", { method: "POST", body: JSON.stringify({ model, stream: false, messages: [{ role: "user", content: "Reply with OK only." }] }) }, fetchImpl);
  if (!body?.choices?.[0]?.message?.content) throw new Error("模型没有返回有效回复，请选择支持 Chat Completions 的对话模型");
}

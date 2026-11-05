/**
 * 模型选择器里的能力与参考价：
 * - 能力来自 GET {线路}/v1/model-profiles（带 Key；上下文、视觉、工具调用、推理）。
 * - 价格与模型支持的接口来自公开价格目录 GET https://modelflare.dev/api/pricing（不带 Key，origin 域名不开放）。
 *   只算按 token 计费和按次计费的模型：价格 = 基础价 × 该模型可用公开分组里最低的分组倍率 ×
 *   模型售价倍率，单位美元 / 百万 tokens（按次为美元 / 次）。这是“起步参考价”，实际以账单为准；
 *   阶梯计费、图片、视频等复杂计费不展示价格。
 * - 模型智能与每次任务的花费（「模型智能」滑块）：Artificial Analysis 的快照（model-quality.ts），花费再乘上
 *   这个模型在三种性价比下的分组倍率（factors）。
 */
import { agentApi, effortApplies } from "../agent/host.js";
import { qualityFor, type QualitySnapshot } from "./model-quality.js";
import type { RoutingStrategy } from "./client.js";

export interface ModelInfo {
  group?: { name: string; description: string; ratio: number | string };
  context?: number;
  vision?: boolean;
  tools?: boolean;
  reasoning?: boolean;
  price?: { input?: number; output?: number; perCall?: number };
  /** 后台任务、规则估算花费用的单价（3e）：比 price 多了缓存命中 / 写入，阶梯计费的取基础那一档 */
  rates?: Rates;
  /** 推理强度对这个模型有效（AgentHost 会带上）；界面据此决定显示不显示这个控件 */
  effort?: boolean;
  /** 支持的接口（目录的 supported_endpoint_types：openai、openai-response、openai-response-compact、anthropic、gemini…） */
  endpoints?: string[];
  /** 三种性价比（Key 的路由策略）下实际付的比例：分组倍率 × 模型售价倍率（strategyFactors） */
  factors?: Record<RoutingStrategy, number>;
  /** 应用实际用的那一档的 AA 智能指数与每次任务的花费（官方定价，美元） */
  quality?: { intelligence: number; costPerTask: number };
}

interface Profile {
  context_window?: number;
  input_modalities?: string[];
  tool_calling?: boolean;
  reasoning?: boolean;
}

export interface PricingEntry {
  model_name: string;
  context_window?: number;
  quota_type: number;
  input_price?: number;
  model_ratio?: number;
  model_price?: number;
  completion_ratio?: number;
  /** 缓存命中价 = 输入价 × cache_ratio；写入缓存 = 输入价 × create_cache_ratio */
  cache_ratio?: number;
  create_cache_ratio?: number;
  enable_groups?: string[];
  billing_mode?: string;
  pricing_rules?: unknown;
  sale_price_multiplier?: number;
  supported_endpoint_types?: string[];
}

export interface PricingCatalog {
  data?: PricingEntry[];
  group_ratio?: Record<string, number>;
  usable_group?: Record<string, unknown>;
}

/** 估算花费用的单价（美元 / 百万 tokens） */
export interface Rates {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
}

const round = (n: number) => Math.round(n * 10_000) / 10_000;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);

/** 分组倍率：可用公开分组里最低的 × 模型售价倍率；没有可用分组时 undefined */
function factorOf(entry: PricingEntry, catalog: PricingCatalog): number | undefined {
  const ratios = (entry.enable_groups ?? [])
    .filter((g) => !catalog.usable_group || g in catalog.usable_group)
    .map((g) => catalog.group_ratio?.[g])
    .filter((r): r is number => typeof r === "number" && Number.isFinite(r) && r >= 0);
  if (!ratios.length) return undefined;
  const sale = Number(entry.sale_price_multiplier) > 0 ? Number(entry.sale_price_multiplier) : 1;
  return Math.min(...ratios) * sale;
}

/**
 * 三种性价比下的价格倍率（相对官方定价）：这个模型可用的公开分组的倍率 × 模型售价倍率。
 * 低价优先取最低的分组，稳定优先取最高的，均衡取居中的那个（偶数个时取居中两个里贵的那个：OKINTO 的均衡
 * 从价格居中的分组开始，先往贵的试）。企业专用的分组（名字带 enterprise）普通账户用不了，不算。
 */
export function strategyFactors(entry: PricingEntry, catalog: PricingCatalog): Record<RoutingStrategy, number> | undefined {
  const ratios = (entry.enable_groups ?? [])
    .filter((g) => (!catalog.usable_group || g in catalog.usable_group) && !/enterprise/i.test(g))
    .map((g) => catalog.group_ratio?.[g])
    .filter((r): r is number => typeof r === "number" && Number.isFinite(r) && r >= 0)
    .sort((a, b) => a - b);
  if (!ratios.length) return undefined;
  const sale = Number(entry.sale_price_multiplier) > 0 ? Number(entry.sale_price_multiplier) : 1;
  const f = (r: number) => round(r * sale);
  return { low_cost: f(ratios[0]), balanced: f(ratios[Math.floor(ratios.length / 2)]), stable: f(ratios[ratios.length - 1]) };
}

/** 一个模型的起步参考价；算不出来（复杂计费、没有可用分组）时 undefined */
export function referencePrice(entry: PricingEntry, catalog: PricingCatalog): ModelInfo["price"] {
  if (entry.billing_mode || entry.pricing_rules) return undefined;
  const factor = factorOf(entry, catalog);
  if (factor === undefined) return undefined;
  if (entry.quota_type === 1) return typeof entry.model_price === "number" ? { perCall: round(entry.model_price * factor) } : undefined;
  if (entry.quota_type !== 0) return undefined;
  const base = typeof entry.input_price === "number" ? entry.input_price : Number(entry.model_ratio) * 2;
  if (!Number.isFinite(base)) return undefined;
  const output = Number(entry.completion_ratio);
  return { input: round(base * factor), ...(Number.isFinite(output) ? { output: round(base * output * factor) } : {}) };
}

/**
 * 估算花费用的单价（后台任务、规则的预算，3e）：同样按可用分组里最低的倍率；比参考价多了缓存命中、写入的价，
 * 阶梯计费的取基础那一档（没有条件的那档，长上下文更贵的那档不算：估算写「约」，账单为准）。按次计费的不给。
 */
export function estimateRates(entry: PricingEntry, catalog: PricingCatalog): Rates | undefined {
  if (entry.quota_type !== 0 || (entry.billing_mode && !entry.pricing_rules)) return undefined;
  const factor = factorOf(entry, catalog);
  if (factor === undefined) return undefined;
  const tiers = (entry.pricing_rules as { tiers?: Array<{ conditions?: unknown; unit_prices?: Record<string, unknown> }> } | undefined)?.tiers;
  const tier = Array.isArray(tiers) ? (tiers.find((t) => !t?.conditions) ?? tiers[0]) : undefined;
  if (tier?.unit_prices) {
    const u = tier.unit_prices;
    const input = num(u.input);
    if (input === undefined) return undefined;
    const cacheRead = num(u.cache_read);
    const cacheWrite = num(u.cache_write);
    return {
      input: round(input * factor),
      output: round((num(u.output) ?? input) * factor),
      ...(cacheRead !== undefined ? { cacheRead: round(cacheRead * factor) } : {}),
      ...(cacheWrite !== undefined ? { cacheWrite: round(cacheWrite * factor) } : {}),
    };
  }
  if (entry.billing_mode || entry.pricing_rules) return undefined;
  const base = typeof entry.input_price === "number" ? entry.input_price : Number(entry.model_ratio) * 2;
  if (!Number.isFinite(base) || base < 0) return undefined;
  const input = base * factor;
  const completion = num(entry.completion_ratio);
  const cacheRead = num(entry.cache_ratio);
  const cacheWrite = num(entry.create_cache_ratio);
  return {
    input: round(input),
    output: round(input * (completion ?? 1)),
    ...(cacheRead !== undefined ? { cacheRead: round(input * cacheRead) } : {}),
    ...(cacheWrite !== undefined ? { cacheWrite: round(input * cacheWrite) } : {}),
  };
}

const perMillion = (v: unknown) => {
  const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? round(n * 1_000_000) : undefined;
};

/** 网关 /v1/models 的一行：资料来自网关的模型目录，价格是厂商的官方价（OpenRouter 的写法：美元 / token 的字符串） */
export interface GatewayModelRow {
  id?: unknown;
  context_length?: unknown;
  reasoning?: unknown;
  modalities?: { input?: unknown };
  pricing?: { prompt?: unknown; completion?: unknown; input_cache_read?: unknown; input_cache_write?: unknown };
}

/**
 * 官方 API 模型的资料：按完整 id（official-<厂商>/<模型>）给，不和 OKINTO 目录里的同名模型混。
 * 走官方 API 付的就是官方价，所以三种性价比的倍率都是 1；endpoint 是这家厂商在代理上走的接口。
 */
export function gatewayModelInfo(rows: readonly GatewayModelRow[], endpointOf: (id: string) => string | undefined, nameOf: (id: string) => string, quality?: QualitySnapshot): Record<string, ModelInfo> {
  const out: Record<string, ModelInfo> = {};
  for (const r of rows) {
    const id = typeof r.id === "string" ? r.id : "";
    const endpoint = id ? endpointOf(id) : undefined;
    if (!endpoint) continue;
    const input = perMillion(r.pricing?.prompt);
    const output = perMillion(r.pricing?.completion);
    const cacheRead = perMillion(r.pricing?.input_cache_read);
    const cacheWrite = perMillion(r.pricing?.input_cache_write);
    const context = Number(r.context_length);
    const modalities = r.modalities?.input;
    const info: ModelInfo = {
      ...(context > 0 ? { context } : {}),
      ...(Array.isArray(modalities) ? { vision: modalities.includes("image") } : {}),
      ...(typeof r.reasoning === "boolean" ? { reasoning: r.reasoning } : {}),
      ...(input !== undefined ? { price: { input, ...(output !== undefined ? { output } : {}) } } : {}),
      ...(input !== undefined ? { rates: { input, output: output ?? input, ...(cacheRead !== undefined ? { cacheRead } : {}), ...(cacheWrite !== undefined ? { cacheWrite } : {}) } } : {}),
      endpoints: [endpoint],
      factors: { low_cost: 1, balanced: 1, stable: 1 },
    };
    if (effortApplies(agentApi(info.endpoints), info.reasoning)) info.effort = true;
    const q = qualityFor(quality?.models[nameOf(id)], info);
    if (q) info.quality = q;
    out[id] = info;
  }
  return out;
}

export async function loadModelInfo(o: {
  baseUrl: string;
  apiKey: string;
  headers: Record<string, string>;
  pricingUrl: string;
  /** Artificial Analysis 快照（assets/model-quality.json） */
  quality?: QualitySnapshot;
  fetchImpl?: typeof fetch;
  /** New API publishes endpoint/price metadata through /api/pricing. */
  profiles?: boolean;
}): Promise<Record<string, ModelInfo>> {
  const f = o.fetchImpl ?? fetch;
  const get = async <T>(url: string, headers: Record<string, string>): Promise<T | undefined> => {
    try {
      const res = await f(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(10_000) });
      return res.ok ? ((await res.json()) as T) : undefined;
    } catch {
      return undefined;
    }
  };
  const [profiles, catalog] = await Promise.all([
    o.apiKey && o.profiles !== false ? get<{ data?: Record<string, Profile> }>(`${o.baseUrl}/model-profiles`, { Authorization: `Bearer ${o.apiKey}`, ...o.headers }) : undefined,
    get<PricingCatalog>(o.pricingUrl, {}),
  ]);
  const out: Record<string, ModelInfo> = {};
  for (const [id, p] of Object.entries(profiles?.data ?? {})) {
    out[id] = {
      ...(p.context_window ? { context: p.context_window } : {}),
      ...(p.input_modalities ? { vision: p.input_modalities.includes("image") } : {}),
      ...(typeof p.tool_calling === "boolean" ? { tools: p.tool_calling } : {}),
      ...(typeof p.reasoning === "boolean" ? { reasoning: p.reasoning } : {}),
    };
  }
  for (const entry of catalog?.data ?? []) {
    const price = referencePrice(entry, catalog!);
    if (price) out[entry.model_name] = { ...out[entry.model_name], price };
    const rates = estimateRates(entry, catalog!);
    if (rates) out[entry.model_name] = { ...out[entry.model_name], rates };
    // 没有 Key（拿不到 model-profiles）时，上下文长度用公开目录里的
    if (Number(entry.context_window) > 0 && !out[entry.model_name]?.context) out[entry.model_name] = { ...out[entry.model_name], context: Number(entry.context_window) };
    if (Array.isArray(entry.supported_endpoint_types)) out[entry.model_name] = { ...out[entry.model_name], endpoints: entry.supported_endpoint_types.map(String) };
    const factors = strategyFactors(entry, catalog!);
    if (factors) out[entry.model_name] = { ...out[entry.model_name], factors };
  }
  for (const m of Object.values(out)) if (effortApplies(agentApi(m.endpoints), m.reasoning)) m.effort = true;
  // 智能与花费：要知道走哪个接口、推理不推理（上面的 endpoints、reasoning），才知道取哪一档
  for (const [id, entry] of Object.entries(o.quality?.models ?? {})) {
    const q = out[id]?.factors ? qualityFor(entry, out[id]) : undefined;
    if (q) out[id] = { ...out[id], quality: q };
  }
  return out;
}

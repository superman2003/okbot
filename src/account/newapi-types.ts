/** The site owns authentication UI. Refresh cookies stay in an isolated Chromium session. */
export interface NewApiDesktop {
  fetch: typeof fetch;
  login(): { result: Promise<void>; cancel(): void };
  clear(): Promise<void>;
}

export function playgroundModel(group: string, model: string): string {
  return `Okinto/${encodeURIComponent(group)}/${model}`;
}

export function parsePlaygroundModel(id: string): { group: string; model: string } | undefined {
  const unwrapped = id.replace(/^(?:modelflare|mfb-[\w-]+)\//, "");
  const match = unwrapped.match(/^(?:okinto|newapi)\/([^/]+)\/(.+)$/i);
  if (!match) return undefined;
  try { return { group: decodeURIComponent(match[1]), model: match[2] }; } catch { return undefined; }
}

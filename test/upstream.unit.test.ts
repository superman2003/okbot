import { describe, it, expect } from "vitest";
import { normalizeUpstreamUrl, normalizeUpstreamProtocol, discoverUpstream, testUpstream } from "../src/upstream.js";

describe("custom upstream", () => {
  it("normalizes root and full endpoint URLs while preserving custom API paths", () => {
    expect(normalizeUpstreamUrl(" https://relay.example/ ")).toBe("https://relay.example/v1");
    expect(normalizeUpstreamUrl("https://relay.example/openai/v1/chat/completions/")).toBe("https://relay.example/openai/v1");
    expect(normalizeUpstreamUrl("http://localhost:1234/api")).toBe("http://localhost:1234/api");
    for (const url of ["file:///tmp/key", "https://user:secret@relay.example", "https://relay.example?key=secret", "https://relay.example/#key", "relay.example"]) expect(() => normalizeUpstreamUrl(url)).toThrow();
  });

  it("deduplicates real model IDs, sends credentials only to the chosen URL and blocks redirects", async () => {
    const f = (async (url: string, init: RequestInit) => {
      expect(url).toBe("http://localhost:1234/api/models");
      expect(init.redirect).toBe("error");
      expect(init.headers).toMatchObject({ Authorization: "Bearer secret" });
      return Response.json({ data: [{ id: "vendor/model" }, { id: "vendor/model" }, { id: 1 }, { id: " " }] });
    }) as typeof fetch;
    expect(await discoverUpstream("http://localhost:1234/api", "secret", f)).toEqual(["vendor/model"]);
  });

  it("reports denied keys and malformed catalogs without exposing upstream error bodies", async () => {
    await expect(discoverUpstream("https://relay.example/v1", "secret", (async () => new Response("secret", { status: 401 })) as typeof fetch)).rejects.toThrow("401");
    await expect(discoverUpstream("https://relay.example/v1", "secret", (async () => Response.json({ models: [] })) as typeof fetch)).rejects.toThrow("data");
    await expect(testUpstream("https://relay.example/v1", "secret", "gpt", (async () => Response.json({ choices: [] })) as typeof fetch)).rejects.toThrow("有效回复");
  });

  it("normalizes Anthropic roots, prefixes and full Messages URLs without duplicating /v1", () => {
    for (const suffix of ["", "/", "/v1", "/v1/", "/v1/messages", "/v1/models/"]) expect(normalizeUpstreamUrl(`https://relay.example${suffix}`, "anthropic")).toBe("https://relay.example/v1");
    expect(normalizeUpstreamUrl("https://relay.example/proxy/anthropic", "anthropic")).toBe("https://relay.example/proxy/anthropic/v1");
    expect(normalizeUpstreamUrl("https://relay.example/proxy/anthropic/v1/messages", "anthropic")).toBe("https://relay.example/proxy/anthropic/v1");
    expect(normalizeUpstreamProtocol(undefined)).toBe("openai");
    expect(() => normalizeUpstreamProtocol("other")).toThrow();
  });

  it("paginates Anthropic models with x-api-key and preserves opaque model IDs", async () => {
    const urls: string[] = [];
    const f = (async (url: string, init: RequestInit) => {
      urls.push(url);
      expect(init.headers).toMatchObject({ "x-api-key": "secret", "anthropic-version": "2023-06-01" });
      expect(new Headers(init.headers).has("authorization")).toBe(false);
      expect(init.redirect).toBe("error");
      return urls.length === 1 ? Response.json({ data: [{ id: "vendor/model" }], has_more: true, last_id: "vendor/model" }) : Response.json({ data: [{ id: "second-model" }], has_more: false });
    }) as typeof fetch;
    expect(await discoverUpstream("https://relay.example/v1", "secret", f, "anthropic")).toEqual(["second-model", "vendor/model"]);
    expect(urls).toEqual(["https://relay.example/v1/models", "https://relay.example/v1/models?after_id=vendor%2Fmodel"]);
  });

  it("tests Messages using max_tokens and content blocks, and rejects invalid pagination", async () => {
    await testUpstream("https://relay.example/v1", "secret", "model", (async (url: string, init: RequestInit) => {
      expect(url).toBe("https://relay.example/v1/messages");
      expect(JSON.parse(init.body as string)).toMatchObject({ model: "model", max_tokens: 64, stream: false });
      return Response.json({ content: [{ type: "thinking", thinking: "..." }, { type: "text", text: "OK" }] });
    }) as typeof fetch, "anthropic");
    await expect(testUpstream("https://relay.example/v1", "secret", "model", (async () => Response.json({ content: [{ type: "text", text: "" }] })) as typeof fetch, "anthropic")).rejects.toThrow("有效回复");
    await expect(discoverUpstream("https://relay.example/v1", "secret", (async () => Response.json({ data: [{ id: "one" }], has_more: true, last_id: "one" })) as typeof fetch, "anthropic")).rejects.toThrow("分页");
  });

  it("supports Anthropic Bearer endpoints without sending a second authentication header", async () => {
    const f = (async (_url: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      expect(headers.get("authorization")).toBe("Bearer secret");
      expect(headers.get("anthropic-version")).toBe("2023-06-01");
      expect(headers.has("x-api-key")).toBe(false);
      return Response.json({ data: [{ id: "model" }] });
    }) as typeof fetch;
    expect(await discoverUpstream("https://relay.example/v1", "secret", f, "anthropic", "bearer")).toEqual(["model"]);
  });
});

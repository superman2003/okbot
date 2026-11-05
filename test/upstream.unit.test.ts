import { describe, it, expect } from "vitest";
import { normalizeUpstreamUrl, discoverUpstream, testUpstream } from "../src/upstream.js";

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
});

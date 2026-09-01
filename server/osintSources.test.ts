import { afterEach, describe, expect, it, vi } from "vitest";
import { resetSourceCircuits, searchPublicSources } from "./osintSources";

afterEach(() => {
  vi.unstubAllGlobals();
  resetSourceCircuits();
});

describe("public-source resilience", () => {
  it("returns partial results when one allowlisted source fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("cisa.gov")) return new Response("not-json", { status: 200 });
      return new Response(JSON.stringify({ vulnerabilities: [{ cve: { id: "CVE-2026-0001", descriptions: [{ lang: "en", value: "A public finding" }] } }] }), { status: 200 });
    }));
    const result = await searchPublicSources("CVE-2026");
    expect(result.status).toBe("partial");
    expect(result.items).toHaveLength(1);
    expect(result.sources.find(source => source.source === "CISA KEV")?.status).toBe("unavailable");
  });

  it("opens a circuit after repeated upstream failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("NETWORK_DOWN"); }));
    const first = await searchPublicSources("CVE-2026");
    const second = await searchPublicSources("CVE-2026");
    const third = await searchPublicSources("CVE-2026");
    const fourth = await searchPublicSources("CVE-2026");
    expect(first.status).toBe("unavailable");
    expect(second.status).toBe("unavailable");
    expect(third.status).toBe("unavailable");
    expect(fourth.sources.every(source => source.error === "CIRCUIT_OPEN")).toBe(true);
  });

  it("rejects queries outside the bounded input contract", async () => {
    await expect(searchPublicSources("x")).rejects.toThrow("QUERY_MUST_BE_BETWEEN_2_AND_180_CHARACTERS");
    await expect(searchPublicSources("a".repeat(181))).rejects.toThrow("QUERY_MUST_BE_BETWEEN_2_AND_180_CHARACTERS");
  });
});

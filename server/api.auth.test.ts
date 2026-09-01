import { describe, expect, it, vi } from "vitest";
import { isAuthorizedApiKey } from "./apiAuth";

describe("custom API authentication", () => {
  it("accepts the configured bearer key and rejects missing or incorrect keys", () => {
    vi.stubEnv("OBEDIANCE_API_KEY", "test-only-obediance-key");
    expect(isAuthorizedApiKey("Bearer test-only-obediance-key")).toBe(true);
    expect(isAuthorizedApiKey(undefined)).toBe(false);
    expect(isAuthorizedApiKey("Bearer invalid-key")).toBe(false);
    vi.unstubAllEnvs();
  });
});

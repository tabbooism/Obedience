import { describe, expect, it } from "vitest";
import { isAuthorizedApiKey } from "./apiAuth";

describe("custom API authentication", () => {
  it("accepts the configured bearer key and rejects missing or incorrect keys", () => {
    const configured = process.env.OBEDIANCE_API_KEY;
    expect(configured, "OBEDIANCE_API_KEY must be configured for this test").toBeTruthy();
    expect(isAuthorizedApiKey(`Bearer ${configured}`)).toBe(true);
    expect(isAuthorizedApiKey(undefined)).toBe(false);
    expect(isAuthorizedApiKey("Bearer invalid-key")).toBe(false);
  });
});

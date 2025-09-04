import { describe, expect, it } from "vitest";

import { countTokens } from "./count-tokens";

describe("countTokens", () => {
  it("should count tokens correctly for text", () => {
    const text = "Hello world";
    const result = countTokens("gpt-4o-mini", text);

    expect(result.count).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it("should return consistent results for same text", () => {
    const text = "Consistent test text";
    const result1 = countTokens("gpt-4o-mini", text);
    const result2 = countTokens("gpt-4o-mini", text);

    expect(result1.count).toBe(result2.count);
  });
});

import { describe, expect, it } from "vitest";

import { TAiCapabilityResponse, TParsedTask } from "@types";
import { extractOpenaiTokenUsage } from "./extract-openai-token-usage";

describe("extractOpenaiTokenUsage", () => {
  it("should extract tokens from valid metadata", () => {
    const openaiMetadata: TAiCapabilityResponse<TParsedTask>["openaiMetadata"] =
      {
        core: {
          responseId: "id-1",
          tokens: { input: 100, output: 50 },
          durationMs: 500,
        },
      };

    const result = extractOpenaiTokenUsage(openaiMetadata);

    expect(result).toBe(150);
  });

  it("should sum tokens from multiple metadata entries", () => {
    const openaiMetadata: TAiCapabilityResponse<TParsedTask>["openaiMetadata"] =
      {
        core: {
          responseId: "id-1",
          tokens: { input: 100, output: 50 },
          durationMs: 500,
        },
        secondary: {
          responseId: "id-2",
          tokens: { input: 200, output: 75 },
          durationMs: 300,
        },
      };

    const result = extractOpenaiTokenUsage(openaiMetadata);

    expect(result).toBe(425); // (100 + 50) + (200 + 75)
  });

  it("should return 0 when metadata is empty object", () => {
    const result = extractOpenaiTokenUsage({});

    expect(result).toBe(0);
  });
});

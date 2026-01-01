import { describe, expect, it, vi } from "vitest";

import { CAPABILITY_PATTERN } from "@constants";
import { getPatternExecutor } from "@controllers/capabilities-controller/executors/get-pattern-executor";

vi.mock("@config/env", () => ({
  env: {
    SERVICE_NAME: "test-service",
    SERVICE_PORT: 3000,
  },
}));

describe("getPatternExecutor", () => {
  it.each([
    {
      pattern: CAPABILITY_PATTERN.SYNC,
    },
    {
      pattern: CAPABILITY_PATTERN.ASYNC,
    },
  ])("should return $pattern executor for $pattern pattern", ({ pattern }) => {
    const executor = getPatternExecutor(pattern);

    expect(typeof executor).toBe("function");
  });
});

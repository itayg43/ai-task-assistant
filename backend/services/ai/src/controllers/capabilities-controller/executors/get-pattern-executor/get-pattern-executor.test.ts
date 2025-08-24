import { describe, expect, it } from "vitest";

import { getPatternExecutor } from "@controllers/capabilities-controller/executors/get-pattern-executor";

describe("getPatternExecutor", () => {
  it("should return sync executor for sync pattern", () => {
    const executor = getPatternExecutor("sync");

    expect(typeof executor).toBe("function");
  });

  it("should throw error for async pattern", () => {
    expect(() => getPatternExecutor("async")).toThrow(expect.any(Error));
  });
});

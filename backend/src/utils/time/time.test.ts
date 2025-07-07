import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import { getElapsedTime } from "./time";

describe("time", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getElapsedTime", () => {
    it("should return the correct elapsed time", () => {
      vi.setSystemTime(2000); // set Date.now() to return 2000

      expect(getElapsedTime(1500)).toBe(500);
    });
  });
});

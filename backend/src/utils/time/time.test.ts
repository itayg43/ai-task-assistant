import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentTime, getElapsedTime } from "@utils/time";

describe("time", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getCurrentTime", () => {
    it("should return the correct time", () => {
      vi.setSystemTime(2000); // set Date.now() to return 2000

      expect(getCurrentTime()).toBe(2000);
    });
  });

  describe("getElapsedTime", () => {
    it("should return the correct elapsed time", () => {
      vi.setSystemTime(2000); // set Date.now() to return 2000

      expect(getElapsedTime(1500)).toBe(500);
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withDurationAsync, withDurationSync } from "./with-duration";

describe("withDuration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("withDurationSync", () => {
    it("should measure duration of synchronous operations", () => {
      vi.setSystemTime(0);

      const result = withDurationSync(() => {
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          sum += i;
        }

        vi.advanceTimersByTime(50);

        return sum;
      });

      expect(result.result).toBe(4950);
      expect(result.duration).toBe(50);
    });
  });

  describe("withDurationAsync", () => {
    it("should measure duration of async operations", async () => {
      vi.setSystemTime(0);

      const result = await withDurationAsync(async () => {
        vi.advanceTimersByTime(100);

        await Promise.resolve();

        return "async result";
      });

      expect(result.result).toBe("async result");
      expect(result.duration).toBe(100);
    });
  });
});

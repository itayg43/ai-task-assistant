import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withDurationAsync } from "./with-duration";

describe("withDuration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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
      expect(result.durationMs).toBe(100);
    });
  });
});

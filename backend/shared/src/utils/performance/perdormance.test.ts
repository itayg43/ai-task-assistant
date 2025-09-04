import { beforeEach, describe, expect, it, vi } from "vitest";

import { getElapsedDuration } from "./performance";

describe("performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getElapsedDuration", () => {
    const mockStart = 1000;
    const mockPerformanceNowValue = 1050.123;

    beforeEach(() => {
      vi.spyOn(performance, "now").mockReturnValue(mockPerformanceNowValue);
    });

    it("should calculate duration with default options", () => {
      const duration = getElapsedDuration(mockStart);

      expect(duration).toBe(50.12);
    });

    it("should calculate duration with custom options", () => {
      expect(
        getElapsedDuration(mockStart, {
          fractionDigits: 3,
        })
      ).toBe(50.123);
      expect(
        getElapsedDuration(mockStart, {
          unit: "sec",
        })
      ).toBe(0.05);
      expect(
        getElapsedDuration(mockStart, {
          unit: "sec",
          fractionDigits: 4,
        })
      ).toBe(0.0501);
    });

    it("should handle partial options and use defaults for missing values", () => {
      expect(
        getElapsedDuration(mockStart, {
          fractionDigits: 1,
        })
      ).toBe(50.1);
      expect(
        getElapsedDuration(mockStart, {
          unit: "sec",
        })
      ).toBe(0.05);
      expect(getElapsedDuration(mockStart, {})).toBe(50.12);
    });

    it("should ignore undefined values and use defaults", () => {
      expect(
        getElapsedDuration(mockStart, {
          unit: undefined,
          fractionDigits: 3,
        })
      ).toBe(50.123);
      expect(
        getElapsedDuration(mockStart, {
          unit: undefined,
          fractionDigits: undefined,
        })
      ).toBe(50.12);
    });
  });
});

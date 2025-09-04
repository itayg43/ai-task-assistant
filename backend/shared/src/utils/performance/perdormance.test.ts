import { beforeEach, describe, expect, it, vi } from "vitest";

import { getElapsedDuration, getStartTimestamp } from "./performance";

describe("performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getStartTimestamp", () => {
    it("should return a number", () => {
      const timestamp = getStartTimestamp();

      expect(typeof timestamp).toBe("number");
    });

    it("should return a positive number", () => {
      const timestamp = getStartTimestamp();

      expect(timestamp).toBeGreaterThan(0);
    });

    it("should return different values on subsequent calls", () => {
      const timestamp1 = getStartTimestamp();
      const timestamp2 = getStartTimestamp();

      expect(timestamp2).toBeGreaterThan(timestamp1);
    });

    it("should return a finite number", () => {
      const timestamp = getStartTimestamp();

      // Ensure the timestamp is not Infinity, -Infinity, or NaN
      expect(Number.isFinite(timestamp)).toBe(true);
    });
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

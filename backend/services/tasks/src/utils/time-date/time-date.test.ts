import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCurrentDate,
  getCurrentTime,
  getDateISO,
  getElapsedTime,
} from "@utils/time-date";

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

  describe("getCurrentDate", () => {
    it("should return a Date object matching the fake system time", () => {
      const fakeDate = new Date("2023-01-01T12:00:00.000Z");

      vi.setSystemTime(fakeDate);

      const date = getCurrentDate();
      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe(fakeDate.toISOString());
    });
  });

  describe("getDateISO", () => {
    it("should return the ISO string of the current date", () => {
      const fakeDate = new Date("2023-01-01T12:00:00.000Z");

      vi.setSystemTime(fakeDate);

      expect(getDateISO()).toBe(fakeDate.toISOString());
    });
  });
});

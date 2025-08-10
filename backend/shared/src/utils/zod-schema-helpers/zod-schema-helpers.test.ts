import { describe, expect, it } from "vitest";

import { isNonEmptyString, trimString } from "./zod-schema-helpers";

describe("zodSchemaHelpers", () => {
  describe("trimString", () => {
    it("should trim the string correctly", () => {
      const string = "  test string  ";
      const expectedString = "test string";

      expect(trimString(string)).toBe(expectedString);
    });

    it("should not trim in case of a string without white spaces", () => {
      const string = "test string";
      const expectedString = "test string";

      expect(trimString(string)).toBe(expectedString);
    });
  });

  describe("isNonEmptyString", () => {
    it("should return true if the string is not empty", () => {
      const string = "test string";

      expect(isNonEmptyString(string)).toBe(true);
    });

    it("should return false if the string is empty", () => {
      const string = "";

      expect(isNonEmptyString(string)).toBe(false);
    });

    it("should return true for whitespace-only strings (use with transform(trimString) in Zod)", () => {
      const string = "   ";

      expect(isNonEmptyString(string)).toBe(true);
    });
  });
});

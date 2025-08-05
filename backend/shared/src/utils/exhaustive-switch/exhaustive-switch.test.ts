import { describe, it, expect } from "vitest";

import { exhaustiveSwitch } from "./exhaustive-switch";

type MyUnion = "a" | "b" | "c";

describe("exhaustiveSwitch", () => {
  it("should call the correct handler", () => {
    expect(
      exhaustiveSwitch("a" as MyUnion, {
        a: () => 1,
        b: () => 2,
        c: () => 3,
      })
    ).toBe(1);
  });

  it("should throw if an unhandled value is passed", () => {
    expect(() =>
      exhaustiveSwitch("d" as MyUnion, {
        a: () => 1,
        b: () => 2,
        c: () => 3,
      })
    ).toThrow("Unhandled case: d");
  });
});

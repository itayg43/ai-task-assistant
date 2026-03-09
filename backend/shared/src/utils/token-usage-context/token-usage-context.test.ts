import { Response } from "express";
import { describe, expect, it } from "vitest";

import { InternalError } from "../../errors";
import { getTokenUsageContext } from "./token-usage-context";

describe("getTokenUsageContext", () => {
  it("should return tokenUsage when present in res.locals", () => {
    const tokenUsage = {
      reserved: 100,
      windowStart: Date.now(),
    };
    const res = {
      locals: {
        tokenUsage,
      },
    } as unknown as Response;

    const result = getTokenUsageContext(res);

    expect(result).toBe(tokenUsage);
  });

  it("should throw InternalError when res.locals.tokenUsage is undefined", () => {
    const res = {
      locals: {},
    } as unknown as Response;

    expect(() => getTokenUsageContext(res)).toThrow(InternalError);
  });
});

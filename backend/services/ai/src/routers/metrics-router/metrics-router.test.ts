import { describe, expect, it } from "vitest";

import { metricsRouter } from "./metrics-router";
import { metricsRouter as sharedMetricsRouter } from "@shared/routers/metrics-router";

describe("metricsRouter (AI service)", () => {
  it("should export the shared metricsRouter", () => {
    expect(metricsRouter).toBe(sharedMetricsRouter);
  });
});

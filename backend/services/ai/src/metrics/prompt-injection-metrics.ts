import { Counter } from "prom-client";

import { register } from "@clients/prom";

export const promptInjectionBlockedTotal = new Counter({
  name: "prompt_injection_blocked_total",
  help: "Total number of requests blocked due to prompt injection detection",
  labelNames: ["pattern_type"],
  registers: [register],
});

export const recordPromptInjectionBlocked = (patternType: string): void => {
  promptInjectionBlockedTotal.inc({ pattern_type: patternType });
};

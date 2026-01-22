import { Counter, register } from "@shared/clients/prom";
import { createLogger } from "@shared/config/create-logger";

const logger = createLogger("promptInjectionMetrics");

export const promptInjectionBlockedTotal = new Counter({
  name: "prompt_injection_blocked_total",
  help: "Total number of requests blocked due to prompt injection detection",
  labelNames: ["pattern_type"],
  registers: [register],
});

export const recordPromptInjectionBlocked = (patternType: string): void => {
  try {
    promptInjectionBlockedTotal.inc({
      pattern_type: patternType,
    });
    logger.debug("Recorded prompt injection blocked metric", { patternType });
  } catch (error) {
    logger.error("Failed to record prompt injection blocked metric", error, {
      patternType,
    });
  }
};

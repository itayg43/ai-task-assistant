import { CAPABILITY } from "@constants";
import { Counter, register } from "@shared/clients/prom";
import { createLogger } from "@shared/config/create-logger";

const logger = createLogger("parseTaskMetrics");

export const vagueInputTotal = new Counter({
  name: "vague_input_total",
  help: "Total number of requests rejected due to vague input",
  labelNames: ["capability"],
  registers: [register],
});

export const recordVagueInput = () => {
  try {
    vagueInputTotal.inc({
      capability: CAPABILITY.PARSE_TASK,
    });
    logger.debug("Recorded vague input metric for AI service");
  } catch (error) {
    logger.error("Failed to record vague input metric for AI service", error);
  }
};

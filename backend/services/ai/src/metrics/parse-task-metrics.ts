import { CAPABILITY } from "@constants";
import { Counter, register } from "@shared/clients/prom";

export const vagueInputTotal = new Counter({
  name: "vague_input_total",
  help: "Total number of requests rejected due to vague input",
  labelNames: ["capability"],
  registers: [register],
});

export const recordVagueInput = () => {
  vagueInputTotal.inc({
    capability: CAPABILITY.PARSE_TASK,
  });
};

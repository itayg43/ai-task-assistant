import { encodingForModel, TiktokenModel } from "js-tiktoken";

import { createLogger } from "../../config/create-logger";
import { withDurationSync } from "../with-duration";

const logger = createLogger("countTokens");

export const countTokens = (model: TiktokenModel, text: string) => {
  const { result: count, duration } = withDurationSync(() => {
    const encoder = encodingForModel(model);

    return encoder.encode(text).length;
  });

  logger.info("Tokens counted", {
    model,
    text,
    count,
    duration: `${duration}ms`,
  });

  return {
    count,
    duration,
  };
};

export const predefinedTokenCounters = {
  "gpt-4o-mini": (text: string) => countTokens("gpt-4o-mini", text),
} as const;

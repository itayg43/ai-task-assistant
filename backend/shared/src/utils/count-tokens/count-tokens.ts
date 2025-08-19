import { encodingForModel, TiktokenModel } from "js-tiktoken";

import { getCurrentTime, getElapsedTime } from "../date-time";

export const countTokens = (model: TiktokenModel, text: string) => {
  const startTimestamp = getCurrentTime();

  const encoder = encodingForModel(model);
  const count = encoder.encode(text).length;

  const duration = getElapsedTime(startTimestamp);

  return {
    count,
    duration,
  };
};

export const predefinedTokenCounters = {
  "gpt-4o-mini": (text: string) => countTokens("gpt-4o-mini", text),
} as const;

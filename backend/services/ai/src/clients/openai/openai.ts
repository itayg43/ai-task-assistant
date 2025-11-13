import OpenAI from "openai";
import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import { env } from "@config/env";
import { createLogger } from "@shared/config/create-logger";
import { withDurationAsync } from "@shared/utils/with-duration";
import { Capability } from "@types";

const logger = createLogger("openai");

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export const executeParse = async <TOutput>(
  capability: Capability,
  input: string,
  prompt: ResponseCreateParamsNonStreaming,
  requestId: string
) => {
  try {
    logger.info("executeParse - start", {
      requestId,
      capability,
      input,
    });

    const response = await withDurationAsync(() =>
      openai.responses.parse<any, TOutput>(prompt)
    );

    if (!response.result.output_parsed) {
      throw new Error(
        `OpenAI failed to parse output for ${capability} capability`
      );
    }

    const result = {
      openaiResponseId: response.result.id,
      output: response.result.output_parsed,
      usage: {
        tokens: {
          input: response.result.usage?.input_tokens || 0,
          output: response.result.usage?.output_tokens || 0,
        },
      },
      durationMs: response.durationMs,
    };

    logger.info("executeParse - succeeded", {
      requestId,
      capability,
      input,
      result,
    });

    return result;
  } catch (error) {
    logger.error("executeParse - failed", error, {
      requestId,
      capability,
      input,
    });

    throw error;
  }
};

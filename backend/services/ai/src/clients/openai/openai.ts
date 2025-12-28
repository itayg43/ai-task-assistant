import OpenAI from "openai";
import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import { env } from "@config/env";
import { AI_ERROR_TYPE, CAPABILITY_EXECUTION_ERROR_MESSAGE } from "@constants";
import {
  recordOpenAiApiFailureMetrics,
  recordOpenAiApiSuccessMetrics,
} from "@metrics/openai-metrics";
import { createLogger } from "@shared/config/create-logger";
import { DEFAULT_RETRY_CONFIG } from "@shared/constants";
import { InternalError } from "@shared/errors";
import { withDurationAsync } from "@shared/utils/with-duration";
import { withRetry } from "@shared/utils/with-retry";
import { Capability } from "@types";

const logger = createLogger("openai");

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export const executeParse = async <TOutput>(
  capability: Capability,
  operation: string,
  input: string,
  prompt: ResponseCreateParamsNonStreaming,
  promptVersion: string,
  requestId: string
) => {
  const baseLogContext = {
    requestId,
    capability,
    operation,
    input,
    promptVersion,
  };

  let openaiResponseId: string | undefined;

  try {
    logger.info("executeParse - start", baseLogContext);

    const response = await withDurationAsync(async () => {
      return await withRetry(
        DEFAULT_RETRY_CONFIG,
        async () => {
          return await openai.responses.parse<any, TOutput>(prompt);
        },
        baseLogContext
      );
    });

    openaiResponseId = response.result.id;

    if (response.result.status !== "completed") {
      throw new InternalError("OpenAI returned an uncompleted response.");
    }

    if (!response.result.output_parsed) {
      throw new InternalError("OpenAI failed to parse the output correctly.");
    }

    const result = {
      openaiResponseId,
      output: response.result.output_parsed,
      usage: {
        tokens: {
          input: response.result.usage?.input_tokens || 0,
          output: response.result.usage?.output_tokens || 0,
        },
      },
      durationMs: response.durationMs,
    };

    recordOpenAiApiSuccessMetrics(
      capability,
      operation,
      prompt.model,
      response.durationMs,
      result.usage.tokens.input,
      result.usage.tokens.output,
      requestId
    );

    logger.info("executeParse - succeeded", {
      ...baseLogContext,
      result,
    });

    return result;
  } catch (error) {
    recordOpenAiApiFailureMetrics(capability, operation, requestId);

    if (error instanceof OpenAI.APIError) {
      const openaiRequestId = error.requestID;

      logger.error("executeParse - failed", error, {
        ...baseLogContext,
        openaiRequestId,
        openaiErrorMessage: error.error?.message,
        openaiErrorStatusCode: error.status,
      });

      throw new InternalError(CAPABILITY_EXECUTION_ERROR_MESSAGE, {
        openaiRequestId,
        type: AI_ERROR_TYPE.OPENAI_API_ERROR,
      });
    }

    logger.error("executeParse - failed", error, {
      ...baseLogContext,
      openaiResponseId,
    });

    throw new InternalError(CAPABILITY_EXECUTION_ERROR_MESSAGE, {
      openaiResponseId,
    });
  }
};

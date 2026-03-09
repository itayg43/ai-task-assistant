import OpenAI from "openai";
import { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import { parseWithValidation } from "@clients/openai";
import { AI_ERROR_TYPE, CAPABILITY_EXECUTION_ERROR_MESSAGE } from "@constants";
import {
  recordOpenAiApiFailureMetrics,
  recordOpenAiApiSuccessMetrics,
} from "@metrics/openai-metrics";
import { createLogger } from "@shared/config/create-logger";
import { InternalError } from "@shared/errors";
import { withRetry } from "@shared/utils/with-retry";
import { Capability } from "@types";

const logger = createLogger("openaiService");

export const executeParse = async <TOutput>(
  capability: Capability,
  operation: string,
  input: string,
  prompt: ResponseCreateParamsNonStreaming,
  promptVersion: string,
  requestId: string,
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

    const startTime = Date.now();
    const response = await withRetry(
      async () => {
        return await parseWithValidation<TOutput>(prompt, (id) => {
          openaiResponseId = id;
        });
      },
      {
        requestId,
        operation: `executeParse - ${operation}`,
      },
    );

    const result = {
      openaiResponseId: response.id,
      output: response.output_parsed,
      usage: {
        tokens: {
          input: response.usage?.input_tokens || 0,
          output: response.usage?.output_tokens || 0,
        },
      },
      durationMs: Date.now() - startTime,
    };

    logger.info("executeParse - succeeded", {
      ...baseLogContext,
      result,
    });

    recordOpenAiApiSuccessMetrics(
      capability,
      operation,
      prompt.model,
      startTime,
      result.usage.tokens.input,
      result.usage.tokens.output,
      requestId,
    );

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

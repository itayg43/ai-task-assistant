import { StatusCodes } from "http-status-codes";

import { aiClient } from "@clients/ai";
import { PARSE_TASK_VAGUE_INPUT_ERROR } from "@constants";
import { isHttpError } from "@shared/clients/http";
import { createLogger } from "@shared/config/create-logger";
import { DEFAULT_ERROR_MESSAGE } from "@shared/constants";
import { BadRequestError, InternalError } from "@shared/errors";
import { HttpErrorResponseData } from "@shared/types";
import {
  TAiCapability,
  TAiCapabilityResponse,
  TAiErrorData,
  TExecuteCapabilityConfig,
} from "@types";

const logger = createLogger("aiCapabilitiesService");

export const executeCapability = async <
  TCapability extends TAiCapability,
  TCapabilityResult
>(
  requestId: string,
  config: TExecuteCapabilityConfig<TCapability>
): Promise<TAiCapabilityResponse<TCapabilityResult>> => {
  const baseLogContext = {
    requestId,
    config,
  };

  try {
    logger.info("Execute capability - starting", baseLogContext);

    const { data } = await aiClient.post<
      TAiCapabilityResponse<TCapabilityResult>
    >(
      `/capabilities/${config.capability}?pattern=${config.pattern}`,
      config.params
    );

    logger.info("Execute capability - succeeded", {
      ...baseLogContext,
      response: data,
    });

    return data;
  } catch (error) {
    if (isHttpError(error)) {
      const responseStatus = error.response?.status;
      const responseData = error.response?.data as HttpErrorResponseData;

      if (!responseData?.message) {
        logger.error(DEFAULT_ERROR_MESSAGE, error, baseLogContext);

        throw new InternalError(DEFAULT_ERROR_MESSAGE);
      }

      const data = responseData as TAiErrorData;

      logger.error(data.message, error, {
        ...baseLogContext,
        errorData: data,
      });

      if (responseStatus === StatusCodes.BAD_REQUEST) {
        const context =
          data.type === PARSE_TASK_VAGUE_INPUT_ERROR
            ? {
                suggestions: data.suggestions,
              }
            : undefined;

        throw new BadRequestError(data.message, context);
      }

      throw new InternalError(DEFAULT_ERROR_MESSAGE);
    }

    throw error;
  }
};

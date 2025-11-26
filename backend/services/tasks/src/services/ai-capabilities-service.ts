import { StatusCodes } from "http-status-codes";

import { aiClient } from "@clients/ai";
import { isHttpError } from "@shared/clients/http";
import { createLogger } from "@shared/config/create-logger";
import { DEFAULT_ERROR_MESSAGE } from "@shared/constants";
import { BadRequestError, InternalError } from "@shared/errors";
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
      const status = error.response?.status;
      const data = error.response?.data as TAiErrorData | undefined;

      // Handle network errors or cases where response data is missing
      if (!error.response || !data) {
        logger.error(DEFAULT_ERROR_MESSAGE, error, {
          ...baseLogContext,
          httpStatus: status,
        });

        throw new InternalError(DEFAULT_ERROR_MESSAGE);
      }

      logger.error(data.message, error, {
        ...baseLogContext,
        errorData: data,
      });

      if (status === StatusCodes.BAD_REQUEST) {
        const context =
          data.type === "PARSE_TASK_VAGUE_INPUT_ERROR"
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

import { aiClient } from "@clients/ai";
import { createLogger } from "@shared/config/create-logger";
import {
  TAiCapability,
  TAiCapabilityImmediateResponse,
  TExecuteCapabilityConfig,
} from "@types";

const logger = createLogger("aiCapabilitiesService");

export const executeCapability = async <TCapability extends TAiCapability>(
  requestId: string,
  config: TExecuteCapabilityConfig<TCapability>,
): Promise<TAiCapabilityImmediateResponse> => {
  const { capability, callbackUrl, params } = config;

  try {
    const { data } = await aiClient.post<TAiCapabilityImmediateResponse>(
      `/capabilities/${capability}?callbackUrl=${callbackUrl}`,
      params,
    );

    logger.info(`Successfully called execute ${capability} capability`, {
      requestId,
      config,
      data,
    });

    return data;
  } catch (error) {
    logger.error(`Failed to execute ${capability} capability`, error, {
      requestId,
      config,
    });

    throw error;
  }
};

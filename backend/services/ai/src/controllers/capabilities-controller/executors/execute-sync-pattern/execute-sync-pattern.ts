import { DEFAULT_RETRY_CONFIG } from "@shared/constants";
import { withDurationAsync } from "@shared/utils/with-duration";
import { withRetry } from "@shared/utils/with-retry";
import { CapabilityConfig } from "@types";

export const executeSyncPattern = async <TInput, TOutput>(
  config: CapabilityConfig<TInput, TOutput>,
  input: TInput
) => {
  const { result, durationMs } = await withDurationAsync(async () => {
    return await withRetry(DEFAULT_RETRY_CONFIG, () => config.handler(input));
  });

  return {
    result,
    durationMs,
  };
};

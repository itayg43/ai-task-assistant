import { DEFAULT_RETRY_CONFIG } from "@shared/constants";
import { withDurationAsync } from "@shared/utils/with-duration";
import { withRetry } from "@shared/utils/with-retry";
import { CapabilityConfig } from "@types";

export const executeSyncPattern = async <TInput, TOutput>(
  config: CapabilityConfig<TInput, TOutput>,
  input: TInput,
  requestId: string
) => {
  const { result, durationMs } = await withDurationAsync(async () => {
    return await withRetry(DEFAULT_RETRY_CONFIG, () =>
      config.handler(input, requestId)
    );
  });

  const parsedResult = config.outputSchema.safeParse(result);

  if (!parsedResult.success) {
    throw new Error(
      `Capability ${config.name} returned invalid output: ${parsedResult.error.message}`
    );
  }

  return {
    result: parsedResult.data,
    durationMs,
  };
};

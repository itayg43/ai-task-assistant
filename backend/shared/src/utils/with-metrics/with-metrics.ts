import { WithMetricsOptions } from "../../types";
import { withDurationAsync } from "../with-duration";

export const withMetrics = async <TOperation extends string, TReturn>(
  options: WithMetricsOptions<TOperation>,
  fn: () => Promise<TReturn>,
): Promise<TReturn> => {
  const { operation, requestId, onRecordSuccess, onRecordFailure } = options;

  try {
    const { result, durationMs } = await withDurationAsync(fn);
    onRecordSuccess(operation, durationMs, requestId);
    return result;
  } catch (error) {
    onRecordFailure(operation, requestId);
    throw error;
  }
};

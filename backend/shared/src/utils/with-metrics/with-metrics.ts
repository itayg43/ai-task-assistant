import { WithMetricsOptions } from "../../types";
import { withDurationAsync } from "../with-duration";

export const withMetrics = async <TReturn>(
  options: WithMetricsOptions,
  fn: () => Promise<TReturn>,
): Promise<TReturn> => {
  try {
    const { result, durationMs } = await withDurationAsync(fn);
    options.onRecordSuccess(options.operation, durationMs, options.requestId);
    return result;
  } catch (error) {
    options.onRecordFailure(options.operation, options.requestId);
    throw error;
  }
};

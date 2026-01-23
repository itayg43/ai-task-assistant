import { WithMetricsOptions } from "../../types";
import { withDurationAsync } from "../with-duration";

export const withMetrics = async <TOperation extends string, TReturn>(
  options: WithMetricsOptions<TOperation>,
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

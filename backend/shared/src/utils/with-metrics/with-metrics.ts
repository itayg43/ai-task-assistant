import { WithMetricsOptions } from "../../types";

export const withMetrics = async <TOperation extends string, TReturn>(
  options: WithMetricsOptions<TOperation>,
  fn: () => Promise<TReturn>,
): Promise<TReturn> => {
  const { operation, requestId, onRecordSuccess, onRecordFailure } = options;

  try {
    const startTime = Date.now();
    const result = await fn();
    onRecordSuccess(operation, startTime, requestId);
    return result;
  } catch (error) {
    onRecordFailure(operation, requestId);
    throw error;
  }
};

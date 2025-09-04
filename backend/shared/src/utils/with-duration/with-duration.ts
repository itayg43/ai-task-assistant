import { WithDurationResult } from "../../types";
import { getElapsedDuration, getStartTimestamp } from "../performance";

export const withDurationAsync = async <T>(
  fn: () => Promise<T>
): Promise<WithDurationResult<T>> => {
  const start = getStartTimestamp();
  const result = await fn();
  const duration = getElapsedDuration(start);

  return {
    result,
    durationMs: duration,
  };
};

export const withDurationSync = <T>(fn: () => T): WithDurationResult<T> => {
  const start = getStartTimestamp();
  const result = fn();
  const duration = getElapsedDuration(start);

  return {
    result,
    durationMs: duration,
  };
};

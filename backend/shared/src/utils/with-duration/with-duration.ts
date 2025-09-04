import { WithDurationResult } from "../../types";

export const withDurationAsync = async <T>(
  fn: () => Promise<T>
): Promise<WithDurationResult<T>> => {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  return {
    result,
    durationMs: duration,
  };
};

export const withDurationSync = <T>(fn: () => T): WithDurationResult<T> => {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;

  return {
    result,
    durationMs: duration,
  };
};

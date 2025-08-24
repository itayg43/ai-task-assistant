import { WithDurationResult } from "../../types";
import { getCurrentTime, getElapsedTime } from "../date-time";

export const withDurationAsync = async <T>(
  fn: () => Promise<T>
): Promise<WithDurationResult<T>> => {
  const startTimestamp = getCurrentTime();
  const result = await fn();
  const duration = getElapsedTime(startTimestamp);

  return {
    result,
    duration,
  };
};

export const withDurationSync = <T>(fn: () => T): WithDurationResult<T> => {
  const startTimestamp = getCurrentTime();
  const result = fn();
  const duration = getElapsedTime(startTimestamp);

  return {
    result,
    duration,
  };
};

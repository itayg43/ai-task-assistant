import {
  DEFAULT_GET_ELAPSED_DURATION_OPTIONS,
  MS_PER_SECOND,
} from "../../constants";
import { GetElapsedDurationOptions } from "../../types";

export const getStartTimestamp = () => {
  return performance.now();
};

export const getElapsedDuration = (
  start: number,
  options: Partial<GetElapsedDurationOptions> = {}
) => {
  const {
    unit = DEFAULT_GET_ELAPSED_DURATION_OPTIONS.unit,
    fractionDigits = DEFAULT_GET_ELAPSED_DURATION_OPTIONS.fractionDigits,
  } = options;

  let duration = getStartTimestamp() - start;

  if (unit === "sec") {
    duration /= MS_PER_SECOND;
  }

  return parseFloat(duration.toFixed(fractionDigits));
};

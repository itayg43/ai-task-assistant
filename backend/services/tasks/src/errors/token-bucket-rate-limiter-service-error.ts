import { StatusCodes } from "http-status-codes";

import { BaseError } from "./base-error";

export class TokenBucketRateLimiterServiceError extends BaseError {
  constructor(message: string) {
    super(message, StatusCodes.SERVICE_UNAVAILABLE);
  }
}

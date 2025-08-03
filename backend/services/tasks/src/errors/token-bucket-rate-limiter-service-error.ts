import { StatusCodes } from "http-status-codes";

import { BaseError } from "./base-error";

export class TokenBucketRateLimiterServiceError extends BaseError {
  constructor() {
    super(
      "Unexpected error occurred, please try again later.",
      StatusCodes.SERVICE_UNAVAILABLE
    );
  }
}

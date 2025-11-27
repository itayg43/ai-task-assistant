import { StatusCodes } from "http-status-codes";

import { BaseError } from "./base-error";

export class TooManyRequestsError extends BaseError {
  constructor() {
    super("Rate limit exceeded, please try again later.", StatusCodes.TOO_MANY_REQUESTS);
  }
}


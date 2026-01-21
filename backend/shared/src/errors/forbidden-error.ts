import { StatusCodes, getReasonPhrase } from "http-status-codes";

import { BaseError } from "./base-error";

export class ForbiddenError extends BaseError {
  constructor(message: string = getReasonPhrase(StatusCodes.FORBIDDEN)) {
    super(message, StatusCodes.FORBIDDEN);
  }
}

import { StatusCodes } from "http-status-codes";

import { BaseError } from "./base-error";

export class BadRequestError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, StatusCodes.BAD_REQUEST, context);
  }
}

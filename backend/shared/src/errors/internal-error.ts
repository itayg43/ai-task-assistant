import { StatusCodes } from "http-status-codes";

import { BaseError } from "./base-error";

export class InternalError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR, context);
  }
}

import { StatusCodes } from "http-status-codes";

import { DEFAULT_ERROR_MESSAGE } from "../constants";
import { BaseError } from "./base-error";

export class InternalError extends BaseError {
  constructor(message?: string, context?: Record<string, unknown>) {
    super(
      message || DEFAULT_ERROR_MESSAGE,
      StatusCodes.INTERNAL_SERVER_ERROR,
      context
    );
  }
}

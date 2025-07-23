import { StatusCodes } from "http-status-codes";

import { BaseError } from "./base-error";

export class AuthenticationError extends BaseError {
  constructor(message: string) {
    super(message, StatusCodes.UNAUTHORIZED);
  }
}

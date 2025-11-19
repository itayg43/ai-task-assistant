export class BaseError extends Error {
  statusCode: number;
  context?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    context?: Record<string, unknown>
  ) {
    super(message);

    this.statusCode = statusCode;
    this.context = context;
  }
}

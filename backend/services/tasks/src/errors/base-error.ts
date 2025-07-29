export class BaseError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);

    this.statusCode = statusCode;

    // Ensures the prototype chain is set correctly when extending built-in classes.
    // Allows instanceof checks and inheritance to work as expected.
    Object.setPrototypeOf(this, BaseError.prototype);
  }
}

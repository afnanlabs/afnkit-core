/**
 * An error carrying an HTTP status code.
 *
 * Throwing or forwarding an `HttpError` through `next(err)` produces a response
 * with the corresponding status code. `expose` controls whether the message is
 * shown to the client (4xx) or replaced with a generic message (5xx).
 */
export class HttpError extends Error {
  public readonly status: number;
  public readonly statusCode: number;
  public readonly expose: boolean;

  public constructor(status: number, message?: string) {
    super(message ?? defaultMessage(status));
    this.name = "HttpError";
    this.status = status;
    this.statusCode = status;
    this.expose = status < 500;
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

function defaultMessage(status: number): string {
  switch (status) {
    case 400:
      return "Bad Request";
    case 401:
      return "Unauthorized";
    case 403:
      return "Forbidden";
    case 404:
      return "Not Found";
    case 405:
      return "Method Not Allowed";
    case 500:
      return "Internal Server Error";
    default:
      return `Error ${status}`;
  }
}

import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Advances to the next handler in the current stack.
 *
 * Calling `next()` with no argument continues normal processing. Calling it with
 * an argument (`next(err)`) short-circuits to error handling.
 */
export type NextFunction = (err?: unknown) => void;

/**
 * The request object. At runtime it is Node's `IncomingMessage` whose prototype
 * chain is extended by `app.request` (see `src/request/request.ts`).
 */
export interface Request extends IncomingMessage {
  /** Pathname parsed from `req.url` (set by the router). */
  path?: string;
  /** Route parameters (reserved for future path-pattern support). */
  params?: Record<string, string>;
  /** The application that is handling this request. */
  app?: unknown;
}

/**
 * The response object. At runtime it is Node's `ServerResponse` whose prototype
 * chain is extended by `app.response` (see `src/response/response.ts`).
 *
 * `status`, `send` and `json` are provided by the response prototype that the
 * `expressInit` middleware attaches in Chapter 4/5.
 */
export interface Response extends ServerResponse {
  /** The application that is handling this request. */
  app?: unknown;
  /** Set the HTTP status code and return the response for chaining. */
  status(code: number): Response;
  /** Serialize and send a body (string, Buffer, object, number, boolean, null). */
  send(body?: unknown): Response;
  /** Serialize and send a body as JSON. */
  json(body?: unknown): Response;
}

/** A route handler or middleware. */
export type Handler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;

/** An error-handling middleware, identified by its four-argument signature. */
export type ErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;

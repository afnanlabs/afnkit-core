import type {
  ErrorHandler,
  Handler,
  NextFunction,
  Request,
  Response,
} from "../types";
import type { Route } from "./route";

/**
 * A `Layer` wraps a single handler with the metadata the router needs to decide
 * whether it applies to a request.
 *
 * - Route layers carry a `route` and match by path (the method is checked by
 *   the router/route).
 * - Middleware layers have no `route` and match every path.
 *
 * A layer whose handler declares four parameters is treated as an error handler.
 */
export class Layer {
  public readonly path: string;
  public readonly handle: Handler | ErrorHandler;
  public readonly name: string;
  public readonly isErrorHandler: boolean;
  /** HTTP method this layer was registered for (undefined for `all`). */
  public method?: string;
  /** The route this layer dispatches to (undefined for middleware). */
  public route?: Route;

  public constructor(path: string, fn: Handler | ErrorHandler) {
    this.path = path;
    this.handle = fn;
    this.name = fn.name || "<anonymous>";
    this.isErrorHandler = fn.length === 4;
  }

  public match(path: string): boolean {
    if (this.route) {
      return this.route.path === path;
    }
    return true;
  }

  /**
   * Run the (non-error) handler. Synchronous throws and rejected promises are
   * both forwarded to `next(err)` so error handling is uniform (fixes D7).
   */
  public handleRequest(req: Request, res: Response, next: NextFunction): void {
    const fn = this.handle as Handler;

    try {
      const result: unknown = fn(req, res, next);
      forwardRejection(result, next);
    } catch (err) {
      next(err);
    }
  }

  /** Run an error handler. */
  public handleError(
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const fn = this.handle as ErrorHandler;

    try {
      const result: unknown = fn(err, req, res, next);
      forwardRejection(result, next);
    } catch (nextErr) {
      next(nextErr);
    }
  }
}

/** If a handler returned a promise, forward its rejection to `next`. */
function forwardRejection(result: unknown, next: NextFunction): void {
  if (
    result !== null &&
    typeof result === "object" &&
    typeof (result as PromiseLike<unknown>).then === "function"
  ) {
    (result as Promise<unknown>).catch(next);
  }
}

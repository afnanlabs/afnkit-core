import { Layer } from "./layer";
import type {
  ErrorHandler,
  Handler,
  NextFunction,
  Request,
  Response,
} from "../types";

type AnyHandler = Handler | ErrorHandler;

/**
 * A `Route` collects the handlers registered for a single path.
 *
 * `dispatch` is used as the route layer's handle. It advances **one handler per
 * `next()` call**, which is what makes `next` gating correct (fixes D3): a
 * handler that ends the response without calling `next` stops the route.
 */
export class Route {
  public readonly path: string;
  public readonly stack: Layer[] = [];
  public readonly methods: Record<string, boolean> = {};

  public constructor(path: string) {
    this.path = path;
  }

  public addHandler(method: string, handlers: AnyHandler[]): this {
    const normalized = method.toLowerCase();

    for (const handle of handlers) {
      if (typeof handle !== "function") {
        throw new TypeError(
          `Route.${normalized}() requires a callback function but got a ${typeof handle}`,
        );
      }

      const layer = new Layer("/", handle);
      layer.method = normalized;

      this.methods[normalized] = true;
      this.stack.push(layer);
    }

    return this;
  }

  public all(handlers: AnyHandler[]): this {
    for (const handle of handlers) {
      if (typeof handle !== "function") {
        throw new TypeError(
          `Route.all() requires a callback function but got a ${typeof handle}`,
        );
      }

      const layer = new Layer("/", handle);
      this.methods["_all"] = true;
      this.stack.push(layer);
    }

    return this;
  }

  /** Whether this route has a handler for the given (lower-case) method. */
  public hasMethod(method: string): boolean {
    return this.methods[method] === true || this.methods["_all"] === true;
  }

  public dispatch(req: Request, res: Response, done: NextFunction): void {
    const stack = this.stack;
    const method = (req.method ?? "GET").toLowerCase();

    if (!this.hasMethod(method)) {
      done();
      return;
    }

    let idx = 0;

    const next: NextFunction = (err?: unknown) => {
      if (res.writableEnded) {
        return;
      }

      const hasError = err !== undefined && err !== null;

      while (idx < stack.length) {
        const layer = stack[idx++];
        if (layer === undefined) {
          continue;
        }

        if (hasError) {
          if (layer.isErrorHandler) {
            layer.handleError(err, req, res, next);
            return;
          }
          continue;
        }

        if (layer.isErrorHandler) {
          continue;
        }

        // `all` handlers have no method and always run.
        if (layer.method !== undefined && layer.method !== method) {
          continue;
        }

        layer.handleRequest(req, res, next);
        return;
      }

      done(err);
    };

    next();
  }
}

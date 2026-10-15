import { Layer } from "./layer";
import { Route } from "./route";
import { finalHandler } from "../errors/final-handler";
import { HttpError } from "../errors/http-error";
import type {
  ErrorHandler,
  Handler,
  NextFunction,
  Request,
  Response,
} from "../types";

/** Extract the pathname from a raw request URL, ignoring the query string. */
export function getPathname(req: Request): string {
  const raw = req.url ?? "/";
  const queryIndex = raw.indexOf("?");
  const pathname = queryIndex === -1 ? raw : raw.slice(0, queryIndex);
  return pathname.length > 0 ? pathname : "/";
}

/**
 * The router owns the ordered stack of layers for one application.
 *
 * Dispatch is driven by a single `next` closure over the stack index. Each call
 * advances to the next matching layer, which is what implements `next`:
 * - `next()` continues normal processing;
 * - `next(err)` skips to the next error handler;
 * - when the stack is exhausted, `done` (or `finalHandler`) produces a response.
 *
 * Dispatch stops early if the response has already ended, so a handler can never
 * run after the response is finished.
 */
export class Router {
  public readonly stack: Layer[] = [];

  public route(path: string): Route {
    const route = new Route(path);
    const layer = new Layer(path, route.dispatch.bind(route));

    layer.route = route;
    this.stack.push(layer);

    return route;
  }

  /**
   * Register middleware. Middleware layers have no route, so they match every
   * path and are invoked in registration order.
   */
  public use(middleware: Handler | ErrorHandler): this {
    if (typeof middleware !== "function") {
      throw new TypeError("app.use() requires a middleware function");
    }

    const layer = new Layer("/", middleware);
    this.stack.push(layer);

    return this;
  }

  public handle(req: Request, res: Response, out?: NextFunction): void {
    const stack = this.stack;
    const path = getPathname(req);
    req.path = path;

    const method = (req.method ?? "GET").toLowerCase();
    const allowedMethods = new Set<string>();
    const done: NextFunction = out ?? ((err?: unknown) => finalHandler(req, res, err));

    let idx = 0;

    const next: NextFunction = (err?: unknown) => {
      if (res.writableEnded) {
        return;
      }

      const hasError = err !== undefined && err !== null;

      while (idx < stack.length) {
        const layer = stack[idx++];
        if (layer === undefined || !layer.match(path)) {
          continue;
        }

        if (hasError) {
          if (layer.isErrorHandler) {
            layer.handleError(err, req, res, next);
            return;
          }
          continue;
        }

        // Skip error handlers during normal processing.
        if (layer.isErrorHandler) {
          continue;
        }

        // A route whose path matches but whose method does not is remembered so
        // the terminal response can be 405 rather than 404.
        const route = layer.route;
        if (route !== undefined && !route.hasMethod(method)) {
          for (const registered of Object.keys(route.methods)) {
            if (registered !== "_all") {
              allowedMethods.add(registered.toUpperCase());
            }
          }
          continue;
        }

        layer.handleRequest(req, res, next);
        return;
      }

      if (hasError) {
        done(err);
        return;
      }

      if (allowedMethods.size > 0) {
        res.setHeader("Allow", Array.from(allowedMethods).join(", "));
        finalHandler(req, res, new HttpError(405));
        return;
      }

      done();
    };

    next();
  }
}

import type { Application } from "../application/application";
import type { Handler, NextFunction, Request, Response } from "../types";

/**
 * `expressInit` is installed as the first middleware on every application.
 *
 * For each request it points `req` and `res` at the application's request and
 * response prototypes, so `res.send` / `res.json` and any other extensions are
 * available to every handler. It is installed exactly once, when the router is
 * created (fixes D6, where the reference re-installed it on every route).
 */
export function init(app: Application): Handler {
  return function expressInit(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    Object.setPrototypeOf(req, app.request);
    Object.setPrototypeOf(res, app.response);
    next();
  };
}

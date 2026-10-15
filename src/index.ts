import { createApplication } from "./application/application";
import type { Application } from "./application/application";

export { Application, createApplication } from "./application/application";
export { Router } from "./router/router";
export { getPathname } from "./router/router";
export { Route } from "./router/route";
export { Layer } from "./router/layer";
export { HttpError } from "./errors/http-error";
export { finalHandler } from "./errors/final-handler";
export type {
  ErrorHandler,
  Handler,
  NextFunction,
  Request,
  Response,
} from "./types";

/**
 * Create a new application.
 *
 * This mirrors Express's `express()` factory: it returns a fresh application
 * with its own router and settings.
 */
export function express(): Application {
  return createApplication();
}

export default express;

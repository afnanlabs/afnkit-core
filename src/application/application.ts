import * as http from "node:http";
import { Router } from "../router/router";
import { init } from "../middleware/init";
import { createRequestPrototype } from "../request/request";
import { createResponsePrototype } from "../response/response";
import type {
  ErrorHandler,
  Handler,
  NextFunction,
  Request,
  Response,
} from "../types";

/**
 * The application object. It owns settings, a single router, and the
 * `listen`/`handle` entry points.
 *
 * Chapter 1 establishes the registration API (`app.get`, `app.post`, ...).
 */
export class Application {
  public settings!: Record<string, unknown>;
  public cache!: Record<string, unknown>;
  public engines!: Record<string, unknown>;
  /** Prototype applied to every incoming request (see `expressInit`). */
  public request!: Request;
  /** Prototype applied to every outgoing response (see `expressInit`). */
  public response!: Response;

  private _router?: Router;

  public constructor() {
    this.init();
  }

  public init(): void {
    this.settings = {};
    this.cache = {};
    this.engines = {};
    this._router = undefined;
  }

  public set(setting: string, value: unknown): this {
    this.settings[setting] = value;
    return this;
  }

  public enabled(setting: string): boolean {
    return Boolean(this.settings[setting]);
  }

  public disabled(setting: string): boolean {
    return !this.enabled(setting);
  }

  public lazyrouter(): Router {
    if (!this._router) {
      this._router = new Router();
      this._router.use(init(this));
    }
    return this._router;
  }

  /** Register a middleware function. */
  public use(middleware: Handler): this;
  public use(middleware: ErrorHandler): this;
  public use(middleware: Handler | ErrorHandler): this {
    this.lazyrouter().use(middleware);
    return this;
  }

  public handle(req: Request, res: Response, out?: NextFunction): void {
    const router = this.lazyrouter();
    router.handle(req, res, out);
  }

  public listen(
    port: number,
    hostOrListener?: string | (() => void),
    listeningListener?: () => void,
  ): http.Server {
    const server = http.createServer((req, res) => {
      this.handle(req as Request, res as Response);
    });

    const host = typeof hostOrListener === "string" ? hostOrListener : undefined;
    const listener =
      typeof hostOrListener === "function" ? hostOrListener : listeningListener;

    if (host !== undefined && listener !== undefined) {
      server.listen(port, host, listener);
    } else if (host !== undefined) {
      server.listen(port, host);
    } else if (listener !== undefined) {
      server.listen(port, listener);
    } else {
      server.listen(port);
    }

    return server;
  }

  public get(path: string, ...handlers: Handler[]): this {
    return this.register("get", path, handlers);
  }

  public post(path: string, ...handlers: Handler[]): this {
    return this.register("post", path, handlers);
  }

  public put(path: string, ...handlers: Handler[]): this {
    return this.register("put", path, handlers);
  }

  public delete(path: string, ...handlers: Handler[]): this {
    return this.register("delete", path, handlers);
  }

  public patch(path: string, ...handlers: Handler[]): this {
    return this.register("patch", path, handlers);
  }

  public options(path: string, ...handlers: Handler[]): this {
    return this.register("options", path, handlers);
  }

  public head(path: string, ...handlers: Handler[]): this {
    return this.register("head", path, handlers);
  }

  public connect(path: string, ...handlers: Handler[]): this {
    return this.register("connect", path, handlers);
  }

  public trace(path: string, ...handlers: Handler[]): this {
    return this.register("trace", path, handlers);
  }

  public all(path: string, ...handlers: Handler[]): this {
    const route = this.lazyrouter().route(path);
    route.all(handlers);
    return this;
  }

  private register(method: string, path: string, handlers: Handler[]): this {
    const route = this.lazyrouter().route(path);
    route.addHandler(method, handlers);
    return this;
  }
}

/**
 * Create a new application with its request/response prototypes wired up.
 *
 * This is the function behind `express()`: it builds the application and
 * attaches the shared request and response prototypes that `expressInit`
 * applies to each request.
 */
export function createApplication(): Application {
  const app = new Application();
  app.request = createRequestPrototype(app);
  app.response = createResponsePrototype(app);
  return app;
}

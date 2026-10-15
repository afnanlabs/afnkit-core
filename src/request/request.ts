import { IncomingMessage } from "node:http";
import type { Application } from "../application/application";
import type { Request } from "../types";

/**
 * Build the request prototype (`app.request`).
 *
 * The `expressInit` middleware points each incoming request's prototype at this
 * object, so request extensions added here are shared by every request. Node's
 * own `IncomingMessage` methods remain available through the prototype chain.
 */
export function createRequestPrototype(app: Application): Request {
  const proto = Object.create(IncomingMessage.prototype) as Request;

  Object.defineProperty(proto, "app", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: app,
  });

  return proto;
}

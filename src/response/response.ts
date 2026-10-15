import { ServerResponse } from "node:http";
import type { Application } from "../application/application";
import type { Response } from "../types";

/**
 * Build the response prototype (`app.response`).
 *
 * The `expressInit` middleware points each incoming response's prototype at
 * this object, so the extensions defined here (`status`, `send`, `json`) are
 * shared by every response while Node's `ServerResponse` methods stay available
 * through the prototype chain.
 */
export function createResponsePrototype(app: Application): Response {
  const proto = Object.create(ServerResponse.prototype) as Response;

  Object.defineProperty(proto, "app", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: app,
  });

  proto.status = function status(this: Response, code: number): Response {
    this.statusCode = code;
    return this;
  };

  proto.send = function send(this: Response, body?: unknown): Response {
    return sendBody(this, body);
  };

  proto.json = function json(this: Response, body?: unknown): Response {
    return sendJson(this, body);
  };

  return proto;
}

/**
 * Send a body, choosing a content type per value kind:
 *
 * - `null` / `undefined` → empty body (`text/html`);
 * - `Buffer` → `application/octet-stream`;
 * - `string` → `text/html`;
 * - plain object / array → JSON (`application/json`);
 * - number / boolean / bigint → string form.
 *
 * A content type set by the caller (for example by `json`) is preserved, which
 * is the fix for D4.
 */
function sendBody(res: Response, body?: unknown): Response {
  let chunk: string | Buffer;

  if (body === null || body === undefined) {
    if (!res.getHeader("Content-Type")) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
    }
    chunk = "";
  } else if (Buffer.isBuffer(body)) {
    if (!res.getHeader("Content-Type")) {
      res.setHeader("Content-Type", "application/octet-stream");
    }
    chunk = body;
  } else if (typeof body === "string") {
    if (!res.getHeader("Content-Type")) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
    }
    chunk = body;
  } else if (typeof body === "object") {
    return sendJson(res, body);
  } else {
    if (!res.getHeader("Content-Type")) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
    }
    chunk = String(body);
  }

  if (!res.getHeader("Content-Length")) {
    res.setHeader("Content-Length", String(Buffer.byteLength(chunk)));
  }

  // Answer HEAD requests with headers only.
  if (res.req && res.req.method === "HEAD") {
    res.end();
  } else {
    res.end(chunk);
  }

  return res;
}

/**
 * Send a JSON body. The `application/json` content type is set here and is not
 * overwritten by `send`, fixing the reference's `text/plain` JSON (D4).
 */
function sendJson(res: Response, body?: unknown): Response {
  if (!res.getHeader("Content-Type")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }

  const encoded = JSON.stringify(body === undefined ? null : body);
  return sendBody(res, encoded);
}

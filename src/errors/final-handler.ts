import { HttpError } from "./http-error";
import type { Request, Response } from "../types";

/**
 * The terminal handler. It guarantees that every request receives a response:
 * `404 Not Found` when nothing matched, or the status carried by the error when
 * `next(err)` reached the end of the stack.
 */
export function finalHandler(req: Request, res: Response, err?: unknown): void {
  if (res.writableEnded) {
    return;
  }

  // If a handler already flushed headers, we can only end the response; setting
  // headers here would throw. This keeps the terminal handler from ever throwing.
  if (res.headersSent) {
    res.end();
    return;
  }

  let status = 404;
  let message = "Not Found";

  if (err !== undefined && err !== null) {
    if (err instanceof HttpError) {
      status = err.status;
      message = err.expose ? err.message : "Internal Server Error";
      if (!err.expose) {
        console.error(err);
      }
    } else {
      status = 500;
      message = "Internal Server Error";
      console.error(err);
    }
  }

  const body = `${status} ${message}`;

  res.statusCode = status;
  if (!res.getHeader("Content-Type")) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
  }
  res.setHeader("Content-Length", String(Buffer.byteLength(body)));

  if (req.method === "HEAD") {
    res.end();
  } else {
    res.end(body);
  }
}

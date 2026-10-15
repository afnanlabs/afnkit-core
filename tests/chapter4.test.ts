import assert from "node:assert/strict";
import test from "node:test";
import { express, HttpError } from "../src/index";
import type { NextFunction, Request, Response } from "../src/types";
import { listenOnEphemeralPort } from "./helpers/http";

test("middleware runs in registration order before route handlers", async (t) => {
  const order: string[] = [];

  const app = express();
  app.use((_req, _res, next) => {
    order.push("m1");
    next();
  });
  app.use((_req, _res, next) => {
    order.push("m2");
    next();
  });
  app.get("/", (_req, res) => {
    order.push("handler");
    res.end("ok");
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  await fetch(`${server.url}/`);
  assert.deepEqual(order, ["m1", "m2", "handler"]);
});

test("expressInit attaches the extended response prototype", async (t) => {
  const app = express();

  const extended = app.response as Response & { stamp(): string };
  extended.stamp = () => "stamped";

  app.get("/", (_req, res) => {
    res.end((res as Response & { stamp(): string }).stamp());
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  assert.equal(await (await fetch(`${server.url}/`)).text(), "stamped");
});

test("the response exposes a link back to the application", async (t) => {
  const app = express();

  app.get("/who", (_req, res) => {
    res.end((res.app as object) === app ? "linked" : "other");
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  assert.equal(await (await fetch(`${server.url}/who`)).text(), "linked");
});

test("expressInit is installed exactly once, not per route (D6)", () => {
  const app = express();
  app.get("/a", () => {});
  app.get("/b", () => {});
  app.post("/c", () => {});

  const initLayers = app.lazyrouter().stack.filter((layer) => layer.name === "expressInit");
  assert.equal(initLayers.length, 1);
});

test("app.handle works before any route is registered (D9)", async (t) => {
  const app = express();
  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  const res = await fetch(`${server.url}/anything`);
  assert.equal(res.status, 404);
});

test("error-handling middleware receives next(err)", async (t) => {
  const app = express();

  app.get("/explode", (_req, _res, next) => {
    next(new HttpError(418, "I'm a teapot"));
  });
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof HttpError) {
      res.statusCode = err.status;
      res.end(err.message);
      return;
    }
    next(err);
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  const res = await fetch(`${server.url}/explode`);
  assert.equal(res.status, 418);
  assert.equal(await res.text(), "I'm a teapot");
});

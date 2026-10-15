import assert from "node:assert/strict";
import test from "node:test";
import { express } from "../src/index";
import { listenOnEphemeralPort } from "./helpers/http";

test("next runs the remaining handlers of a route in order", async (t) => {
  const app = express();
  app.get(
    "/chain",
    (_req, res, next) => {
      res.setHeader("X-Step", "one");
      next();
    },
    (_req, res) => {
      res.setHeader("X-Step-2", "two");
      res.end("done");
    },
  );

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  const res = await fetch(`${server.url}/chain`);
  assert.equal(await res.text(), "done");
  assert.equal(res.headers.get("x-step"), "one");
  assert.equal(res.headers.get("x-step-2"), "two");
});

test("next continues to a later layer registered for the same path", async (t) => {
  const app = express();
  app.get("/same", (_req, _res, next) => {
    next();
  });
  app.get("/same", (_req, res) => {
    res.end("second route");
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  assert.equal(await (await fetch(`${server.url}/same`)).text(), "second route");
});

test("a handler that ends the response without next stops the route (D3)", async (t) => {
  let secondRan = false;

  const app = express();
  app.get(
    "/gate",
    (_req, res) => {
      res.end("first");
    },
    () => {
      secondRan = true;
    },
  );

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  assert.equal(await (await fetch(`${server.url}/gate`)).text(), "first");
  assert.equal(secondRan, false, "handlers after a finished response must not run");
});

test("calling next after the response ended does not run more handlers (D3)", async (t) => {
  let afterEnd = false;

  const app = express();
  app.get(
    "/late",
    (_req, res, next) => {
      res.end("early");
      next();
    },
    () => {
      afterEnd = true;
    },
  );

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  assert.equal(await (await fetch(`${server.url}/late`)).text(), "early");
  assert.equal(afterEnd, false);
});

test("next(err) reaches the terminal 500 handler (D7 sync)", async (t) => {
  const app = express();
  app.get("/boom", (_req, _res, next) => {
    next(new Error("kaboom"));
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  const res = await fetch(`${server.url}/boom`);
  assert.equal(res.status, 500);
});

test("a rejected async handler reaches the terminal 500 handler (D7 async)", async (t) => {
  const app = express();
  app.get("/async-boom", async () => {
    throw new Error("async kaboom");
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  const res = await fetch(`${server.url}/async-boom`);
  assert.equal(res.status, 500);
});

import assert from "node:assert/strict";
import test from "node:test";
import { express } from "../src/index";
import { listenOnEphemeralPort } from "./helpers/http";

test("routes are matched by pathname", async (t) => {
  const app = express();
  app.get("/", (_req, res) => {
    res.end("root");
  });
  app.get("/two", (_req, res) => {
    res.end("two");
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  assert.equal(await (await fetch(`${server.url}/`)).text(), "root");
  assert.equal(await (await fetch(`${server.url}/two`)).text(), "two");
});

test("the query string does not affect matching", async (t) => {
  const app = express();
  app.get("/two", (_req, res) => {
    res.end("two");
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  assert.equal(await (await fetch(`${server.url}/two?x=1&y=2`)).text(), "two");
});

test("handlers only run for their registered method (D1)", async (t) => {
  const app = express();
  app.get("/resource", (_req, res) => {
    res.end("get handler");
  });
  app.post("/resource", (_req, res) => {
    res.end("post handler");
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  const getRes = await fetch(`${server.url}/resource`);
  assert.equal(getRes.status, 200);
  assert.equal(await getRes.text(), "get handler");

  const postRes = await fetch(`${server.url}/resource`, { method: "POST" });
  assert.equal(postRes.status, 200);
  assert.equal(await postRes.text(), "post handler");
});

test("a path that exists without the method returns 405 (D1)", async (t) => {
  const app = express();
  app.get("/only-get", (_req, res) => {
    res.end("get handler");
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  const res = await fetch(`${server.url}/only-get`, { method: "POST" });

  assert.equal(res.status, 405);
  assert.equal(res.headers.get("allow"), "GET");
  assert.notEqual(await res.text(), "get handler");
});

test("unknown paths return 404 rather than hanging (D2)", async (t) => {
  const app = express();
  app.get("/", (_req, res) => {
    res.end("root");
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  const res = await fetch(`${server.url}/missing`);

  assert.equal(res.status, 404);
  assert.equal(await res.text(), "404 Not Found");
});

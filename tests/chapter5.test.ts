import assert from "node:assert/strict";
import test from "node:test";
import { express } from "../src/index";
import { listenOnEphemeralPort } from "./helpers/http";

test("send(string) returns the text with an html content type", async (t) => {
  const app = express();
  app.get("/", (_req, res) => {
    res.send("hello");
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  const res = await fetch(`${server.url}/`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(await res.text(), "hello");
});

test("send(object) is serialized as JSON with the right content type (D4)", async (t) => {
  const app = express();
  app.get("/", (_req, res) => {
    res.send({ a: 1 });
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  const res = await fetch(`${server.url}/`);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(await res.text(), '{"a":1}');
});

test("json() keeps application/json (D4)", async (t) => {
  const app = express();
  app.get("/", (_req, res) => {
    res.json({ hello: "world" });
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  const res = await fetch(`${server.url}/`);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(await res.text(), '{"hello":"world"}');
});

test("send() handles numbers and booleans instead of hanging (D5)", async (t) => {
  const app = express();
  app.get("/number", (_req, res) => {
    res.send(42);
  });
  app.get("/boolean", (_req, res) => {
    res.send(false);
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  assert.equal(await (await fetch(`${server.url}/number`)).text(), "42");
  assert.equal(await (await fetch(`${server.url}/boolean`)).text(), "false");
});

test("send(null) produces an empty body", async (t) => {
  const app = express();
  app.get("/", (_req, res) => {
    res.send(null);
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  const res = await fetch(`${server.url}/`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "");
});

test("send(Buffer) uses application/octet-stream", async (t) => {
  const app = express();
  app.get("/", (_req, res) => {
    res.send(Buffer.from("hi"));
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  const res = await fetch(`${server.url}/`);
  assert.equal(res.headers.get("content-type"), "application/octet-stream");
  assert.equal(await res.text(), "hi");
});

test("status() sets the code and chains with json()", async (t) => {
  const app = express();
  app.get("/", (_req, res) => {
    res.status(201).json({ ok: true });
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  const res = await fetch(`${server.url}/`);
  assert.equal(res.status, 201);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(await res.text(), '{"ok":true}');
});

test("send() sets a correct Content-Length", async (t) => {
  const app = express();
  app.get("/", (_req, res) => {
    res.send("hello");
  });

  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  const res = await fetch(`${server.url}/`);
  assert.equal(res.headers.get("content-length"), "5");
});

import assert from "node:assert/strict";
import test from "node:test";
import { express } from "../src/index";
import { Application } from "../src/application/application";
import type { Handler } from "../src/types";
import { listenOnEphemeralPort } from "./helpers/http";

test("express() returns an application instance", () => {
  const app = express();
  assert.ok(app instanceof Application);
  assert.equal(typeof app.listen, "function");
  assert.equal(typeof app.handle, "function");
});

test("app.get registers a route and is chainable", () => {
  const app = express();
  const returned = app.get("/", () => {});

  assert.equal(returned, app, "method registration should return the app");

  const router = app.lazyrouter();
  const route = router.stack.find((layer) => layer.route !== undefined)?.route;
  assert.ok(route, "a route layer should have been registered");
  assert.equal(route.path, "/");
  assert.equal(route.methods.get, true);
  assert.equal(route.stack.length, 1);
});

test("app.get rejects non-function handlers", () => {
  const app = express();

  assert.throws(
    () => app.get("/", {} as unknown as Handler),
    (err: unknown) => err instanceof TypeError,
  );
});

test("an application owns a single router", () => {
  const app = express();

  assert.equal(app.lazyrouter(), app.lazyrouter());
});

test("settings can be set and toggled without being mutated", () => {
  const app = express();

  assert.equal(app.enabled("feature"), false, "unset settings are disabled");

  app.set("feature", true);
  assert.equal(app.enabled("feature"), true);
  assert.equal(app.disabled("feature"), false);

  app.set("feature", false);
  assert.equal(app.enabled("feature"), false);
  assert.equal(app.disabled("feature"), true);
  assert.equal(app.settings.feature, false, "the stored value must not be mutated");
});

test("an application with no routes still answers with 404", async (t) => {
  const app = express();
  const server = await listenOnEphemeralPort(app);
  t.after(() => server.close());

  const res = await fetch(`${server.url}/anything`);

  assert.equal(res.status, 404);
});

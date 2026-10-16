# Afnkit

[![Architecture diagram](https://gitdiagram.com/diagram-badge.svg)](https://gitdiagram.com/afnanlabs/afnkit-core?utm_source=readme&utm_medium=badge)

An original, educational **Express-inspired HTTP framework** written in
**TypeScript** on top of Node.js native HTTP APIs.

It is built by studying the concepts in the `lets-build-express/` tutorial
(kept in this repository as a read-only reference) and re-implementing them as a
cleaner, strictly typed, tested framework that addresses the defects catalogued in
[`forensic.md`](./forensic.md). See [`walkthrough.md`](./walkthrough.md) for the
chapter-by-chapter development record and [`DESIGN.md`](./DESIGN.md) for the
architecture and trade-offs.

> **Status:** Chapters 1–5 of the reference tutorial are implemented, and the
> defects catalogued in [`forensic.md`](./forensic.md) are fixed. The project
> builds cleanly and the automated suite passes **31/31**; the example server has
> been run and its endpoints verified, including inside Docker. There is no linter
> configured.

## Architecture

[![Architecture diagram of afnanlabs/afnkit-core](https://gitdiagram.com/afnanlabs/afnkit-core/diagram.png)](https://gitdiagram.com/afnanlabs/afnkit-core?utm_source=readme&utm_medium=picture)

## Features

- `express()` factory returning a typed `Application`.
- Route registration: `get`, `post`, `put`, `delete`, `patch`, `options`, `head`,
  `connect`, `trace`, and `all`.
- Middleware via `app.use(...)`, including 4-argument error-handling middleware.
- Path matching (query string ignored) with **method-aware** dispatch.
- A real `next()` with correct gating: one handler per cycle, and no execution
  after the response has ended.
- Error propagation (`next(err)`) for synchronous throws **and** rejected async
  handlers.
- Deliberate `404` / `405` (with `Allow`) / `500` responses — requests never
  hang.
- Per-request request/response prototype extension (`app.request` /
  `app.response`).
- `res.status`, `res.send`, `res.json` with correct content types.
- `HttpError` for deliberate status codes.
- Zero runtime dependencies; tests use the built-in `node:test` runner.

## Requirements

- Node.js 18+ (the test suite uses the global `fetch`, available from Node 18).
- TypeScript (dev dependency) for building.

## Install and build

```bash
npm install
npm run build      # compile to dist/
npm run typecheck  # type-check without emitting
npm test           # compile, then run node:test over dist/tests
```

> These scripts have been run: `npm run build` compiles with no errors and
> `npm test` reports **31 tests, 31 pass, 0 fail**.

## Usage

```ts
import { express, HttpError } from "afnkit";

const app = express();

// Middleware runs for every request, in order.
app.use((req, res, next) => {
  res.setHeader("X-Powered-By", "Afnkit");
  next();
});

app.get("/", (req, res) => {
  res.send("Hello world!");
});

app.get("/users/:id", (req, res) => {
  // Note: route parameters are not parsed yet; this matches the literal path.
  res.json({ id: req.path });
});

app.post("/echo", (req, res) => {
  res.status(201).json({ ok: true });
});

// Error-handling middleware (four arguments) catches next(err) and throws.
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    res.status(err.status).send(err.message);
    return;
  }
  next(err);
});

app.listen(3000, () => {
  console.log("Listening on http://localhost:3000");
});
```

A runnable version of the above lives in [`examples/basic.ts`](./examples/basic.ts)
(it starts a server on port 3000 when executed; it has been run and verified,
including under Docker).

## Project layout

```
src/               the framework (TypeScript)
tests/             automated tests (node:test)
examples/          usage examples
lets-build-express/  read-only tutorial reference (not modified)
walkthrough.md     chapter-by-chapter development history
DESIGN.md          architecture and design decisions
forensic.md        forensic review of the original tutorial (baseline)
```

## Known limitations

- Exact-string path matching only: no `:params`, wildcards, regex, or
  path-prefixed `app.use`.
- No query parsing (`req.query`) or body parsing.
- No implicit HEAD→GET mapping, content negotiation, ETag, redirects, or static
  file serving.
- No `next` double-call guard within a single handler tick.
- Error-handling detection relies on handler arity (four parameters).

## License

MIT — see [`LICENSE`](./LICENSE).

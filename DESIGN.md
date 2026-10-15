# Design — Afnkit

This document explains the architecture, the reasoning behind it, and the
trade-offs. It complements `walkthrough.md` (the chronological build record) and
`forensic.md` (the review of the original tutorial).

## Goals

- Teach the same internals the `lets-build-express` tutorial teaches
  (`express()` → Application → Router → Route/Layer → `next` → extended
  response), but as **original, strictly typed, tested** code.
- Use only Node.js native HTTP APIs; no runtime dependencies.
- Fix the correctness defects catalogued in `forensic.md` at the chapter where
  each first becomes relevant, not by shipping a broken intermediate.

## Non-goals

- Full Express compatibility. Features Express happens to have (sub-routers,
  template engines, `res.sendFile`, content negotiation, ETag, route patterns)
  are intentionally out of scope unless they fall inside the five chapters.
- Production hardening (rate limiting, security headers, body limits).

## Module map

```
src/
  index.ts                     express() factory + public exports
  types.ts                     Request / Response / Handler / ErrorHandler / NextFunction
  application/application.ts   Application: settings, registration, use, listen, handle
  router/router.ts             Router: layer stack + next() dispatch loop
  router/route.ts              Route: per-path handlers + dispatch (one handler per next)
  router/layer.ts              Layer: one handler + path/method/error metadata
  middleware/init.ts           expressInit: attaches request/response prototypes
  request/request.ts           app.request prototype
  response/response.ts         app.response prototype (status/send/json)
  errors/http-error.ts         HttpError
  errors/final-handler.ts      terminal 404/405/500 response
```

## Request lifecycle

1. `http.createServer` invokes `Application.handle(req, res)`.
2. `handle` calls `lazyrouter()`. On first use this creates the router **and
   installs `expressInit` exactly once**.
3. `Router.handle` parses the pathname once and defines a single `next` closure
   over the stack index.
4. `expressInit` matches (middleware matches every path), points `req`/`res` at
   `app.request`/`app.response`, and calls `next()`.
5. `next` advances to the next matching layer. Route layers are checked for
   method match (a mismatch is remembered for a `405`); matching route layers run
   `Route.dispatch`.
6. `Route.dispatch` runs **one** handler per `next()` call, skipping handlers for
   other methods and error handlers during normal flow.
7. When the stack is exhausted, `finalHandler` produces `404`, or `405` with an
   `Allow` header, and `next(err)` produces a `4xx` from an `HttpError` or a
   generic `500`.

## Design decisions and trade-offs

### Classes instead of prototype mixins

The tutorial (and Express) build the app as a function and copy an application
prototype onto it with `merge-descriptors`, so the app is itself callable and can
be mounted as middleware. We use classes instead.

- **Why:** it is idiomatic, strictly typed, and gives real autocompletion and
  `instanceof` checks. It avoids `Object.setPrototypeOf`-style mixin magic.
- **Trade-off:** the app object is *not* callable, so sub-app mounting
  (`app.use(subApp)`) is not possible. That feature is P3 and out of scope; the
  router can still be used directly.

### One `next` closure per dispatch

`Router.handle` and `Route.dispatch` each keep a closure over their stack index.
This is the mechanism the tutorial is really teaching, and it is what makes
"exactly one handler per `next()`" fall out naturally. It is also why Chapter 5
does *not* loop over a route's handlers (the reference's D3 regression).

### Response extension by prototype repointing

`expressInit` runs `Object.setPrototypeOf(res, app.response)`. Extensions live on
`app.response`, so:

- nothing global (`ServerResponse.prototype`) is mutated — multiple applications
  coexist safely;
- extensions are defined once but available per request.

`app.request` is wired symmetrically, so the previously dead request prototype is
meaningful.

### Structural middleware matching

The reference matches its internal middleware by the literal string
`name === "expressInit"`. We match structurally: a layer with no `route` is
middleware and matches every path. The function is still named `expressInit` for
debuggability, but correctness does not depend on that name.

### 404 / 405 / 500 terminal handler

Every dispatch path funnels into `finalHandler`. This guarantees a response even
when nothing matched (the reference hangs), and centralises status selection:

- **404** — no layer matched the path.
- **405** — a route matched the path but not the method (with `Allow`).
- **4xx** — an exposed `HttpError` forwarded via `next(err)`.
- **500** — any other error (message hidden, error logged).

### Content types

`res.send` sets a content type only when the caller has not already set one. This
is the D4 fix: `res.json` sets `application/json`, then delegates to `send`,
which no longer overwrites it. Plain strings use `text/html; charset=utf-8` to
match real Express (the tutorial used `text/plain`); this deviation is deliberate.

### Error detection by arity

A handler with four parameters is treated as error-handling middleware
(`err, req, res, next`), matching Express's convention. This is simple and
predictable; its limitation (default parameters / `...rest` change `fn.length`)
is documented.

### Forward contract for `Response`

`src/types.ts` declares `status`/`send`/`json` on `Response` from Chapter 1 even
though the methods are attached in Chapters 4–5. Declaring the whole public
contract once keeps the public types stable across the chapter progression; the
`walkthrough.md` records when each method becomes available at runtime.

## State and concurrency

All per-request state (`idx`, match results, `allowedMethods`) lives inside the
`handle`/`dispatch` closures created per request. There is no shared mutable
request state, so concurrent requests do not interfere. (This is a design
argument; concurrency was **not** exercised — see `walkthrough.md`.)

## Execution status

This project was **not run**. No server was started, and no build, test,
type-check, or linter was executed, per the project instructions. The `npm`
scripts exist but were not invoked.

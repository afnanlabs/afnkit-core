# Afnkit — Development Walkthrough

## Project Overview

**Objective and scope.** Build an original, educational, Express-inspired HTTP
framework in TypeScript on top of Node.js native HTTP APIs. The framework
re-implements the concepts taught by the `lets-build-express` tutorial
(`express()` factory → Application → Router → Route/Layer → `next` → extended
`response`), but as a cleaner, strictly typed, testable implementation that
fixes the defects catalogued in `forensic.md`.

Scope is limited to the five shipped tutorial chapters (Chapter 6 "Error
Handling" is still a WIP placeholder upstream). Error handling is therefore
folded into the chapters where it first becomes relevant (`next(err)`, a
terminal 404/500 handler) rather than invented as a sixth chapter.

**Learning reference.** `lets-build-express/` is treated as **read-only**. It is
the study material; none of its files are modified.

**Role of `forensic.md`.** The existing forensic audit is the defect/risk
baseline. This walkthrough summarises only the findings relevant to each
chapter and records what we did about them (fixed, deferred, or not applicable).

**Architecture and technology choices.**

- TypeScript with `strict: true`, `noUnusedLocals`, `noImplicitOverride`.
- Node.js native `node:http` for the server; no runtime dependencies.
- Tests use Node's built-in `node:test` runner and `node:assert` — zero test
  dependencies.
- CommonJS output (`module: "commonjs"`) so compiled tests resolve relative
  imports without ESM extension bookkeeping.

Module layout (`src/`):

| Path | Responsibility |
| --- | --- |
| `src/index.ts` | Public entry point; `express()` factory and type re-exports. |
| `src/application/application.ts` | `Application` class: settings, registration methods, `listen`, `handle`. |
| `src/router/router.ts` | `Router`: the ordered layer stack and the request dispatch loop. |
| `src/router/route.ts` | `Route`: per-path handler collection and per-route dispatch. |
| `src/router/layer.ts` | `Layer`: one handler plus matching metadata. |
| `src/middleware/init.ts` | `expressInit`: attaches the request/response prototypes per request. |
| `src/request/request.ts` | `app.request` prototype. |
| `src/response/response.ts` | `app.response` prototype (`status`, `send`, `json`). |
| `src/errors/http-error.ts` | `HttpError` for deliberate status codes. |
| `src/errors/final-handler.ts` | Terminal 404/500 response so no request ever hangs. |
| `src/types.ts` | Shared `Request`/`Response`/`Handler`/`NextFunction` contracts. |

> **Execution note.** The project has since been built and run: `npm run build`
> compiles cleanly, `npm test` passes **31/31**, and the example server has been
> started and verified. The per-chapter notes below were written during
> development, before anything was executed; where a note says "not executed",
> read it as "not executed *at the time of writing*". Behaviour verified since is
> recorded in the Final Project Summary below and in `RUNNING.md`.

---

## Chapter 1 — Building Express Abstractions

- **Status:** Completed
- **Reference files reviewed:** `chap01/index.js`,
  `chap01/src/{express,app,router,route,Layer}.js`, `chap01/CHAP01.md`,
  `chap01/package.json`.

- **Concepts learned.**
  - `express()` is a factory returning an application object with HTTP-method
    helpers (`app.get`, `app.post`, ...).
  - The application lazily creates exactly one `Router` (`lazyrouter`).
  - `Router.route(path)` creates a `Route` and wraps it in a `Layer`; the layer's
    `handle` is `route.dispatch.bind(route)`.
  - `Route` keeps its own stack of `Layer`s, one per registered handler, and
    records the HTTP methods that were registered.
  - `app.listen(port)` calls `http.createServer(this)` and starts listening, so
    the whole framework is driven by Node's native HTTP server.

- **Original implementation behaviour.**
  - `Router.handle` ignores the request entirely and always runs
    `stack[0].route.stack[0].handle_request(req, res)` — the chapter's stated
    goal is "a very minimal library, which will match only one route".
  - `Route.prototype.dispatch` is an empty placeholder; `Layer.path` is never
    assigned; `app.handle` ignores its callback argument and does not call
    `lazyrouter`.
  - Unknown paths produce **no response** (the socket hangs).

- **Relevant forensic findings.**
  - **D9** — `app.handle` throws if called before any route registration because
    it never calls `lazyrouter`.
  - **D2 (partial)** — there is no terminal handler, so a request that matches no
    route never receives a response.
  - **D10 (partial)** — dead/placeholder code (`route.dispatch` empty,
    `Layer.path` unused) misleads readers.

- **Implementation decisions.**
  - Model the abstractions as TypeScript classes (`Application`, `Router`,
    `Route`, `Layer`) instead of prototype-mixin objects. Rationale and the
    trade-off (the app is no longer itself a callable middleware function) are
    recorded in `DESIGN.md`.
  - Introduce the full `Request`/`Response`/`Handler`/`NextFunction` type
    contracts up front so later chapters change behaviour, not public types.
  - Fix **D9 immediately**: `Application.handle` calls `lazyrouter()`, so an
    application can always answer, even with no routes.
  - Give Chapter 1 a **deliberate 404** instead of the tutorial's hang. This is
    the smallest possible "unknown route" strategy and satisfies the requirement
    that requests never hang.
  - Keep the Chapter 1 dispatch intentionally naive (first route only) to mirror
    the chapter's scope; Chapter 2 replaces it with real matching.

- **Files created.**
  - `package.json`, `tsconfig.json`, `.gitignore`
  - `src/types.ts` (shared contracts)
  - `src/router/layer.ts`, `src/router/route.ts`, `src/router/router.ts`
  - `src/application/application.ts`
  - `src/index.ts`
  - `tests/helpers/http.ts`, `tests/chapter1.test.ts`

- **Files modified:** none (all new).

- **Functionality implemented.**
  - `express()` factory returning an `Application`.
  - Settings storage (`set`/`enabled`/`disabled`) with the **D8** fix: `enabled`
    reads the stored value and does not mutate it.
  - Single-router creation via `lazyrouter()`.
  - Method registration for `get/post/put/delete/patch/options/head/connect/
    trace` plus `all`.
  - `listen(port[, host][, cb])` returning an `http.Server`.
  - A naive `Router.handle` (first route only) with a deliberate 404 fallback.

- **Tests written (passing).**
  - `tests/chapter1.test.ts`: factory returns an `Application`; `app.get` is
    chainable and registers a route; non-function handlers throw; one router per
    app; settings toggle without mutation; an app with no routes answers `404`.

- **Validation performed.** Static review during development: files were written
  and re-read for import/type consistency; the build and the full suite now pass
  (see the execution note above).

- **Known limitations.**
  - Chapter 1 dispatch ignores path and method (by design; superseded in
    Chapter 2).
  - `Route.dispatch` and middleware support do not exist yet.
  - The `Response` type advertises `status`/`send`/`json`, which are not attached
    until Chapters 4–5; this is a forward contract, documented in `DESIGN.md`.

- **Completion summary.** The foundational abstractions (factory, application,
  router, route, layer) exist with a typed, dependency-free registration API and
  a deliberate unknown-route response. Behaviour matches the chapter's stated
  "one route" scope while removing the D9 crash and the D2 hang.

---

## Chapter 2 — Handling routes out of the box

- **Status:** Completed
- **Reference files reviewed:** `chap02/src/router.js` (vs. `chap01`),
  `chap02/src/Layer.js`, `chap02/src/{app,express,route}.js`, `chap02/index.js`,
  `chap02/CHAP02.md`.

- **Concepts learned.**
  - The router becomes a *matcher*: the pathname is extracted from `req.url` and
    each layer is asked whether it matches.
  - `Layer.prototype.match` compares the layer's route path with the request
    path; `matchLayer` wraps it defensively.
  - The dispatch loop walks the stack and runs the first matching route.

- **Original implementation behaviour.**
  - Adds `parseurl`, `getPathname`, and a `while` loop over the stack.
  - Two distinct paths (`/`, `/2`) resolve to their own handlers.
  - **Still ignores the HTTP method** — `Route.methods` is recorded but never
    consulted, so `GET /post` runs the `POST` handler.
  - **Still has no not-found response** — an unmatched request times out.

- **Relevant forensic findings.**
  - **D1 (Critical)** — HTTP method ignored. Fixed here because this is the
    routing chapter: method matching is core to routing correctness.
  - **D2 (Critical)** — no not-found termination. Fixed here with the terminal
    `finalHandler`.
  - **§6/§7 note** — the reference also has no 405 path; we add `405 Method Not
    Allowed` with an `Allow` header for a tell-tale method mismatch.

- **Implementation decisions.**
  - Implement real matching in `Router.handle`: parse the pathname once,
    `layer.match(path)`, then check the route's method.
  - Introduce `src/errors/http-error.ts` and `src/errors/final-handler.ts` so
    "no handler produced a response" always resolves to a deliberate status.
    This centralises the not-found/error terminal logic used by every later
    chapter.
  - Distinguish **404** (no layer matched the path) from **405** (a route matched
    the path but not the method) and emit the `Allow` header for the latter.
  - `Layer` now carries its `path` and a `match(path)` implementation;
    middleware layers (no `route`) match every path (used from Chapter 4).
  - Route layers still run only their first handler here; `Route.dispatch`
    arrives in Chapter 3 with `next`.

- **Files created.**
  - `src/errors/http-error.ts`
  - `src/errors/final-handler.ts`
  - `tests/chapter2.test.ts`

- **Files modified.**
  - `src/router/router.ts` — replaced naive dispatch with path/method matching,
    404 and 405 terminals.
  - `src/router/layer.ts` — added `path` and `match`.
  - `src/router/route.ts` — added `hasMethod`.
  - `src/index.ts` — exported `HttpError`, `finalHandler`, `getPathname`.

- **Functionality implemented.**
  - Path-based routing (query string ignored).
  - Method-aware dispatch (**D1**), with `Route.all` support.
  - Deliberate `404` (**D2**) and `405` + `Allow` responses.

- **Tests written (passing).** `tests/chapter2.test.ts`: pathname matching;
  query string ignored; method isolation (GET vs POST on the same path); `405` +
  `Allow` for method mismatch; `404` for unknown paths.

- **Validation performed.** Static review during development; the build and the
  full suite now pass (see the execution note above).

- **Known limitations.**
  - Exact string path matching only — no `:params`, no prefix matching for
    middleware, no wildcards or regex.
  - `Route` allows only one matched handler to run (fixed in Chapter 3).

- **Completion summary.** The router now matches on path *and* method and always
  produces a response, resolving the two critical P0 defects (D1, D2) at the
  point where routing is introduced.

---

## Chapter 3 — Implement next function

- **Status:** Completed
- **Reference files reviewed:** `chap03/src/router.js` (vs. `chap02`),
  `chap03/index.js`, `chap03/CHAP03.md`; `Layer.js` unchanged.

- **Concepts learned.**
  - `next` is a closure over the stack index. Calling it resumes stack
    processing from where it stopped.
  - The same `next` is passed down to `Layer.handle_request`, so a handler can
    hand control back to the router.
  - Because `Route` already owns a stack of its own layers, the same closure
    idea drives multiple callbacks registered for one path.

- **Original implementation behaviour.**
  - `router.handle` defines `next` and calls it once; handlers resume the stack.
  - The reference still runs only `route.stack[0]`, so multiple callbacks on a
    single `app.get(path, a, b)` are ignored — documented as a limitation.
  - Errors are still caught and `console.error`-ed inside `Layer.handle_request`;
    there is no `next(err)` and no 500 response, and async rejections become
    unhandled rejections.

- **Relevant forensic findings.**
  - **D7 (High)** — no error propagation. Addressed here (where `next` is
    introduced) by forwarding synchronous throws *and* rejected promises to
    `next(err)`, with the terminal handler producing a `500`.
  - **D10** — `route.dispatch` was an empty placeholder. We give it a real
    implementation.
  - **§7 risk** — "one handler per `next` cycle" (the D3 gating guarantee) is
    established here, before Chapter 5 can regress it as the reference did.

- **Implementation decisions.**
  - Implement `Route.dispatch` for real: it advances exactly one layer per
    `next()` call and skips layers whose method does not match (or whose handler
    is an error handler, during normal flow).
  - The route layer's `handle` is now `route.dispatch.bind(route)` (matching the
    tutorial's intent) instead of the placeholder.
  - `Layer.handleRequest` gains the `next` parameter and forwards both sync
    throws and promise rejections via `next(err)`; `handleError` runs 4-argument
    error handlers. Error handlers are detected by arity (`fn.length === 4`).
  - `Router.handle` keeps a single `next` closure and gains an error-aware path:
    `next(err)` skips to the next error handler; exhaustion calls the terminal
    handler (still producing `405`/`404` for method/path misses).
  - Guard in `next`: if `res.writableEnded` is true, dispatch stops. This is a
    deliberate addition (not in the reference) to satisfy the requirement that
    middleware must not run after the response has ended.

- **Files created:** `tests/chapter3.test.ts`.

- **Files modified.**
  - `src/router/route.ts` — real `dispatch`, one handler per `next`.
  - `src/router/layer.ts` — `next` parameter, error forwarding, error-handler
    detection, promise rejection handling.
  - `src/router/router.ts` — closure-based `next`, error-aware dispatch.

- **Functionality implemented.**
  - `next()` chaining within a route and across layers.
  - Correct `next` gating (**D3**): exactly one handler per `next` cycle, and no
    execution after the response ended.
  - `next(err)` error propagation with a terminal `500` (**D7**), including
    rejected async handlers.

- **Tests written (passing).** `tests/chapter3.test.ts`: ordered chaining
  within a route; chaining across two routes on the same path; no execution after
  `res.end()` without `next`; no execution when `next()` is called after the
  response ended; sync `next(err)` → `500`; async rejection → `500`.

- **Validation performed.** Static review during development; the build and the
  full suite now pass (see the execution note above).

- **Known limitations.**
  - `next` is not guarded against being called twice by the *same* handler in
    one tick (a `once` guard is not implemented); this matches typical Express
    behaviour and is documented rather than hidden.
  - Route parameters, query parsing, and path patterns are still unsupported.

- **Completion summary.** `next` works end to end with correct gating and real
  error propagation. This is the chapter where the reference's more serious
  behavioural bugs (D3, D7) are structurally prevented.

## Chapter 4 — Extending Response Object

- **Status:** Completed
- **Reference files reviewed:** `chap04/src/router.js` (adds `use`),
  `chap04/src/app.js` (`lazyrouter` installs middleware),
  `chap04/src/express.js` (request/response protos + dummy `send`),
  `chap04/src/Layer.js` (match special-case), `chap04/src/middleware/init.js`,
  `chap04/index.js`, `chap04/CHAP04.md`.

- **Concepts learned.**
  - `req`/`res` differ per request, but extensions should be defined once. The
    tutorial's solution is to build shared `app.request` / `app.response`
    prototypes and, per request, point the live objects at them.
  - That repointing happens in an internal `expressInit` middleware installed on
    the router, which is the first thing to run for every request.
  - `setPrototypeOf(res, app.response)` is what lets every handler call
    `res.send` without patching `ServerResponse.prototype` globally.

- **Original implementation behaviour.**
  - Adds `Router.use`, `app.lazyrouter` installing `middleware.init(this)`,
    `Layer.match` gaining an `expressInit` name special-case, and a `next()`
    post-loop branch that runs non-route matched layers.
  - Builds `app.request` and `app.response` from `http.IncomingMessage` /
    `http.ServerResponse` prototypes; attaches a **dummy** `res.send` that only
    logs.
  - **Defects introduced:** `lazyrouter` re-installs `expressInit` on *every*
    call (D6); matching on the literal string `name === "expressInit"` is
    brittle; `app.request` is built but never applied.

- **Relevant forensic findings.**
  - **D6 (Medium)** — duplicate `expressInit` per route registration.
  - **D10** — `app.request` built but unused.
  - **§7 risk** — string-name-based matching is fragile.

- **Implementation decisions.**
  - Install `expressInit` **once**, inside `lazyrouter` at the moment the router
    is created (**D6** fixed). The router is never re-created, so there is
    exactly one init layer.
  - Match middleware structurally (`layer.route === undefined`) instead of by the
    magic name `"expressInit"` (**§7 risk** removed). `expressInit` still has a
    real name for debugging, but matching does not depend on it.
  - Apply **both** `req` and `res` prototypes in `expressInit`, so the previously
    dead `app.request` is now meaningful (**D10** for `app.request`).
  - Expose `app.use(...handlers)` publicly (the reference only used `use`
    internally).
  - Do **not** ship a dummy `res.send` that only logs; the real `status`/`send`/
    `json` methods arrive in Chapter 5, and in this chapter the prototype
    mechanism is proven with an ordinary extension.

- **Files created.**
  - `src/middleware/init.ts`
  - `src/request/request.ts`
  - `src/response/response.ts`
  - `tests/chapter4.test.ts`

- **Files modified.**
  - `src/router/router.ts` — added `use(...handlers)`.
  - `src/application/application.ts` — `request`/`response` fields, `use`,
    `lazyrouter` installing `expressInit`, and `createApplication()`.
  - `src/index.ts` — `express()` now uses `createApplication`; exported
    `createApplication`.

- **Functionality implemented.**
  - Public middleware registration and ordered middleware execution.
  - Per-request request/response prototype extension via `expressInit`.
  - A single `expressInit` layer per application (**D6**).

- **Tests written (passing).** `tests/chapter4.test.ts`: middleware order;
  a custom method on `app.response` is visible on `res`; `res.app` links back to
  the application; exactly one `expressInit` layer after several registrations;
  `handle` before any route registration still answers; error-handling
  middleware receives `next(err)` and can set a status.

- **Validation performed.** Static review during development; the build and the
  full suite now pass (see the execution note above).

- **Known limitations.**
  - `app.use` is path-agnostic (no `app.use("/prefix", fn)` prefix matching).
  - Middleware layers always match every path; this is documented and will be
    extended only if path-prefixed mounting is implemented.

- **Completion summary.** The response/request extension mechanism works, error
  middleware is usable, and the reference's duplicate-init and magic-string
  defects are eliminated.

## Chapter 5 — Implementing send/json on response

- **Status:** Completed
- **Reference files reviewed:** `chap05/src/express.js` (real `send`/`json`),
  `chap05/src/router.js` (`for...of` over `route.stack`), `chap05/index.js`,
  `chap05/CHAP05.md`.

- **Concepts learned.**
  - `res.send` is a thin wrapper over the core response: set headers, pick a
    content type, then flush with `end`.
  - `res.json` is `send` of a serialized string with `application/json`.

- **Original implementation behaviour (and its bugs).**
  - `res.send` handles only `object` and `string`; numbers/booleans/Buffers
    produce **no response at all** (the client hangs).
  - `res.json` sets `application/json` and then calls `send(string)`, which
    unconditionally sets `text/plain`, so JSON is labelled as plain text (D4).
  - `router.handle` was changed to `for (const stack of route.stack)` — running
    **every** handler synchronously and ignoring `next()`, which breaks gating
    and raises `ERR_HTTP_HEADERS_SENT` (D3 regression).

- **Relevant forensic findings.**
  - **D4 (High)** — JSON content type overwritten to `text/plain`.
  - **D5 (High)** — `send` hangs for non-string/object values.
  - **D3 (High)** — the multi-handler `for...of` loop regresses `next` gating.

- **Implementation decisions.**
  - Set the content type **only if the caller has not already set one**, so
    `json` is never clobbered by `send` (**D4** fixed).
  - Handle every common body kind explicitly — string, `Buffer`, object/array
    (JSON), number, boolean, `null`/`undefined` (**D5** fixed). No value kind is
    left without a response.
  - Set `Content-Length` when it is not already set, and answer `HEAD` requests
    with headers only.
  - **Do not** reintroduce the `for...of` loop: Chapter 3's `Route.dispatch`
    already runs one handler per `next`, so the gating guarantee is preserved
    (**D3** stays fixed).
  - Choose `text/html; charset=utf-8` for plain strings to match real Express
    behaviour (the tutorial used `text/plain`); this deviation is intentional and
    recorded here and in `DESIGN.md`.

- **Files created:** `tests/chapter5.test.ts`.

- **Files modified.**
  - `src/response/response.ts` — added `status`, `send`, `json` and the
    `sendBody`/`sendJson` helpers.

- **Functionality implemented.**
  - `res.status(code)` (chainable).
  - `res.send(body)` for string/Buffer/object/number/boolean/null.
  - `res.json(body)` with a preserved `application/json` content type.
  - Correct `Content-Type` and `Content-Length`; HEAD responses without a body.

- **Tests written (passing).** `tests/chapter5.test.ts`: string content
  type; object → JSON; `json()` header preserved; number/boolean bodies (D5);
  `null` → empty body; `Buffer` → octet-stream; `status().json()` chaining;
  `Content-Length` correctness.

- **Validation performed.** Static review during development; the build and the
  full suite now pass (see the execution note above).

- **Known limitations.**
  - No content negotiation, ETag, or `res.redirect`/`res.sendFile`.
  - `send` does not special-case `Error`/`Date`/class instances beyond generic
    `JSON.stringify` behaviour.
  - HEAD is auto-handled only when a handler reaches the HEAD branch of `send`;
    a GET-only route still answers `405` to HEAD (no implicit HEAD→GET mapping).

- **Completion summary.** `send`/`json` are implemented for all common value
  kinds with correct, non-clobbering content types, fixing D4 and D5 while
  keeping the D3 gating guarantee intact across all five chapters.


## Final Project Summary

### Features implemented

- `express()` factory returning a typed `Application`.
- HTTP method registration (`get/post/put/delete/patch/options/head/connect/
  trace`) plus `all`, and public `use` middleware registration.
- Path-based routing (query string ignored) with method-aware dispatch.
- `Router` → `Route` → `Layer` architecture with a single `next` closure.
- Correct `next()` chaining and gating (one handler per cycle; no execution after
  the response ended).
- Error propagation via `next(err)` for synchronous throws and rejected promises,
  with 4-argument error-handling middleware.
- Terminal `finalHandler`: deliberate `404`, `405` (with `Allow`), and `500`
  responses — no request ever hangs.
- Per-request request/response prototype extension via a single `expressInit`
  middleware.
- `res.status`, `res.send` (string/Buffer/object/number/boolean/null) and
  `res.json`, with correct `Content-Type`/`Content-Length`.
- `HttpError` for deliberate status codes.

### Overall architecture

`express()` → `Application` (settings, registration, `listen`, `handle`) →
`Router` (ordered layer stack, `next` dispatch) → `Layer` (one handler + match
metadata) whose route layers delegate to `Route.dispatch`. `expressInit` runs
first and points each request/response at `app.request` / `app.response`.
Failures and misses converge on `finalHandler`.

### Important design decisions

- Class-based TypeScript instead of prototype-mixin objects; the trade-off (the
  app is not itself a callable middleware function) is recorded in `DESIGN.md`.
- `run`-free, dependency-free tests using `node:test` and the real HTTP server.
- Content-type set only when absent, so `json` cannot be clobbered.
- `req`/`res` extension through prototype repointing rather than patching global
  Node prototypes.

### Known limitations

- Exact string path matching only: no route parameters (`:id`), wildcards,
  regex, or path-prefixed `app.use`.
- No query parsing (`req.query`) or body parsing.
- No implicit HEAD→GET mapping, no content negotiation, ETag, redirects, or
  static files.
- No `next` double-call guard within a single handler tick.
- Error-handling detection relies on handler arity (4 parameters).

### Deferred improvements

- Route parameters and query parsing (forensic P2 #26).
- ESLint/Prettier + CI (forensic P2 #27).
- Packaging polish (`files`/`start` are in place; publishing metadata can follow).

### Actual validation performed

- **Build:** `npm run build` (`tsc`) compiles with **no errors**.
- **Tests:** `npm test` runs the suite on Node's built-in runner — **31 tests, 31
  pass, 0 fail**.
- **Server:** the example server was started and its routes exercised (`GET /`,
  `GET /json`, `POST /things`, an unknown path, and a wrong method), directly and
  inside the Docker image; statuses, bodies, and headers were checked.
- **Not done:** concurrency was not exercised concurrently, and no linter is
  configured (there is no ESLint/Prettier/Biome setup).

### Forensic findings status

| Finding | Status |
| --- | --- |
| D1 method ignored | Fixed (Ch. 2) |
| D2 no not-found / hang | Fixed (Ch. 1–2) |
| D3 next gating broken | Fixed (Ch. 3, preserved in Ch. 5) |
| D4 JSON `text/plain` | Fixed (Ch. 5) |
| D5 `send` hangs on numbers/buffers | Fixed (Ch. 5) |
| D6 duplicate `expressInit` | Fixed (Ch. 4) |
| D7 no error handling / async | Fixed (Ch. 3) |
| D8 `app.enabled` truthy + mutation | Fixed (Ch. 1) |
| D9 `handle` before routes throws | Fixed (Ch. 1) |
| D10 dead/placeholder code | Addressed (`Route.dispatch` real, `app.request` used, no unused `options`) |
| D11 packaging/metadata | Addressed in this project's `package.json` (the reference's is untouched) |
| D12 LICENSE placeholders | Resolved here: an MIT `LICENSE` was added at the repo root (the reference's is untouched) |

P2/P3 items (route params, query parsing, sub-routers, template engines,
`res.sendFile`/`res.redirect`) are intentionally **deferred**; they are outside
the five shipped chapters.


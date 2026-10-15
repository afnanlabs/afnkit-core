# RUNNING.md — Afnkit Setup and Execution Guide

This guide walks you through getting **Afnkit** running from a fresh clone: installing
dependencies, compiling TypeScript, running the example server, and executing the test
suite. It assumes you have **never run this project before** but are comfortable using a
terminal.

> **Important — execution status.** The non-Docker instructions in this file were written
> by inspecting the repository's configuration and source; they were **not** executed while
> the document was written and remain unverified. The **Docker** instructions in §M *were*
> executed and verified (see the note there). Where behaviour depends on your environment
> (Node version, OS, a free port, Docker Desktop running) that is called out explicitly.

Throughout, commands are shown for **Windows PowerShell** and, where they differ, for
**macOS / Linux** (bash). Lines are copy‑paste ready.

---

## A. Prerequisites

Afnkit is a pure Node.js + TypeScript project. You need:

| Software | Why | Version requirement | Where it comes from |
| --- | --- | --- | --- |
| **Node.js** | Runs the framework, the example server, and the test runner (`node:test`). | **18 or newer.** The test suite uses the global `fetch` (available from Node 18) and `server.closeAllConnections()` (Node 18.2+). | [`README.md`](./README.md) "Requirements". |
| **npm** | Installs the two dev dependencies and runs the scripts. | Ships with Node.js (npm 8+ is fine). | Bundled with Node.js. |
| **TypeScript** | Compiles `.ts` → `.js`. | `^5.6.0` | **Not required globally** — it is a dev dependency installed by `npm install` (see `package.json` → `devDependencies`). |

Notes derived from configuration:

- `tsconfig.json` targets **ES2022** (`"target": "ES2022"`) and uses `module: "commonjs"`.
- `package.json` lists only two dev dependencies and **zero runtime dependencies**
  (`@types/node ^22.0.0`, `typescript ^5.6.0`).
- There is **no `engines` field** in `package.json`, so the "18+" requirement comes from
  the README, not from an enforced constraint. Node 18+ is the supported floor; a current
  LTS (Node 20 or 22) is recommended but not enforced.

### Check your versions

Run these anywhere:

**PowerShell / macOS / Linux**
```bash
node --version
npm --version
```

You should see `v18.x` or higher for Node. If either command is "not found", install
Node.js from <https://nodejs.org/> (the LTS installer includes npm), then reopen your
terminal.

---

## B. Project structure

The repository root is the folder that contains `package.json` (referred to below as
`express-project/`). Key items:

```
express-project/
├── package.json          Project metadata, npm scripts, dev dependencies
├── tsconfig.json         TypeScript compiler configuration (strict, CommonJS, ES2022)
├── .gitignore            Ignores node_modules/, dist/, logs, coverage, editor files
├── Dockerfile            Multi-stage Docker image (build + runtime) for the example server
├── .dockerignore         Files excluded from the Docker build context
├── README.md             Overview, features, quick usage
├── DESIGN.md             Architecture, request lifecycle, design trade-offs
├── walkthrough.md        Chapter-by-chapter development record (Ch. 1–5 + summary)
├── forensic.md           Forensic audit of the original tutorial (defect baseline)
├── RUNNING.md            This file
├── src/                  ★ The Afnkit framework source (TypeScript)
│   ├── index.ts              Public entry point: express() factory + exports
│   ├── types.ts              Request / Response / Handler / ErrorHandler / NextFunction
│   ├── application/
│   │   └── application.ts    Application: settings, route registration, use, listen, handle
│   ├── router/
│   │   ├── router.ts         Router: layer stack + next() dispatch loop
│   │   ├── route.ts          Route: per-path handlers + dispatch (one handler per next)
│   │   └── layer.ts          Layer: one handler + path/method/error metadata
│   ├── middleware/
│   │   └── init.ts           expressInit: attaches request/response prototypes per request
│   ├── request/
│   │   └── request.ts        app.request prototype
│   ├── response/
│   │   └── response.ts       app.response prototype (status / send / json)
│   └── errors/
│       ├── http-error.ts     HttpError (status-carrying error)
│       └── final-handler.ts  Terminal 404 / 405 / 500 response
├── tests/                ★ Automated tests (Node's built-in test runner)
│   ├── chapter1.test.ts .. chapter5.test.ts   Per-chapter tests
│   └── helpers/
│       └── http.ts           Test helper: starts an app on an ephemeral port
├── examples/
│   └── basic.ts          ★ Runnable example app (starts a server on port 3000)
└── lets-build-express/   📚 The ORIGINAL tutorial reference (see note below)
```

Also relevant:

- **`src/`** — the actual Afnkit implementation. This is the framework you are building.
- **`tests/`** — automated tests written with `node:test` and `node:assert`. They start a
  real HTTP server on an OS-assigned ("ephemeral") port and make real requests with the
  global `fetch`.
- **`examples/basic.ts`** — a small, runnable demonstration of the public API. It starts a
  server on **port 3000** when executed.
- **`README.md`** — high-level overview and a quick-usage snippet.
- **`DESIGN.md`** — how the router/`next`/layers work, and the trade-offs behind them.
- **`forensic.md`** — the audit of the *original tutorial* that this project set out to
  improve on. **Read-only reference; do not modify.**
- **`walkthrough.md`** — the per-chapter build history, including the defect list (D1–D12)
  and which ones were fixed where.
- **`package.json`** — npm metadata and the scripts you will run (see §D–§G).
- **`tsconfig.json`** — compiler settings (strict mode, CommonJS, output to `dist/`).
- **`dist/`** — *(generated)* the compiled JavaScript, created by the build. Git-ignored.
- **`node_modules/`** — *(generated)* installed dependencies. Git-ignored.

### ⚠️ About `lets-build-express/`

`lets-build-express/` is the **original tutorial repository** by a third party
(`antsmartian/lets-build-express`), kept in this repo purely as a **read-only study
reference**. It is **not** part of Afnkit, its code is **not** imported by Afnkit, and it
is **not** what you build or run here. Afnkit lives entirely in `src/`. Do not edit
anything under `lets-build-express/`.

---

## C. Initial setup

### 1. Open a terminal in the project root

The project root is the directory that contains `package.json`.

**PowerShell**
```powershell
cd path\to\express-project
```

**macOS / Linux**
```bash
cd path/to/express-project
```

To confirm you are in the right place:

**PowerShell**
```powershell
Get-ChildItem package.json, tsconfig.json
```

**macOS / Linux**
```bash
ls package.json tsconfig.json
```

> If you see `Could not read package.json`, you are in the wrong directory.

### 2. Install dependencies

**PowerShell / macOS / Linux**
```bash
npm install
```

This reads `package.json` and installs the two dev dependencies (`typescript`,
`@types/node`) into a new `node_modules/` folder. There are no runtime dependencies.

### About `package-lock.json`

- **It now exists in the repository root** (`package-lock.json`, `lockfileVersion` 3),
  generated by `npm install`.
- Its role is to **lock the exact versions** of every installed package (including
  transitive dependencies) so that everyone — CI and Docker included — installs a
  byte-for-byte reproducible dependency tree. Commit it alongside `package.json`.
- Because the lockfile exists, you can use **`npm ci`** for a reproducible install; it is
  what the [`Dockerfile`](./Dockerfile) uses. Use `npm install` when you want to *update*
  dependencies.
- Note: the `lets-build-express/` subfolders each contain their own unrelated
  `package-lock.json`; those belong to the tutorial and are not used here.

---

## D. Build the TypeScript project

Afnkit is written in TypeScript; the runtime executes compiled JavaScript.

**PowerShell / macOS / Linux**
```bash
npm run build
```

What this does (from `package.json` → `scripts`):

- `build` → `tsc -p tsconfig.json` — compiles every file matched by `tsconfig.json`'s
  `include` (`src/**`, `tests/**`, `examples/**`) using the project's compiler options.

What `tsconfig.json` produces:

- **Output directory:** `dist/` (`"outDir": "dist"`).
- **Layout:** because `"rootDir": "."`, the source tree is mirrored under `dist/`. So:
  - `src/index.ts` → `dist/src/index.js`
  - `tests/chapter1.test.ts` → `dist/tests/chapter1.test.js`
  - `examples/basic.ts` → `dist/examples/basic.js`
- **Module format:** **CommonJS** (`"module": "commonjs"`) — the compiled output uses
  `require()`.
- **Extra output:** declaration files (`"declaration": true` → `.d.ts`) and source maps
  (`"sourceMap": true` → `.js.map`).
- **Target:** ES2022.

To confirm the build produced output:

**PowerShell**
```powershell
Get-ChildItem dist -Recurse -Name
```

**macOS / Linux**
```bash
ls -R dist
```

To delete build output and start over:

**PowerShell / macOS / Linux**
```bash
npm run clean
```

`clean` runs `node -e "require('node:fs').rmSync('dist',{recursive:true,force:true})"`,
which removes the whole `dist/` folder.

> **No `start` or `dev` script exists.** Running the example is done with `node` directly
> (see §E). Do not expect `npm start` to work.

---

## E. Run the project

There are two distinct ways to "run" Afnkit. Keep them separate:

1. **Running the example application** — `examples/basic.ts` starts a real HTTP server.
2. **Using Afnkit as a library** inside your *own* application (see §H).

### E.1 Run the example server

The example is TypeScript, so build it first (its compiled file lands in `dist/examples/`).

**Step 1 — build (if you have not already):**

**PowerShell / macOS / Linux**
```bash
npm run build
```

**Step 2 — start the example:**

**PowerShell / macOS / Linux**
```bash
node dist/examples/basic.js
```

- **Port:** the example calls `app.listen(3000, …)`, so it listens on **port 3000**. The
  startup line it prints is `Afnkit listening on http://localhost:3000`.
- **Interface:** `listen(3000, callback)` with no host uses Node's default (all
  interfaces), so `http://localhost:3000` works from your machine.

> **Direct execution of the `.ts` file is not documented here.** `examples/basic.ts`
> imports `../src/index` (also TypeScript) without file extensions, and the project is
> **not** configured for Node's native TypeScript execution. The supported, deterministic
> path is: build, then run the compiled `dist/examples/basic.js`. (Node's experimental
> type-stripping may or may not work here depending on your Node version — treat it as
> unverified.)

### E.2 Make requests to the running example

The example registers: `GET /`, `GET /json`, `POST /things`, plus a middleware that sets
`X-Powered-By: Afnkit` and an error-handling middleware.

**Browser:** open <http://localhost:3000/> and <http://localhost:3000/json>.

**PowerShell:**
```powershell
Invoke-RestMethod -Uri http://localhost:3000/
Invoke-RestMethod -Uri http://localhost:3000/json
Invoke-RestMethod -Method Post -Uri http://localhost:3000/things
```

**curl** (available as `curl.exe` on modern Windows, and `curl` on macOS/Linux):
```bash
curl http://localhost:3000/
curl http://localhost:3000/json
curl -X POST http://localhost:3000/things
```

**Expected bodies** (illustrative — based on the source, not executed):
- `GET /` → `Hello world!`
- `GET /json` → `{"hello":"world"}`
- `POST /things` → `{"created":true}` with status `201`

Requesting any other path returns a deliberate `404`, and using the wrong method on a
known path returns `405` (see §I).

### E.3 Stop the server

- In the terminal running `node dist/examples/basic.js`, press **Ctrl + C**.
- If the terminal is gone but the port is still busy, see §K ("Port already in use").

---

## F. Run automated tests

**PowerShell / macOS / Linux**
```bash
npm test
```

What this does (from `package.json`):

```
"test": "tsc -p tsconfig.json && node --test dist/tests/*.test.js"
```

1. **Compiles** the project with `tsc` (same as the build).
2. **Runs** Node's built-in test runner against the compiled tests in `dist/tests`.

The tests use only Node built-ins — `node:test`, `node:assert/strict`, `node:http`, and the
global `fetch` — so there is no test-framework dependency. The helper
`tests/helpers/http.ts` starts each app on an ephemeral port (`server.listen(0, …)`) and
exposes a `close()` that also calls `server.closeAllConnections?.()`; it is a support
module, not a test file.

### How the tests are organized

One file per tutorial chapter, each mirroring that chapter's behaviour:

| File | Focus (from its assertions) |
| --- | --- |
| `tests/chapter1.test.ts` | `express()` returns an `Application`; `app.get` is chainable and registers a route; non-function handlers throw `TypeError`; one router per app; `set`/`enabled`/`disabled` toggle without mutating; an app with no routes still answers `404`. |
| `tests/chapter2.test.ts` | Route matching by pathname; query string ignored; method isolation (GET vs POST); `405` + `Allow: GET` for a method mismatch; `404` for unknown paths. |
| `tests/chapter3.test.ts` | `next` runs remaining route handlers in order; `next` continues to a later layer on the same path; no handler runs after the response ended (with or without a trailing `next`); sync `next(err)` → `500`; rejected async handler → `500`. |
| `tests/chapter4.test.ts` | Middleware runs in registration order; `expressInit` attaches the extended response prototype; `res.app` links back to the app; exactly one `expressInit` layer; `handle` works before any route is registered; error-handling middleware receives `next(err)` and can set the status. |
| `tests/chapter5.test.ts` | `send(string)` content type; `send(object)` → JSON; `json()` keeps `application/json`; numbers/booleans produce a body; `send(null)` → empty body; `send(Buffer)` → `application/octet-stream`; `status().json()` chaining; correct `Content-Length`. |

### ⚠️ Pass/fail status

**The tests have not been executed.** This document does not claim they pass. Run
`npm test` yourself to see the result. If a step fails, start with §K.

---

## G. Type-checking and code quality

### Type-check without emitting files

**PowerShell / macOS / Linux**
```bash
npm run typecheck
```

From `package.json`: `typecheck` → `tsc -p tsconfig.json --noEmit`. This checks types using
the strict settings in `tsconfig.json` (`strict`, `noUnusedLocals`, `noImplicitOverride`,
`noFallthroughCasesInSwitch`) without writing to `dist/`.

### Linting

**There is no linter configured in this project.** There is no ESLint/Prettier/Biome
dependency and no `lint` script in `package.json`. Do not run `npm run lint` — it does not
exist. The only automated quality gate is the TypeScript compiler (build + type-check).

---

## H. How to use Afnkit

The public API is exported from `src/index.ts` and, when published, resolves to
`dist/src/index.js` (the `main` field): `express` (default and named), `Application`,
`createApplication`, `Router`, `Route`, `Layer`, `HttpError`, `finalHandler`,
`getPathname`, and the types `Request`, `Response`, `Handler`, `ErrorHandler`,
`NextFunction`.

### Minimal example (illustrative — not executed)

```ts
import { express, HttpError } from "afnkit";

const app = express();

// Middleware: runs for every request, in registration order.
app.use((req, res, next) => {
  res.setHeader("X-Powered-By", "Afnkit");
  next();
});

// A GET route.
app.get("/", (req, res) => {
  res.send("Hello world!");
});

// A JSON route.
app.get("/json", (req, res) => {
  res.json({ hello: "world" });
});

// A POST route with a status code.
app.post("/things", (req, res) => {
  res.status(201).json({ created: true });
});

// Error-handling middleware (four arguments) — see the arity note in §I.
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

**Status of this example:** *illustrative and unverified* — it reflects the real exports and
API shapes in `src/`, but it has not been run. A runnable variant already exists as
`examples/basic.ts` (which imports from `../src/index` because it lives inside this repo).

### Local vs. published usage

- **Inside this repository**, examples import the source directly:
  `import { express } from "../src/index";` (this is what `examples/basic.ts` does).
- **From another project**, you would `npm install afnkit` once the package is published,
  then `import { express } from "afnkit"`. The package `main` points at `dist/src/index.js`
  and `types` at `dist/src/index.d.ts`.
- **Module format:** the compiled output is **CommonJS**. From an ESM project, named
  imports generally work through Node's interop, but if you hit issues, import the default
  and destructure, or use `createRequire`. (Unverified — depends on your consumer setup.)

---

## I. Supported functionality

Confirmed by reading `src/`. Everything below is implemented in the current code.

**Application & registration**
- `express()` factory returning an `Application` (also exported as `createApplication`).
- HTTP method helpers: `get`, `post`, `put`, `delete`, `patch`, `options`, `head`,
  `connect`, `trace`, and `all`. Registration methods return the app (chainable).
- Settings: `app.set(name, value)`, `app.enabled(name)`, `app.disabled(name)` (do not
  mutate the stored value).
- `app.listen(port[, host][, callback])` returning the underlying `http.Server`, and
  `app.handle(req, res[, out])`.

**Routing**
- **Exact-string path matching** on the pathname; the **query string is ignored** for
  matching.
- **Method-aware dispatch:** a handler runs only for its registered method (or `all`).
- A known path with the wrong method returns **`405 Method Not Allowed`** with an
  **`Allow`** header listing the registered methods; a genuinely unknown path returns
  **`404`**.

**Middleware**
- `app.use(handler)` registers a middleware function; middleware matches every path and
  runs in registration order (the internal `expressInit` runs first).
- **Error-handling middleware** is any handler declared with **four parameters**
  (`err, req, res, next`). It receives values passed to `next(err)`.

**`next` semantics**
- `next()` advances to the next matching handler — **exactly one handler per `next()`
  call**.
- If the response has already ended, dispatch stops: no further handlers run (even if a
  late `next()` is called).

**Error handling**
- **Synchronous throws** inside a handler and **rejected promises** returned by a handler
  are both forwarded to `next(err)`.
- `HttpError(status, message?)` carries a status; `expose` is `true` for statuses below
  `500` (message shown to the client) and `false` otherwise (generic message; the error is
  logged via `console.error`).
- The terminal `finalHandler` produces a response for every request and never hangs.

**Response helpers** (`app.response`, attached per request by `expressInit`)
- `res.status(code)` — sets the status code and returns `res` (chainable).
- `res.send(body)` — handles **string** (`text/html; charset=utf-8`), **Buffer**
  (`application/octet-stream`), **object/array** (serialized to JSON), and
  **number/boolean/bigint** (stringified); `null`/`undefined` produce an empty body.
- `res.json(body)` — serializes with `JSON.stringify` and sets
  `application/json; charset=utf-8`.
- A content type is set **only if the caller has not already set one**, so `json()` cannot
  be clobbered by `send()`. `Content-Length` is set when absent. `HEAD` requests that reach
  `send` receive headers only.

**Request/response extension**
- `expressInit` points each live `req`/`res` at `app.request` / `app.response` via the
  prototype chain, so extensions are defined once and shared per request, without mutating
  Node's global prototypes. `req.app` / `res.app` link back to the application.

**Terminal responses**
- `404 Not Found` (nothing matched), `405 Method Not Allowed` (+ `Allow`) for a method
  mismatch, the `4xx` carried by an `HttpError`, or a generic `500 Internal Server Error`.

**Packaging**
- **Zero runtime dependencies**; the only dev dependencies are `typescript` and
  `@types/node`.

---

## J. Current limitations

Deferred or unsupported by design (see [`DESIGN.md`](./DESIGN.md) "Non-goals" and
[`walkthrough.md`](./walkthrough.md) "Known limitations"):

- **Path matching is exact-string only.** No route parameters (`/users/:id`), no wildcards,
  no regular expressions. `req.params` exists in the type but is **not populated**.
- **No path-prefixed `app.use("/prefix", fn)`** — middleware always matches every path.
- **`app.use` takes a single handler per call.** It does not accept an array or multiple
  handlers; call it repeatedly instead.
- **No query-string parsing.** `req.query` is not implemented (the query string is only
  ignored for matching).
- **No request-body parsing.** `req.body` is not implemented; the framework does not read
  the request stream for you.
- **No implicit `HEAD` → `GET` mapping.** A `GET`-only route answers `HEAD` with `405`.
  (`send` handles `HEAD` only when a `HEAD` handler actually reaches it.)
- **No content negotiation, ETag, `res.redirect`, `res.sendFile`, static file serving,
  cookies, sessions, or template/view engines.**
- **No sub-application mounting** (`app.use(subApp)`): the app is a class instance, not a
  callable function, so it cannot be mounted as middleware.
- **No `next` double-call guard** within a single handler tick.
- **Error-handler detection is by arity (exactly four declared parameters).** Default
  parameters or `...rest` change `fn.length` and will defeat detection.
- **No production hardening** (rate limiting, security headers, body-size limits) and no
  built-in CORS.

---

## K. Troubleshooting

**`node` or `npm` is not recognized**
- Node.js/npm are not installed (or not on your `PATH`). Install the LTS from
  <https://nodejs.org/>, then **reopen the terminal** and check `node --version`.

**`Cannot find module ...` / `tsc is not recognized` / `Cannot find type definition file for 'node'`**
- Dependencies are not installed. From the project root run `npm install`. This installs
  `typescript` and `@types/node` locally; the scripts use the local copy, so a global
  TypeScript install is not needed.

**`npm ERR! Could not read package.json` / `ENOENT ... package.json`**
- You are in the wrong directory. `cd` into the folder that contains `package.json`
  (the project root) and retry.

**`EADDRINUSE` / "port 3000 is already in use"**
- Another process is using port 3000. Either stop it, or change the port.
  - Find the owning process:

    **PowerShell**
    ```powershell
    Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess
    ```

    **macOS / Linux**
    ```bash
    lsof -i :3000
    ```
  - Stop it (**PowerShell**): `Stop-Process -Id <pid>`.
  - Or edit `app.listen(3000, …)` in `examples/basic.ts`, change the port, then
    `npm run build` again.

**`SyntaxError: Cannot use import statement outside a module` (when running an example)**
- You are running a `.ts` file directly instead of the compiled `.js`. Run
  `npm run build` first, then `node dist/examples/basic.js`. The project compiles to
  CommonJS; run the output under `dist/`.

**Import / module-format mismatches when consuming Afnkit**
- The build is CommonJS. If your *own* project is ESM (`"type": "module"`), named imports
  usually work via Node interop; if not, import the default export and destructure, or use
  `createRequire`. Ensure you installed/built Afnkit and are importing `"afnkit"` (which
  resolves to `dist/src/index.js`), not a source path.

**TypeScript compilation errors (e.g. "possibly undefined", "unused variable")**
- The project is **strict**: `strict`, `noUnusedLocals`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`. Run `npm run typecheck` for a fast check. Fix the reported
  type errors; do not weaken `tsconfig.json` to silence them.

**Tests fail, or `fetch is not defined`**
- `npm test` compiles first, so a compile error will fail the whole command — fix any
  TypeScript error and retry.
- The tests rely on the global **`fetch`**, which exists in Node **18+**. On older Node,
  `fetch` is undefined and tests will error; upgrade Node.

**`dist/` is missing or stale**
- Run `npm run build`. To start clean, `npm run clean` (removes `dist/`) and rebuild.

**`npm ci` fails**
- `npm ci` requires a `package-lock.json` in the project root. One is present here, so use
  `npm ci` for a reproducible install. If it is missing (for example, a fresh clone without
  the lockfile), run `npm install` once to generate it, commit it, then use `npm ci`.

---

## L. Development workflow

Recommended sequence for a contributor working on the framework:

1. **Set up once.** From the project root: `npm install`.
2. **Build.** `npm run build` (compile `src/`, `tests/`, `examples/` to `dist/`).
3. **Run the tests.** `npm test` (compiles, then runs the suite). Optionally
   `npm run typecheck` for a fast, emit-free check.
4. **Run the example.** `node dist/examples/basic.js`, then hit
   <http://localhost:3000/> (stop with Ctrl + C).
5. **Make changes** to the framework in `src/` (and update `DESIGN.md` / `walkthrough.md`
   when behaviour or decisions change).
6. **Add or update tests** in `tests/` for the behaviour you changed, then re-run
   `npm test`.
7. **Update documentation** (`README.md`, `DESIGN.md`, `walkthrough.md`, and this
   `RUNNING.md`) so it stays accurate.

### Preserve the reference material

Two things must **not** be modified as part of routine framework development:

- **`lets-build-express/`** — the third-party tutorial embedded as a read-only study
  reference. It is not built, imported, or run by Afnkit.
- **`forensic.md`** — the forensic audit of the original tutorial, kept as the defect
  baseline. Treat it as a fixed record.

Treat both as historical/reference documents. All Afnkit development happens in `src/`,
`tests/`, `examples/`, and the project's own docs.

---

## M. Docker

The repository ships a multi-stage [`Dockerfile`](./Dockerfile) and a
[`.dockerignore`](./.dockerignore) at the root. They containerize the **example
application** (`examples/basic.ts`), which listens on **port 3000**.

> **Verified.** The Docker commands in this section were executed on the machine where
> this section was written, using **Docker Desktop 29.7.2** (Linux containers) and the
> `node:22-alpine` base image. The image built successfully, the container served the
> expected responses, and it stopped cleanly. Node.js is **not** required on the host to
> *run* the image — the container carries its own runtime.

### M.1 How the image is built (architecture)

- **Build stage** (`node:22-alpine`): copies `package.json` + `package-lock.json`, runs
  `npm ci` (reproducible; the dev dependencies `typescript`/`@types/node` are needed to
  compile), copies `tsconfig.json`, `src/`, `examples/`, `tests/`, then runs
  `npm run build` (`tsc -p tsconfig.json` → `dist/`).
- **Runtime stage** (`node:22-alpine`): installs **tini** (a tiny init that forwards
  `SIGTERM`/`SIGINT` so `docker stop` shuts the server down cleanly), copies only
  `dist/src/` and `dist/examples/` (the compiled files the server needs) plus
  `package.json`, switches to the unprivileged **`node`** user, and starts the server with
  `node dist/examples/basic.js`.
- **No `node_modules` in the runtime image:** Afnkit has **zero runtime dependencies**, so
  none are installed or copied into the final image.

### M.2 Prerequisites

- **Docker Desktop** installed and **running**.
  - Download: <https://www.docker.com/products/docker-desktop/>
  - After installing, launch **Docker Desktop** and wait until it reports the engine is
    running (the tray whale icon stops animating).

Verify the CLI can reach the daemon:

**PowerShell**
```powershell
docker version
docker info --format '{{.ServerVersion}}'
```

If `docker info` prints `failed to connect ... dockerDesktopLinuxEngine`, Docker Desktop is
**not running** — start it, wait for the engine, then retry (see §M.11).

### M.3 Build the image

Run from the project root (the folder containing `Dockerfile`):

**PowerShell**
```powershell
docker build -t afnkit:local .
```

- `-t afnkit:local` names the image `afnkit` with the tag `local`.
- `.` is the build context (the project root); `.dockerignore` keeps `node_modules/`,
  `dist/`, `.git/`, `*.md`, and `lets-build-express/` out of it.

The first build pulls `node:22-alpine` and takes a few minutes. Confirm the image exists:

**PowerShell**
```powershell
docker images afnkit:local
```

### M.4 Run the container (host 3000 → container 3000)

**PowerShell**
```powershell
docker run -d --name afnkit-local -p 3000:3000 afnkit:local
```

- `-d` runs it detached (in the background).
- `--name afnkit-local` gives the container a fixed name (used to stop it later).
- `-p 3000:3000` maps **host** port 3000 to **container** port 3000.

Check it is running:

**PowerShell**
```powershell
docker ps
```

If host port 3000 is already in use, `docker run` fails with a bind error — see §M.11.

### M.5 Open the app

In a browser, go to <http://localhost:3000/>.

### M.6 Test the endpoints

The example registers `GET /`, `GET /json`, and `POST /things`.

**PowerShell (`curl.exe` is bundled with modern Windows):**
```powershell
curl.exe -i http://localhost:3000/
curl.exe -i http://localhost:3000/json
curl.exe -i -X POST http://localhost:3000/things
curl.exe -i http://localhost:3000/does-not-exist
```

Expected results (confirmed against the running container):

| Request | Status | Body | Notes |
| --- | --- | --- | --- |
| `GET /` | `200 OK` | `Hello world!` | `Content-Type: text/html; charset=utf-8` |
| `GET /json` | `200 OK` | `{"hello":"world"}` | `Content-Type: application/json; charset=utf-8` |
| `POST /things` | `201 Created` | `{"created":true}` | `Content-Type: application/json; charset=utf-8` |
| `GET /does-not-exist` | `404 Not Found` | `404 Not Found` | deliberate 404 — the request does not hang |

Every response includes `X-Powered-By: Afnkit`. A wrong method on a known path returns
`405 Method Not Allowed` with an `Allow` header, for example
`curl.exe -i http://localhost:3000/things`.

> **Browser vs. `curl`:** a browser can only issue `GET`, so use `curl.exe` (or
> PowerShell) for the `POST /things` check.

### M.7 View container logs

**PowerShell**
```powershell
docker logs afnkit-local
# follow in real time:
docker logs -f afnkit-local
```

The startup line is `Afnkit listening on http://localhost:3000`. Internal server errors
(`500`) are also logged here, because the framework logs them with `console.error`.

### M.8 List running containers

**PowerShell**
```powershell
docker ps
# all containers, including stopped ones:
docker ps -a
```

### M.9 Stop and remove the container

**PowerShell**
```powershell
docker stop afnkit-local
docker rm afnkit-local
```

Or, in one step:

**PowerShell**
```powershell
docker rm -f afnkit-local
```

`docker stop` sends `SIGTERM`; tini forwards it to Node, which exits immediately
(verified: well under a second). To also remove the image:

**PowerShell**
```powershell
docker rmi afnkit:local
```

### M.10 Rebuilding after source changes

The image contains a **snapshot** of the compiled code, so after editing anything under
`src/` (or `examples/`), rebuild and restart:

**PowerShell**
```powershell
docker rm -f afnkit-local
docker build -t afnkit:local .
docker run -d --name afnkit-local -p 3000:3000 afnkit:local
```

The build reuses cached layers for unchanged files (for example, `npm ci` is skipped unless
`package.json`/`package-lock.json` change), so rebuilds are fast.

### M.11 Troubleshooting

**`failed to connect ... dockerDesktopLinuxEngine` (Docker Desktop not running)**
- Docker Desktop is not started, or not finished starting. Launch **Docker Desktop**, wait
  for the engine to be ready, and verify with `docker info --format '{{.ServerVersion}}'`.
  Having the Docker CLI installed (`docker --version` works) does **not** mean the engine is
  running.

**`docker: command not found`**
- Docker Desktop is not installed, or not on `PATH`. Install it from
  <https://www.docker.com/products/docker-desktop/>, then reopen the terminal.

**Port conflict: `port is already allocated` / `address already in use`**
- Host port 3000 is taken (a stale `afnkit-local` container, the Node dev server, etc.).
  - Find what is using it:

    **PowerShell**
    ```powershell
    Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess
    ```
  - Remove a stale container: `docker rm -f afnkit-local`.
  - Or map a different host port, for example `-p 8080:3000`, and use
    <http://localhost:8080/> instead.

**Image runs but the browser cannot connect**
- Confirm the container is up and mapped: `docker ps` (look for `0.0.0.0:3000->3000/tcp`).
- Read the logs: `docker logs afnkit-local`.
- Make sure you passed `-p 3000:3000`; `EXPOSE` in the Dockerfile is documentation only and
  does not publish the port by itself.

**`docker build` fails at `npm ci`**
- A lockfile/`package.json` mismatch or a network problem. Retry the build; if it persists,
  run `npm install` on the host to refresh `package-lock.json`, then rebuild.

**Container exits immediately**
- Check `docker logs afnkit-local`. The entry point is `node dist/examples/basic.js`; if the
  build did not produce `dist/`, the container fails to start — rebuild the image.

---

## Quick reference

| Goal | Command | Run from |
| --- | --- | --- |
| Install dependencies | `npm install` | project root |
| Compile to `dist/` | `npm run build` | project root |
| Type-check only | `npm run typecheck` | project root |
| Run tests | `npm test` | project root |
| Run the example server | `node dist/examples/basic.js` | project root (after build) |
| Remove build output | `npm run clean` | project root |
| Stop the example server | `Ctrl + C` | the terminal running it |
| Build the Docker image | `docker build -t afnkit:local .` | project root |
| Run in Docker | `docker run -d --name afnkit-local -p 3000:3000 afnkit:local` | project root (or anywhere) |
| View Docker logs | `docker logs afnkit-local` | anywhere |
| Stop and remove the container | `docker rm -f afnkit-local` | anywhere |

> **Reminder:** the non-Docker commands above were not executed while writing this file;
> they are derived from `package.json`, `tsconfig.json`, and the source, and remain
> **unverified** until you run them. The Docker commands *were* executed and verified — see
> §M.

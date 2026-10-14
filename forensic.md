Forensic Repository Audit — lets-build-express

1. Executive verdict
   This repository is an unmodified clone of the public tutorial repository antsmartian/lets-build-express (origin historically antoaravinth/lets-build-express). Evidence: git remote -v → https://github.com/antsmartian/lets-build-express, git status is clean, and HEAD (5a3ba64) equals origin/master; the most recent commit is authored by the upstream maintainer antsmartian <anto.aravinth.cse@gmail.com> (2023-11-25). There are no user-authored commits and no local modifications.
   It is a teaching project: five chapters that incrementally re‑implement a minimal subset of Express (express() factory, Router, Route, Layer, next, and res.send/res.json). The five shipped chapters exist, are internally coherent, and—verified dynamically—actually run and serve HTTP responses. However:

- It is not a working mini‑Express: HTTP method matching is absent, not‑found requests never respond, errors are swallowed, the chapter‑05 next gating is broken, and res.json emits text/plain.
- There are zero automated tests; npm test is the default npm failing stub.
- Dependencies are not installed, so nothing runs out of the box without npm install (which this audit forbids).
  For a learning artifact, this is a solid tutorial. For a portfolio project presented as original work, it is not credible as‑is. See §10–§11.

2. Actual repository structure
   Git‑tracked files (54 total). node_modules is not tracked at HEAD (it was committed then deleted historically — visible in git log --stat on chap05), and no node_modules directory exists on disk.
   lets-build-express/
   ├── .gitignore (only .idea / .DS_Store)
   ├── LICENSE.md (MIT template, placeholders unfilled)
   ├── README.md (TOC + "minimal working library … is done")
   ├── chap01/ CHAP01.md, index.js, package.json, package-lock.json, src/{app,express,Layer,route,router}.js
   ├── chap02/ … same 5 src files
   ├── chap03/ … same 5 src files
   ├── chap04/ … same 5 src files + src/middleware/init.js
   └── chap05/ … same 5 src files + src/middleware/init.js

- No chap06/ (README lists "Chapter 06 -- Error Handling (WIP)").
- No test/spec files, no fixtures, no CI config, no linter/prettier config, no root package.json.
- Five separate node_modules-ignoring .gitignore files (one per chapter) plus a minimal root .gitignore.
- Presence/relevance of generated dirs: node_modules referenced by history and .gitignore but absent; no build output or caches present.
  Environment: node v25.9.0, npm 11.12.1, git 2.54.0.windows.1.

3. Chapter‑by‑chapter audit
   Each chapter is self‑contained (its own src/), and later chapters copy earlier files and modify them. Differences were verified against source, not filenames.
   Chapter 01 — "Building Express Abstractions" (chap01/)

- Purpose (CHAP01.md:3): create abstractions; "a very minimal library, which will match only one route."
- Concept: express() factory + mixin of an application prototype; a single Router; Route/Layer; app.listen.
- Flow: express.js:6-15 createApplication → app.init() (app.js:10-16) → app.get (app.js:57-66) calls lazyrouter() (app.js:40-44) → router.route(path) (router.js:24-34) creates Route + Layer and pushes to router.stack.
- Handle: router.handle (router.js:36-42) ignores the request path and always executes stack[0].route.stack[0].handle_request(req,res).
- New vs reused: all new. Uses methods, merge-descriptors, setprototypeof, array-flatten (listed but array-flatten first used in route.js:19).
- Incomplete/placeholder: Route.prototype.dispatch is an empty function (route.js:13-15); Layer.path is never assigned (Layer.js:11); app.handle ignores its callback argument (app.js:51-55).
- Matches purpose? Yes for index.js. Verified: GET /, /anything, /nope all return Hello world! (path ignored) — consistent with the documented limitation.
  Chapter 02 — "Handling routes out of the box" (chap02/)
- Purpose (CHAP02.md:1): make route matching stable.
- New: parseurl for pathname (router.js:66-72), a while‑loop matcher (router.js:48-63), Layer.match comparing this.route.path === path (Layer.js:15-17), matchLayer wrapper (router.js:74-80).
- Matches purpose? Yes: distinct paths resolve. Verified: /→"Hello world from /", /2→"Hello world from /2", POST /post→"Data from post :)".
- Important gap vs. docs: CHAP02.md:114-131 implies POST routing works; but Route.methods is recorded (route.js:33) and never checked. Verified: GET /post also returns "Data from post :)".
- Missing: no not‑found response — Verified: GET /missing never responds (client times out).
  Chapter 03 — "Implement next function" (chap03/)
- Purpose (CHAP03.md:1): build next to resume the stack.
- New: handle now defines a closure next() and passes it to handle_request (router.js:37-68, esp. :65). Layer.handle_request already forwarded next (Layer.js:19-27).
- Matches purpose? Yes. Verified: two separate app.get('/') layers chain correctly; first logs, second sends "Response from second matching route".
- Note: still only route.stack[0] runs (router.js:65), so multiple callbacks on one app.get(path, a, b) are ignored at this stage.
  Chapter 04 — "Extending Response Object" (chap04/)
- Purpose (CHAP04.md:1): lay groundwork for res.send by extending the response prototype per request.
- New: router.use (router.js:37-44); lazyrouter installs middleware (app.js:41-46); src/middleware/init.js sets res prototype to app.response via setprototypeof (init.js:5); express.js builds app.request/app.response from http.IncomingMessage/ServerResponse prototypes and attaches a dummy res.send that only console.logs (express.js:17-19); Layer.match gains an expressInit special case (Layer.js:15-23); the if(match) layer.handle_request(...) branch handles non‑route layers (router.js:77-79).
- Matches purpose? Yes. Verified: debug log wow, hello world; client receives the earlier res.write body.
- New vs reused: introduces the middleware concept but only for internal expressInit.
- Defects introduced: lazyrouter re‑installs expressInit on every call (see §7); the magically string‑matched name === "expressInit" is fragile; app.request is created but never wired (init only sets the res prototype).
  Chapter 05 — "Implementing send/json" (chap05/)
- Purpose (CHAP05.md:1): implement res.send for strings and JSON, add res.json.
- New: real res.send/res.json (express.js:17-32); router.handle now loops all handlers of a matched route with for (const stack of route.stack) (router.js:74-76); index.js demonstrates multi‑callback middleware.
- Matches purpose? Partially. String/JSON bodies are emitted, but res.json and res.send(object) end up with Content-Type: text/plain because json() calls send(string), which overwrites the header (express.js:29-32 → :21-24). Verified: body {"hello":"world"}, header text/plain.
- New defect: the for...of loop ignores next() gating. Verified: with app.get('/a2', h1, h2) where h1 ends the response without next(), h2 still runs and throws ERR_HTTP_HEADERS_SENT (caught and logged).
- res.send gaps: numbers/booleans/Buffers fall through with no response at all. Verified: res.send(42) → client never receives a response; res.send(null) → body "null"; res.send({a:1}) → JSON text with text/plain.

4. Architecture and request lifecycle
   Traced end‑to‑end from the actual source (line refs use chap05 unless noted):
1. app.listen(port) → http.createServer(this) where this is the app function (app.js:48-51). Node's ServerResponse/IncomingMessage are passed as req/res.
1. app(req,res) → app.handle(req,res,next) (express.js:8-10).
1. app.handle (app.js:53-57) reads this.\_router and calls router.handle(req,res). It does not call lazyrouter, and does not forward next/out.
1. router.handle (router.js:46-83) defines a closure next() and immediately invokes it.
1. next() parses the pathname with parseurl (getPathname, router.js:85-91) and walks this.stack from a shared idx.
1. For each layer, matchLayer → Layer.match (Layer.js:15-23). A layer matches if its route.path === path, or if its name === 'expressInit'.
1. Route layer → runs the route's handler(s): chap01/02/03/04 run route.stack[0]; chap05 runs every handler in route.stack (router.js:74-76).
1. Non‑route matching layer (the expressInit middleware) is executed via if (match) layer.handle_request(...) after the loop (router.js:79-81); its handler sets res's prototype to app.response and calls next().
1. Route/layer invocation goes through Layer.handle_request (Layer.js:25-33): try { fn(req,res,next) } catch (err) { console.error(err) }.
1. Response uses raw Node methods (res.writeHead/write/end) or the extended res.send/res.json, which chain to the real ServerResponse via the prototype set in step 8.
   Key architectural facts:

- One Router per app (lazyrouter); Router is a callable function with proto as its prototype; stack is the single source of truth.
- Route layers hold a route; middleware layers do not. route.dispatch—used as the layer handle—is an empty function (route.js:13-15), so the layer's own handle is a no‑op; the real work happens because router.handle reaches into layer.route.stack directly.
- Per‑request state (idx, match, path) is local to each handle/next invocation, so concurrent requests do not share iteration state (inference; only sequential multi‑request behavior was executed).

5. Feature verification matrix
   Legend: ✅ Implemented & verified · 🟡 Partial · ❌ Missing · N/A.
   Feature Status Evidence / notes
   Node http server integration (listen) ✅ app.js:48-51; harness served real HTTP on ephemeral ports
   App init + exported factory API ✅ express.js:6-15, app.js:10-16
   Path matching ✅ router.js+Layer.match; /, /2 verified
   HTTP method matching ❌ Route.methods set (route.js:33) never consulted; GET /post ran the POST handler (verified)
   Route registration ✅ app[method] → router.route
   Route dispatch via route.dispatch ❌ empty placeholder (route.js:13-15); bypassed by direct stack access
   Middleware registration (router.use) 🟡 router.js:37-44; only used internally for expressInit, no public app.use
   Middleware execution order 🟡 expressInit runs first; but duplicated per route registration (see §7)
   Request object extension (app.request) ❌ created (express.js:34-38) never applied
   Response object extension (app.response) ✅ init.js:5; res.send/res.json reachable (verified)
   Request parsing (path/query/body) 🟡 pathname via parseurl; req.query/body not parsed
   Response serialization (send/json) 🟡 works for string; JSON content‑type wrong; numbers hang
   Error handling / propagation ❌ sync errors only console.error (Layer.js:25-33); no 500; no next(err)
   Async handlers ❌ returned promise rejection unhandled — verified unhandledRejection: "async-boom"
   Route parameters (:id) ❌ none
   Query strings 🟡 only stripped by parseurl; not exposed
   Not‑found behavior ❌ no final handler; verified client timeout
   Multiple requests ✅ verified sequentially; concurrency safe by construction (unverified concurrently)
   next semantics 🟡 works ch03/04 and across route layers; broken gating in ch05 (router.js:74-76)
   TypeScript types/generics N/A plain JS project
   Answer HEAD/OPTIONS correctly ❌ no implicit handling
6. Tests and execution results
   Existing tests: none. package.json (all five chapters) declares the default stub:
   "scripts": { "test": "echo \"Error: no test specified\" && exit 1" }
   Commands run and actual outcomes:
   Command Working dir Outcome
   git status --short repo root (empty) clean
   git log --oneline -10 repo root upstream commits only; HEAD 5a3ba64 == origin/master
   node index.js chap01/ Error: Cannot find module 'merge-descriptors' (MODULE_NOT_FOUND), exit 1
   npm test chap01/ Error: no test specified, exit 1
   node audit-harness.js temp Full run of all chapters, see below
   Blocker: dependencies are not installed and there is no npm install/run documentation; installing is prohibited by the audit brief. To obtain real execution evidence I loaded the unmodified chapter sources and injected faithful runtime shims for the five small dependencies, reconstructed verbatim from the versions committed to git history (chap05/node_modules/... at commit 5e58bc9): array-flatten@2.1.1, methods (from http.METHODS), parseurl, merge-descriptors, setprototypeof. No repo file was changed and nothing was installed. (This is verification, not the project's own test suite.)
   Harness results (actual output):

- chap01: GET /, /anything, /nope → 200 Hello world! (path ignored).
- chap02: GET /→Hello world from /; /2→…/2; POST /post→Data from post :); GET /post→Data from post :) (method not enforced); GET /missing→ no response (timeout).
- chap03: GET / → Response from second matching route (next works).
- chap04: GET / → body correct + console wow, hello world.
- chap05: GET / → body {"hello":"world"}, Content-Type: text/plain.
- chap05 probes: send(42)→no response; send(null)→null text/plain; send({a:1})→{"a":1} text/plain; send('hi')→text/plain; json→text/plain.
- chap05 app.get('/a2', h1, h2) with h1 not calling next: logs H1 and H2, then ERR_HTTP_HEADERS_SENT (caught) → next gating broken.
- sync throw → console.error Error: sync-boom, client no response.
- async throw → client no response; unhandledRejections captured: ["async-boom"].
- app.enabled('anything') → true; enabled('x') after set('x', false) → true; settings.anything mutated to undefined.
- app.handle with no registered routes → TypeError: Cannot read properties of undefined (reading 'handle').
- router.stack after 3 registrations: [expressInit, route '/', expressInit, route '/', expressInit, route '/post'] → one duplicated init layer per route.
  Important behaviors with no tests: method dispatch, not‑found, error propagation, async errors, next semantics, send edge types, json content‑type, concurrent requests, header correctness.

7. Confirmed defects and potential risks
   Confirmed defects
   D1 — HTTP method is ignored (Critical).
   router.js matches only route.path (matchLayer, e.g. chap02 router.js:74-80; Layer.match, Layer.js:15-17). Route.methods is populated (route.js:33) but never read. Impact: GET /post executes the POST handler; a GET route answers POST; no 405. Verified. Remediation: in dispatch, skip handlers whose layer.method doesn't equal req.method (and answer 405/404 when none match).
   D2 — No not‑found handling; request hangs (Critical).
   router.handle has no terminal out/404 handler (router.js:46-83); app.handle doesn't forward a callback (app.js:53-57). Impact: unknown paths leave the socket open indefinitely. Verified. Remediation: add a final layer that sends 404 (and optionally next(err)).
   D3 — next gating broken in chapter 05 (High, regression introduced by commit "apply multi middlewares").
   router.js:74-76 iterates all route.stack handlers synchronously, ignoring whether next() was called. Impact: middlewares after a response are still executed → ERR_HTTP_HEADERS_SENT. Verified. Remediation: restore single‑handler dispatch (route.stack[0]) or implement Route.dispatch that advances one handler per next.
   D4 — res.json/res.send(object) emit Content-Type: text/plain (High).
   json() sets application/json then delegates to send(string), which overwrites it (express.js:21-24, :29-32). Impact: clients receive JSON labelled as plain text. Verified. Remediation: set the header in send only when not already set, or have json call this.end(JSON.stringify(...)) directly.
   D5 — res.send produces no response for numbers/booleans/Buffers (High).
   Only object/string branches exist (express.js:17-26). Impact: res.send(42) hangs the client. Verified. Remediation: handle Buffer, number, boolean, and undefined.
   D6 — Duplicate expressInit middleware on every route registration (Medium).
   lazyrouter always calls this.\_router.use(middleware.init(this)) even when the router already exists (app.js:41-46). Verified: 3 registrations → 3 init layers. Impact: redundant middleware execution; misleading stack. Remediation: install init only when creating the router.
   D7 — No error handling; sync errors swallowed, async rejections unhandled (High).
   Layer.handle_request only console.errors (Layer.js:25-33); no next(err), no 500; async throws become unhandled rejections (verified), which terminate modern Node by default. Remediation: catch and forward via next(err); add an error‑handling layer.
   D8 — app.enabled is always truthy and mutates settings (Medium).
   return Boolean(this.set(setting)) (app.js:37-39) always returns true because set returns this, and it writes settings[setting] = undefined. Verified. Remediation: return Boolean(this.settings[setting]).
   D9 — app.handle throws if called before any route registration (Medium).
   No lazyrouter() in handle (app.js:53-57); verified TypeError. Remediation: call this.lazyrouter() in handle.
   D10 — Dead/placeholder code presented as mechanism (Low/Informational).
   route.dispatch empty (route.js:13-15); Layer.path never set (Layer.js:11); app.request built but unused (express.js:34-38); unused imports (setprototypeof, Layer in several app.js). Impact: misleading to readers/interviewers.
   D11 — Packaging/metadata errors (Low).
   package.json name is "chap01" in all five chapters (chap05 package.json:2); express@^4.16.3 is a dependency but never required by any source file (verified by grep of all require calls); no start script; test is the failing stub. Impact: confusing, non‑reproducible setup.
   D12 — LICENSE.md placeholders unfilled (Low).
   LICENSE.md:3 → Copyright (c) [year] [fullname].
   Potential risks (need further verification / not exercised)

- Duplicate expressInit + name === 'expressInit' matching (Layer.js:18) is brittle: any middleware named expressInit would match every path.
- Concurrency was only verified sequentially; design looks safe for current features (no shared per‑request vars), but route params (unimplemented) would introduce shared layer.params races.
- Layer.handle_request uses this.handle, so any layer whose handle is not the intended function silently no‑ops rather than erroring.
- Doc/impl drift (below) means some documented behaviors cannot be reliably verified.

8. Documentation accuracy
   Claim Location Supported?
   Five chapters build Express step by step with running examples README.md:8-16 ✅ per chapter
   Chapter 01 matches "only one route" CHAP01.md:3 ✅ verified
   Chapter 02 adds route matching; POST example works CHAP02.md:16,114-131 🟡 matching ✅, but method routing implied and not implemented
   Chapter 03 builds next CHAP03.md ✅ verified for ch03/04
   Chapter 04 extends res prototype CHAP04.md ✅ verified (dummy send logs)
   Chapter 05 sets application/json for JSON CHAP05.md:26-45,106-114 ❌ actual header is text/plain
   "minimal working library and the corresponding tutorial is done" README.md:21 ❌ method dispatch, 404, and error handling absent
   Chapter 06 Error Handling (WIP) README.md:17 ❌ directory absent
   "Each chapter will build express step by step" README.md:8 ✅
   MIT license README.md:26-27 🟡 template present but placeholders unfilled
   Setup/execution reproducibility: incomplete. There is no root README instruction to cd chapXX && npm install && node index.js; every chapter's package.json name is chap01; express is an unused dependency; there is no start script; npm test fails by default. The chapter docs do tell readers to "run index.js" (CHAP01.md:433) but not how to install dependencies. Doc code snippets also diverge from committed source in places (e.g., CHAP01.md's handle vs. actual; chap04 doc omits app.request). Where the docs don't specify behavior (e.g., 404, route params), it is marked unspecified, not a defect.
9. Completion scorecard
   Scale: 0 absent · 1 placeholder · 2 substantially incomplete · 3 functional baseline with gaps · 4 strong with limited gaps · 5 thorough + verified.
   Dimension Score Justification
   Chapter implementation completeness 3 All five shipped chapters exist and run; each matches its incremental goal. But chapter 06 is absent and chapter‑level behavior diverges from docs (json content‑type, implied method routing).
   Core functionality 3 Path routing, next, middleware init, and string send work; method dispatch, 404, query/params, error handling missing.
   Correctness 2 Multiple confirmed defects (D1–D9), including two that break core HTTP semantics (methods, no‑response).
   Test coverage & verification 1 Zero automated tests; npm test is the failing default. Only manual index.js examples.
   Error handling & edge cases 1 Sync errors swallowed, async rejections unhandled, no 404, no error middleware.
   Code organization & maintainability 3 Clean, Express‑mirroring module layout; but duplicated code across chapters, dead code, magic string matching, wrong package names.
   Type safety N/A JavaScript only; no TS. Not applicable to this repo.
   Documentation & reproducibility 3 Chapters are readable and instructive; but no setup instructions, stale TOC/license, doc drift, and non‑reproducible without manual install.
   Security awareness 2 Toy surface (no body parsing), but no input validation, no limits, no error hygiene; no evidence of security consideration.
   Portfolio readiness 1 Verbatim upstream clone with zero original commits; unsuitable to present as original work as‑is.
   Do not average these. The project can have good docs yet still be functionally incomplete.
   Three verdicts
10. Repository completion (vs. documented scope): Partially ready. The five finished chapters are present and functional, but the advertised "working library" lacks method dispatch and not‑found handling, and the explicitly promised error‑handling chapter is missing.
11. Technical verification: Partially ready. I independently exercised the real code (shimmed deps) and confirmed the core path/next/send claims plus several bugs, but the repository ships no tests, and several documented claims are unverified or contradicted.
12. Portfolio readiness: Not ready. As committed, it is an unmodified third‑party tutorial clone (no user commits, clean tree at origin/master). It demonstrates reading comprehension of a tutorial, not original engineering, and cannot be defended as the candidate's own work.
13. P0–P3 remaining‑work backlog
    P0 — Required for correctness (core doesn't work as intended)
14. Method‑aware dispatch. Where: router.js dispatch + Layer/Route. Why: GET/POST are indistinguishable. Verify: GET /post → 404 while POST /post → 200. Accept: handlers only run for matching req.method; non‑matching → 404/405.
15. Not‑found termination. Where: router.handle/app.handle. Why: unknown paths hang. Verify: GET /missing returns 404 within a fixed time. Accept: every request gets a response.
16. Fix chapter‑05 next gating. Where: chap05/src/router.js:74-76 (implement Route.dispatch). Why: post‑response middlewares run. Verify: app.get(p, h1, h2) with h1 not calling next runs only h1. Accept: exactly one handler per next cycle.
17. res.json/res.send(object) content‑type. Where: express.js:17-32. Why: JSON labelled text/plain. Verify: curl -i shows application/json. Accept: header preserved.
18. res.send for non‑string/object. Where: express.js:17-26. Why: send(42)/Buffer hang. Verify: numbers/booleans/Buffers respond. Accept: defined behavior for all common types.
19. app.enabled correctness. Where: app.js:37-39. Verify: enabled reflects the stored setting and doesn't mutate it. Accept: returns setting truthiness.
    P1 — Required for a credible portfolio project
20. Add an automated test suite (e.g., mocha+supertest or Node's built‑in node:test) covering: path matching, method matching, next chaining/gating, send/json headers+bodies, 404, error propagation. Replace the failing test script.
21. Restore reproducibility: per‑chapter run instructions in the README, correct package.json names, add a start script, remove the unused express dependency, document npm install && node index.js.
22. Implement or explicitly defer error handling (the promised Chapter 06): next(err), a terminal error handler, async‑aware dispatch.
23. Fill LICENSE.md placeholders; fix the README TOC to reflect actual state.
24. Add original work/differentiation if this is to be a portfolio piece (see §11): e.g., a docs/DESIGN.md explaining the router/next design, plus your own feature and tests — none of which exist today.
    P2 — Valuable engineering improvements
25. Store path/params on Layer; implement real route.dispatch; remove dead/unused imports.
26. Implement route parameters (/user/:id) and query parsing (req.query).
27. Add ESLint/Prettier and a small CI workflow; add npm test to it.
28. Reduce cross‑chapter duplication (shared code or a build/step mechanism) while keeping the tutorial readable.
    P3 — Optional advanced features (only if scope justifies)
29. Sub‑routers (express.Router()), path‑prefixed app.use, path‑to‑regexp matching.
30. res.status, res.sendFile, res.redirect, content negotiation.
31. Template engines / view rendering.
    Do not add P3 items merely to look impressive; the author's stated scope is a teaching minimum, not a full Express clone.
32. Portfolio and resume assessment
    Target roles: Junior Full‑Stack / Software / Backend Developer. Your background (3‑month internship, JS/TS, Node/Express, REST, SQL, React/Next) means this repo is directly relevant as a learning artifact — but there is a critical distinction to make.
    Strongest point: the code faithfully mirrors Express internals (express() factory → app → Router → Route/Layer → next, and res prototype extension via expressInit). If you can explain and, better, re‑derive this, it demonstrates genuine understanding of how Express works rather than how to call it.
    The blocker: as committed, you did not write any of it. HEAD == origin/master, no user commits, clean tree. Presenting this to a recruiter as your project is risky and, if challenged, indefensible. This is tutorial‑derived implementation, not independent engineering.
    Could you confidently explain (current state)?

- How a request moves through the app — Yes, if you've internalized §4.
- How routing and middleware work — Mostly, but you must be able to answer "why doesn't GET /post hit the POST handler?" and the honest answer today is "it's not implemented" (a gap, not a design).
- How errors propagate — No. There is no propagation; admitting the sync‑catch/async‑unhandled gap is fine, claiming otherwise is not.
- Design decisions you made — No, not as‑is, because the design is the tutorial author's.
- Limitations — Yes (documented here).
- How you tested correctness — No for the repo (no tests); only if you cite an audit harness you built.
  Interview questions this repo can support (if you own the work):
- Walk me through what happens from app.get('/') to res.end().
- Why is route.dispatch empty, and why does dispatch happen inside router.handle instead?
- How does expressInit attach res.send to every response, and what are the tradeoffs vs. decorating ServerResponse.prototype?
- What breaks if two app.get('/') calls are chained with next? (chap03/04 behavior)
- Why does res.json currently return text/plain, and how would you fix it?
- How would you make dispatch method‑aware without breaking next?
- What are the concurrency implications of the closure over idx?
  Areas where you'd be unable to defend a claim: method routing, 404 handling, error propagation, async handlers, res.send edge types, and "I tested this" (no tests). Fix P0+P1 and add your own commits + tests, and this becomes defensible.
  Bottom line for the resume: keep it as a learning/talking‑point repo, but either (a) rewrite it yourself chapter by chapter with your own commits and tests, or (b) keep it clearly labeled as a study of the original tutorial and build a separate original project. Do not present the current clone as original work.

12. Recommended next actions (execution order)
1. Decide ownership. If this will be a portfolio piece, fork/re‑implement it yourself and commit incrementally so the history shows your work. (Do not merely re‑upload this clone.)
1. Make it runnable: document npm install && node index.js per chapter; fix package.json names; add start scripts; drop the unused express dependency.
1. Add a test harness first, then fix defects test‑first: method dispatch (D1), 404 (D2), next gating (D3), json content‑type (D4), send types (D5), enabled (D6/D8), duplicate init (D6), handle lazyrouter (D9).
1. Implement or explicitly scope error handling (Chapter 06) including async rejection handling.
1. Add your own original value: a DESIGN.md documenting the router/next model, plus at least one non‑tutorial feature (e.g., route params + query parsing) with tests.
1. Clean metadata: fill LICENSE.md; correct README TOC/status; remove dead code.
1. Re‑run the audit harness/tests and confirm P0 acceptance criteria before publishing.
1. Final decision
   Do not treat this repository as complete/portfolio‑ready as‑is. Continue working on it — but only if you are willing to make it your own: add real commits, tests, and the missing core behaviors. The five chapters are a legitimate, well‑structured learning artifact and already give you a strong conceptual grasp of Express internals; they are not yet a defensible portfolio project because (a) the code is an unmodified third‑party clone, (b) core HTTP semantics (method dispatch, not‑found, error propagation, async) are missing, and (c) there is no automated verification.
   Move on to a new, original project (or) invest the P0+P1 work above and re‑commit it under your own name and history. Do not present the current clone to recruiters.
   Areas I could not inspect or verify

- End‑to‑end execution with real installed dependencies — dependencies are not installed and installing them was prohibited. I verified the unmodified chapter sources with faithful runtime shims reconstructed from the exact dependency versions committed to git history (array-flatten@2.1.1, methods, parseurl, merge-descriptors, setprototypeof). Native http/url and Node itself are real (node v25.9.0).
- Behavior on the Node versions the tutorial targeted (≈Node 10 era); modern Node emits a url.parse deprecation warning and has stricter unhandled‑rejection semantics.
- True concurrent‑request behavior — only sequential multi‑request runs were executed; concurrency safety is an inference from per‑request closure state.
- Commits beyond the truncated git log windows, and the dependabot PR branches (unrelated to the current tree).
- Anything the user may have changed but not committed — the working tree is clean, so if local edits existed they are not present here.

# Local API Runner Strategy

Task 4.14 records the strategy for a future dev-only local API runner. It is a strategy and decision record, not a runner implementation.

## Scope / Non-goals

- This is runner strategy, not runner implementation.
- No package script is added in Task 4.14.
- No package dependency is added in Task 4.14.
- No App.tsx integration.
- No UI integration.
- No localStorage replacement.
- No production server.
- No production backend.
- No auth.
- No sync.
- No deployment.
- No backup import/export HTTP endpoint.
- No normalized tables.
- App runtime still uses localStorage through the existing persistence facade.

## Current Runtime Stack

The tested dev-only local API stack already exists:

```text
createDevLocalApiLauncher
-> node:http
-> httpRuntimeAdapter
-> serverAdapter
-> sqliteRepository
```

Current boundary facts:

- The launcher and HTTP runtime are Node-only.
- Node-only exports live under `apps/api/src/node/index.ts`.
- Browser-facing `apps/api/src/index.ts` does not export Node-only runtime.
- `src/**` does not import `node:http`, `node:sqlite`, `devLauncher`, `httpRuntimeAdapter`, `serverAdapter`, or `sqliteRepository`.
- App runtime still uses localStorage and does not call the dev-only local API.

## Current Constraint

- The dev launcher exists and is covered by automated smoke tests.
- There is no package script for starting the dev local API.
- There is no reliable TypeScript runtime runner selected for this project.
- Do not assume `node` can run the TypeScript source files directly.
- Do not add a dependency only to make manual launching convenient.
- Do not package the dev-only local API as a production server.
- Do not connect the frontend runtime to the dev-only local API.

## Runner Options Evaluated

### Option A: No runner yet, keep programmatic launcher only

Summary:

- Keep `createDevLocalApiLauncher(options)` as the only launcher API for now.
- Use automated smoke tests and manual acceptance docs as the validation path.

Pros:

- Zero dependencies.
- Zero package scripts.
- Lowest risk.
- Keeps the boundary test-driven.
- Avoids accidental production-backend signaling.

Cons:

- Manual startup is less convenient.
- Developers need a temporary local harness or a test entrypoint for ad-hoc interaction.

Suitable stage:

- Current 4.x boundary-stabilization phase.

### Option B: Compiled JS runner after build

Summary:

- Add a Node-only TypeScript entry in a future task.
- Compile it to JavaScript with the existing TypeScript toolchain.
- Run the compiled JavaScript with `node`.

Pros:

- No TypeScript runtime dependency.
- Closer to real Node execution.
- Keeps dependency surface small.

Cons:

- Requires proving the current build can emit a usable Node runner.
- May require a separate Node-oriented tsconfig or package export boundary.
- Needs a dedicated prototype task before becoming the default.

Suitable stage:

- Candidate for `Task 4.15 Dev API Runner Prototype V1`.

### Option C: Add tsx or similar TS runtime runner

Summary:

- Use a TypeScript runtime runner such as `tsx` for local development.
- This is only an evaluated option; Task 4.14 does not add the dependency.

Pros:

- Best local developer experience.
- Simple command shape once approved.

Cons:

- Adds dependency and lockfile churn.
- Adds long-term maintenance surface.
- Must be explicitly approved in a later task.

Suitable stage:

- Possible future option only after an explicit dependency decision.

### Option D: Node native TypeScript support / loader based approach

Summary:

- Explore Node-native TypeScript or loader behavior in a future prototype.

Pros:

- Could reduce dependency surface.

Cons:

- Must first prove compatibility with extensionless imports, ESM/CJS behavior, TSX syntax, and path assumptions.
- Current project source layout should not be assumed compatible.
- Higher risk than Option A for the current stage.

Suitable stage:

- Future experiment only, not the Task 4.14 default.

### Option E: Manual test harness only

Summary:

- Keep using Vitest smoke tests as the only way to exercise the stack.
- Do not provide an interactive runner.

Pros:

- Very stable.
- Already covered by Task 4.13 smoke tests.
- No dependency or script changes.

Cons:

- Poor fit for manual API exploration.
- Not a convenient developer workflow.

Suitable stage:

- Good fallback, but less useful than Option A as the stated runner strategy.

## Recommendation

The only recommended short-term strategy is Option A: no runner yet, keep the programmatic launcher only.

Rationale:

- The dev launcher and HTTP smoke behavior are already covered by automated tests.
- The riskiest next mistake would be adding a dependency, script, or runtime-migration signal too early.
- A strategy document followed by a separate prototype task keeps the boundary explicit.
- This avoids presenting the dev-only local API as a production backend.

## Proposed Task 4.15

Recommended next task:

`Task 4.15: Dev API Runner Prototype V1`

Goal:

- Choose and prototype one local runner path for manual development use.

Task 4.15 must still prohibit:

- App.tsx integration.
- UI integration.
- production deployment.
- auth / sync.
- localStorage replacement.
- normalized tables.

Task 4.15 can evaluate:

- compiled JS runner prototype.
- TypeScript runtime runner proposal with explicit dependency approval.
- keeping the manual test harness only if runner risk remains too high.

Task 4.15 is not App runtime migration.

## Safety Checklist

- [ ] No App.tsx integration
- [ ] No UI integration
- [ ] No localStorage replacement
- [ ] No production server
- [ ] No auth / sync / deployment
- [ ] No new dependency in this task
- [ ] No package script in this task
- [ ] No browser import of node:http / node:sqlite
- [ ] Dev API remains localhost-only by default
- [ ] App runtime still uses localStorage

## Decision Record

- Date:
- Branch / commit:
- Decision:
- Rejected options:
- Rationale:
- Next task:
- Risks:
- Rollback plan:

Suggested record for Task 4.14:

- Decision: Use Option A for the short term; keep programmatic launcher only.
- Rejected options: compiled JS runner, TS runtime runner, Node loader runner, and manual test harness only.
- Rationale: Avoid dependency/script/runtime migration signals until a dedicated prototype proves a safe runner path.
- Next task: Task 4.15 Dev API Runner Prototype V1.
- Risks: Manual local API startup remains inconvenient until Task 4.15.
- Rollback plan: Keep using automated smoke tests and the manual acceptance checklist; no runtime rollback is needed because no runner was implemented.

## Task 4.15 Prototype Result

Result A: Compiled JS runner prototype is implemented.

Build audit:

- Existing `npm run build` is browser-only and does not output Node API runner files.
- Existing `tsconfig.json` is no-emit and browser/bundler-oriented.
- Direct `tsc` CommonJS is blocked by `import.meta` usage in the current dependency graph.
- NodeNext ESM is blocked by extensionless relative imports unless source import style changes.
- Vite SSR build can compile the Node-only runner without new dependencies and without browser bundle pollution.
- The compiled runner output is generated under `.ironpath/dev-api-runner`, which is ignored and not committed.
- `--emptyOutDir` is scoped only to `.ironpath/dev-api-runner`; it must not clear `.ironpath/` or touch `.ironpath/dev-api.sqlite`, `.sqlite-wal`, `.sqlite-shm`, or sibling dev artifacts.

Implemented dev-only scripts:

- `npm run api:dev:build`
- `npm run api:dev -- <args>`

Manual runner example:

```powershell
npm run api:dev -- --port 0 --seed-empty --db <temp-db>
```

Runner behavior:

- Defaults remain localhost-only: host `127.0.0.1`, port `8787`, DB `.ironpath/dev-api.sqlite`, and `seedEmpty=false`.
- The ready line is deterministic: `IronPath dev API ready: <url>`.
- `SIGINT` and `SIGTERM` close the HTTP server and SQLite repository.
- The runner does not add business routes or backup import/export HTTP endpoints.
- The runner does not add App.tsx integration, UI integration, localStorage replacement, auth, sync, deployment, production server behavior, or normalized tables.
- Task 4.15 is still not App runtime migration.

Recommended next task:

- Task 4.16 Dev API Runner Manual Acceptance V1.

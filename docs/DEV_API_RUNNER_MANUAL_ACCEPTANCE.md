# Dev API Runner Manual Acceptance

This runbook manually accepts the dev-only compiled JavaScript API runner added in Task 4.15.

If the dev SQLite DB is corrupt, has a schema mismatch, or needs a safe local reset, use `docs/DEV_API_RECOVERY_RESET.md`. Do not use an HTTP reset endpoint or runner reset flag; neither exists in this task.

Use it as a local smoke procedure for:

```text
npm run api:dev
-> compiled devApiRunner.js
-> createDevLocalApiLauncher
-> node:http
-> httpRuntimeAdapter
-> serverAdapter
-> sqliteRepository
```

## Scope / Non-goals

- [ ] Confirm this is dev-only runner manual acceptance.
- [ ] Confirm this is not a production backend.
- [ ] Confirm there is no App.tsx integration.
- [ ] Confirm there is no UI integration.
- [ ] Confirm there is no localStorage replacement.
- [ ] Confirm there is no auth.
- [ ] Confirm there is no sync.
- [ ] Confirm there is no deployment.
- [ ] Confirm there is no backup import/export HTTP endpoint.
- [ ] Confirm there are no normalized tables.
- [ ] Confirm the App runtime still uses localStorage through the existing browser persistence path.

## Prerequisites

- [ ] Work from `C:\Users\xuhao\PycharmProjects\fitness-app`.
- [ ] Confirm Node supports the existing test/runtime baseline: Node >= 24.15 with `node:sqlite`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run api:dev:build`.
- [ ] Confirm `.ironpath/` is ignored by git.
- [ ] Confirm `*.sqlite`, `*.sqlite-wal`, and `*.sqlite-shm` are ignored by git.
- [ ] Confirm no dev DB or real training data is committed.

## Build Runner

Command:

```powershell
npm run api:dev:build
```

Expected:

- [ ] Build exits successfully.
- [ ] Output is written under `.ironpath/dev-api-runner`.
- [ ] `.ironpath/dev-api.sqlite` is not deleted.
- [ ] `.sqlite-wal` and `.sqlite-shm` sibling DB artifacts are not deleted.
- [ ] Browser build output is not modified by the runner build.
- [ ] No package dependency is added.
- [ ] No lockfile change is produced.

## Start Runner With Seed Empty

Command:

```powershell
npm run api:dev -- --seed-empty
```

Explicit local DB command:

```powershell
npm run api:dev -- --port 8787 --seed-empty --db .ironpath/dev-api.sqlite
```

Expected:

- [ ] stdout contains `IronPath dev API ready: <url>`.
- [ ] Default host is `127.0.0.1`.
- [ ] `seedEmpty=true` creates one `dev-launcher:seed-empty` snapshot only when no latest snapshot exists.
- [ ] Runner output does not expose raw stack traces.
- [ ] Runner remains dev-only and local-only by default.

## Health Check

curl:

```bash
curl http://127.0.0.1:8787/health
```

PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
```

Expected:

- [ ] Response is JSON.
- [ ] HTTP status is 200.
- [ ] Response includes dev-only service/runtime information.
- [ ] Response includes route list information from the API contract.
- [ ] Health does not require an existing AppData snapshot.
- [ ] Response does not expose raw stack traces.

## Read Routes

Commands:

```bash
curl http://127.0.0.1:8787/app-data/summary
curl http://127.0.0.1:8787/sessions/summary
curl http://127.0.0.1:8787/history
curl http://127.0.0.1:8787/data-health/summary
```

Expected:

- [ ] After `--seed-empty`, read routes return readable JSON.
- [ ] GET routes do not write new snapshots.
- [ ] Success response shape is `{ "result": <value>, "snapshot": <metadata if present> }`.
- [ ] Error response shape is `{ "error": { "code": string, "message": string } }`.
- [ ] Read behavior comes from `serverAdapter` and `readMirror`.
- [ ] The runner does not add new business logic.

## Mutation Smoke

Important:

- [ ] `seedEmpty` is only for basic read smoke.
- [ ] Empty seeded AppData is not guaranteed to have a startable training template.
- [ ] Successful `POST /sessions/start` smoke requires an existing valid AppData snapshot with a startable template.
- [ ] Do not change training algorithms or template validation to make manual smoke pass.

Conditional example when a valid AppData snapshot already exists:

```bash
curl -X POST http://127.0.0.1:8787/sessions/start \
  -H "Content-Type: application/json" \
  -d "{}"
```

Expected:

- [ ] Successful mutation persistence returns snapshot metadata.
- [ ] No-op mutations do not write snapshots.
- [ ] Invalid mutations do not write snapshots.
- [ ] Requires-confirmation mutations do not write snapshots.
- [ ] If `writeSnapshot` fails, the response is a stable repository error, not a fake success.
- [ ] Mutation responses do not expose raw stack traces.

## Failure Smoke

Malformed JSON:

```bash
curl -X POST http://127.0.0.1:8787/sessions/start \
  -H "Content-Type: application/json" \
  -d "{"
```

Unsupported media type:

```bash
curl -X POST http://127.0.0.1:8787/sessions/start \
  -H "Content-Type: text/plain" \
  -d "{}"
```

Unknown route:

```bash
curl http://127.0.0.1:8787/missing
```

Wrong method:

```bash
curl -X PUT http://127.0.0.1:8787/health
```

Expected:

- [ ] Malformed JSON returns `400` with `invalid_json`.
- [ ] Unsupported media type returns `415` with `unsupported_media_type`.
- [ ] Body too large returns `413` with `request_body_too_large`.
- [ ] Unknown route returns `404` with `unsupported_route`.
- [ ] Wrong method returns `405` with `unsupported_route`.
- [ ] Error response shape is `{ "error": { "code": string, "message": string } }` when the HTTP wrapper owns the error.
- [ ] Unsupported business routes may return `{ "result": { "reasonCode": "unsupported_route" } }` from `serverAdapter`.
- [ ] Failure responses do not expose raw stack traces.
- [ ] Failure paths do not write snapshots.

## Shutdown

- [ ] Stop the runner with Ctrl+C.
- [ ] SIGINT closes the HTTP server.
- [ ] SIGINT closes the SQLite repository.
- [ ] SIGTERM also performs graceful close.
- [ ] After shutdown, the ready URL no longer responds.
- [ ] Starting again with the same `--db` can read the same latest snapshot.

## Localhost Safety

- [ ] Default host is `127.0.0.1`.
- [ ] `0.0.0.0` requires `--allow-network-access`.
- [ ] Non-localhost hosts require `--allow-network-access`.
- [ ] Because there is no auth, do not expose the runner to LAN by default.
- [ ] Do not use the dev runner as a production server.

## DB File Safety

- [ ] Default DB file is `.ironpath/dev-api.sqlite`.
- [ ] `.ironpath/` is ignored by git.
- [ ] `*.sqlite` is ignored by git.
- [ ] `*.sqlite-wal` is ignored by git.
- [ ] `*.sqlite-shm` is ignored by git.
- [ ] Do not commit dev DB files.
- [ ] Do not commit real training data.
- [ ] `api:dev:build` does not delete sibling DB artifacts.

## Browser Safety

- [ ] Browser-facing `apps/api/src/index.ts` does not export the runner.
- [ ] `src/**` does not import `devApiRunner`.
- [ ] `src/**` does not import the Node-only API stack.
- [ ] `npm run build` passes.
- [ ] Browser build does not contain `node:http`.
- [ ] Browser build does not contain `node:sqlite`.
- [ ] Browser build does not contain `devLauncher`, `httpRuntimeAdapter`, `serverAdapter`, `sqliteRepository`, or `devApiRunner`.

## Manual Pass / Fail Template

- [ ] Date:
- [ ] Branch:
- [ ] Commit:
- [ ] Node version:
- [ ] Runner command:
- [ ] DB file:
- [ ] Ready URL:
- [ ] Build result:
- [ ] Health result:
- [ ] Read route result:
- [ ] Mutation smoke result:
- [ ] Failure smoke result:
- [ ] Shutdown result:
- [ ] Browser build result:
- [ ] Notes:
- [ ] Pass / Fail:

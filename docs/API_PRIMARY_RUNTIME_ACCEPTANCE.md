# API Primary Runtime Acceptance

## Scope / Non-goals

Task 5.28 is acceptance coverage for the Task 5.24 through Task 5.27 dev/local API primary runtime helpers.

This is not production readiness. This does not add a browser mutation route, does not add a broad mutation client, does not modify App.tsx, does not replace localStorage, does not delete localStorage, does not add production backend, auth, sync, cloud, deployment, monitoring, package dependency, package script, normalized table, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, or an eighth browser mutation route.

`localStorage` remains the default runtime source and remains fallback/migration source. API primary runtime is accepted only for explicit dev/local `api-primary-dev` mode.

## Accepted Runtime Mode

Accepted runtime source modes remain:

- `localStorage`
- `api-readonly`
- `api-primary-dev`

Default mode remains `localStorage`. `api-primary-dev` requires development mode, explicit runtime source flag, and localhost-only Dev API base URL.

## Accepted Browser Mutation Routes

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

No other browser mutation route is accepted.

## Boot Acceptance

API primary boot acceptance requires:

- explicit dev/local `api-primary-dev`
- validated AppData-shaped API snapshot
- snapshot metadata
- schema validation before accepting data
- visible fallback to localStorage when disabled, unavailable, malformed, missing metadata, or schema-invalid
- no silent localStorage write
- no production runtime mode

## Read Acceptance

API primary read acceptance requires:

- route-specific read facade methods
- localhost-only Dev API base URL
- visible unavailable, timeout, malformed response, and server error failures
- safe snapshot metadata handling
- no localStorage write
- no AppData overwrite outside the explicit accepted result path

## Write Acceptance

API primary write acceptance requires route-specific write-through for only the accepted browser mutation routes.

Each accepted write must require:

- HTTP 2xx
- `result.ok === true`
- `result.changed === true`
- `result.status === "success"`
- snapshot metadata

Accepted write coverage includes:

- DataHealth dismiss
- History dataFlag
- Limited History Edit
- Session Start
- Session Patch
- Session Complete
- Session Discard

## API Unavailable Acceptance

When the Dev API is unavailable:

- boot falls back visibly to localStorage
- reads fail visibly
- writes fail visibly
- no fake success is returned
- no automatic localStorage overwrite occurs
- no automatic retry is introduced
- the fallback source remains localStorage

## No Fake Success Acceptance

The runtime must reject:

- missing snapshot metadata
- malformed responses
- HTTP error responses
- `ok !== true`
- `changed !== true`
- `status !== "success"`
- missing source snapshot metadata
- disabled or invalid API primary configuration

## LocalStorage Fallback Acceptance

Acceptance requires:

- default source remains localStorage
- localStorage remains available as fallback and migration source
- API primary mode never silently writes localStorage
- API primary mode never deletes localStorage
- API primary mode never replaces backup/import/export safety semantics

## Route Boundary Acceptance

Still blocked:

- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- any eighth browser mutation route
- production backend/auth/sync/cloud/deployment
- broad frontend mutation client
- normalized tables
- training algorithm, template, scheduler, PR, e1RM, effectiveSet, or backup safety rule changes

## Manual Acceptance Inventory

Manual acceptance for Task 5.29 must require:

- dedicated test browser profile
- dedicated dev DB
- no real personal training data
- Dev API available and unavailable scenarios
- API primary boot check
- API primary read check
- all seven accepted write checks
- localStorage fallback check
- pass/fail template

## Decision

Task 5.28 accepts the dev/local API primary runtime helper set for controlled acceptance testing only.

It does not make API primary production-ready and does not make API primary the default runtime source.

Next recommended task: `Task 5.29 API Primary Runtime Manual Acceptance V1`.

## Decision Record

- Date: 2026-05-12
- Branch / commit: `codex/task5.28-api-primary-runtime-acceptance` / pending until merge
- Decision: add acceptance coverage for API primary dev runtime helpers.
- Accepted runtime mode: explicit dev/local `api-primary-dev`
- Accepted routes: DataHealth dismiss; History dataFlag; Limited History Edit; Session Start; Session Patch; Session Complete; Session Discard
- Rejected routes: DataHealth repair; backup/import/export over HTTP; reset/recovery over HTTP; eighth mutation routes
- Source of truth: default remains localStorage; API/SQLite is dev/local source only under explicit `api-primary-dev`
- Required fallback: localStorage fallback remains available and untouched
- Recommended next task: `Task 5.29 API Primary Runtime Manual Acceptance V1`
- Rollback requirement: revert the Task 5.28 docs/static-test commit.

## Final Recommendation

Task 5.28 result: API primary runtime acceptance only.
No browser mutation route is added.
No production backend, auth, sync, cloud, deployment, dependency, package script, normalized table, DataHealth repair, backup/import/export HTTP, reset/recovery HTTP, or eighth route is added.
`localStorage` remains the default source of truth and fallback/migration source.
API primary remains explicit dev/local `api-primary-dev`.
Next task should be Task 5.29 API Primary Runtime Manual Acceptance V1.

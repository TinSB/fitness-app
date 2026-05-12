# API Primary Runtime Hardening

## Scope / Non-goals

Task 5.30 hardens the explicit dev/local API primary runtime acceptance state with docs and static/runtime tests.

This task does not add runtime routes, does not modify App.tsx, does not make API primary the default, does not replace or delete localStorage, does not add DataHealth repair, does not add backup/import/export over HTTP, does not add reset/recovery over HTTP, does not add production backend, auth, sync, cloud, deployment, monitoring, package dependency, package script, normalized table, or an eighth browser mutation route.

`localStorage` remains default and fallback/migration source. API primary remains explicit dev/local `api-primary-dev`.

## Startup Race Hardening

Startup race behavior must remain visible and recoverable:

- disabled runtime source falls back to localStorage.
- missing API snapshot reader falls back to localStorage.
- API unavailable during boot falls back to localStorage.
- schema validation runs before accepting API data.
- failure does not partially commit AppData.
- failure does not write localStorage.

## API Unavailable Hardening

API unavailable behavior must remain non-mutating:

- boot unavailable returns visible fallback.
- read unavailable returns visible failure.
- write unavailable returns visible failure.
- no fake success is returned.
- no automatic retry loop is introduced.
- localStorage remains available as fallback.

## Snapshot Mismatch Hardening

Snapshot mismatch and metadata problems are hard failures or diagnostics:

- missing boot snapshot metadata is rejected.
- malformed read snapshot metadata is diagnostic only.
- missing write snapshot metadata is rejected.
- stale source metadata is not auto-merged.
- API snapshot metadata never silently overwrites AppData.
- API snapshot metadata never silently overwrites localStorage.

## Reload Behavior Hardening

Reload behavior must preserve safety:

- unflagged reload returns to localStorage.
- invalid `api-primary-dev` config falls back to localStorage.
- API unavailable reload is visible.
- localStorage fallback remains available after reload.
- no localStorage deletion occurs.

## Stale AppData Hardening

Stale AppData must not be hidden:

- stale API boot payloads require schema validation.
- stale write source metadata fails through the API result path.
- stale read summaries are diagnostic until explicitly accepted.
- no automatic local/API merge occurs.
- no source-of-truth switch occurs outside explicit dev/local mode.

## Failure Rollback Hardening

Failure rollback remains manual and localStorage-backed:

- failed boot returns `source: "localStorage"`.
- failed write returns `source: "localStorage"`.
- failed read does not mutate AppData.
- localStorage snapshot remains the rollback source.
- no repair, sync, overwrite, import, export, reset, apply, or fix control is introduced.

## No Silent Overwrite Hardening

The runtime must never silently:

- write localStorage.
- delete localStorage.
- overwrite AppData from an API error.
- accept a write without snapshot metadata.
- treat `changed=false` as success.
- use API primary in production mode.

## Accepted Route Boundary

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

Still blocked:

- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP
- any eighth browser mutation route
- production backend/auth/sync/cloud/deployment
- broad mutation client
- normalized tables
- training algorithm, template, scheduler, PR, e1RM, effectiveSet, or backup safety changes

## Manual Retest Inventory

Manual hardening retest must include:

- dedicated test browser profile
- dedicated dev DB
- no real personal training data
- API unavailable boot
- API unavailable read
- API unavailable write
- missing snapshot metadata
- malformed response
- stale source metadata
- localStorage integrity comparison
- cleanup/env reset

## Decision

Task 5.30 hardens API primary dev runtime failure handling without adding runtime behavior.

Next recommended task: `Task 5.31 API Primary Runtime Regression Lock V1`.

## Final Recommendation

Task 5.30 result: API primary runtime hardening only.
No browser mutation route is added.
No production backend, auth, sync, cloud, deployment, dependency, package script, normalized table, DataHealth repair, backup/import/export HTTP, reset/recovery HTTP, or eighth route is added.
`localStorage` remains default and fallback/migration source.
API primary remains explicit dev/local `api-primary-dev`.
Next task should be Task 5.31 API Primary Runtime Regression Lock V1.

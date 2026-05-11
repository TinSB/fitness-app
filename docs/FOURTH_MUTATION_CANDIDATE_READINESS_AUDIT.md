# Fourth Mutation Candidate Readiness Audit

## Scope / Non-goals

This is a fourth mutation candidate readiness audit.

- This is not a fourth mutation implementation.
- This does not add a browser route.
- This does not add a fourth mutation route.
- This does not modify App.tsx.
- This does not add App.tsx mutation integration.
- This does not modify src/devApi runtime behavior.
- This does not add a frontend mutation client.
- This does not replace localStorage.
- This does not switch source of truth.
- This does not add offline mutation queue.
- This does not add production backend, auth, sync, or deployment.
- This does not add a dependency or package script.
- Write-path migration remains limited to the three accepted dev-only prototypes.
- This does not add UI writes to API.
- There are no UI writes to API added by Task 4.55.

## Current Three-route Baseline

- DataHealth dismiss is implemented, accepted, manually accepted, hardened, observability/recovery noted, and regression locked.
- History data-flag is implemented, accepted, manually accepted, hardened, and regression locked.
- Limited History Edit is implemented, accepted, manually accepted, hardened, observability/recovery noted, and regression locked.
- Browser mutation routes remain exactly three:
  - `POST /data-health/issues/:issueId/dismiss`
  - `POST /history/:id/data-flag`
  - `POST /history/:id/edit`
- localStorage remains source of truth.
- API results never overwrite AppData or localStorage.
- No session mutation route is exposed from browser code.
- No DataHealth repair route is exposed from browser code.
- No backup/import/export/reset/recovery route is exposed from browser code.

## Candidate Inventory

### Candidate C1: Session start

Route: `POST /sessions/start`

Status: future planning candidate area only; not ready for implementation.

### Candidate C2: Session patch

Route: `POST /sessions/active/patches`

Status: future planning candidate area only; not ready for implementation.

### Candidate C3: Session complete

Route: `POST /sessions/active/complete`

Status: future planning candidate area only; not ready for implementation.

### Candidate C4: Session discard

Route: `POST /sessions/active/discard`

Status: future planning candidate area only; not ready for implementation.

### Candidate D1: DataHealth repair

Route: `POST /data-health/repair/apply`

Status: blocked.

### Candidate D2: Backup/import/export over HTTP

Status: blocked.

### Candidate D3: Reset/recovery over HTTP

Status: blocked.

### Candidate D4: Source-of-truth migration

Status: blocked and not a mutation prototype.

### Candidate E: No fourth mutation yet; continue three-route hardening

Status: accepted as the current decision.

## Candidate Evaluation Criteria

Each candidate is evaluated against:

- active session data-loss risk
- localStorage/source-of-truth impact
- unsaved training state risk
- duplicate-submit/idempotency requirement
- offline/PWA risk
- recovery/rollback requirement
- confirmation UX requirement
- readMirror parity impact
- PR/e1RM/effectiveSet impact
- audit trail requirement
- failure/no-fake-success requirement
- manual acceptance requirement
- browser route boundary risk
- user confusion risk
- production exposure risk

## Session Start Readiness Analysis

Session start creates active training state and can change what the user sees as the current workout.

- Duplicate start can create conflicting active sessions.
- Stale localStorage/API mismatch can start from the wrong source.
- Offline/PWA behavior is not ready.
- Session start requires a session recovery plan.
- Session start requires idempotency rules for duplicate clicks, refreshes, and retries.
- Session start is not ready for implementation.
- Session start may be a plausible future planning candidate only after active-session recovery design.

## Session Patch Readiness Analysis

Session patches affect unsaved active session state.

- Patch ordering matters.
- Stale step and set updates can corrupt the current workout.
- Duplicate patch can duplicate or overwrite training values.
- Patch failure can leave the browser and API snapshots in different states.
- Session patch requires idempotency, patch sequencing, conflict detection, and rollback.
- Session patch is not ready for implementation.

## Session Complete Readiness Analysis

Session complete writes the final history record.

- Duplicate complete can create duplicate records or lose the active session.
- Failure during completion can leave split state.
- Completion affects history, summaries, PR/e1RM/effectiveSet calculations, and readMirror parity.
- Session complete requires the strongest confirmation and recovery behavior.
- Session complete is not ready for fourth mutation implementation.

## Session Discard Readiness Analysis

Session discard can destroy unsaved training state.

- Discard requires strong confirmation.
- Discard requires a visible backup/recovery policy.
- Discard must define recovery behavior after unavailable, timeout, abort, or partial failure states.
- Discard is not ready for fourth mutation implementation.

## DataHealth Repair Readiness Analysis

DataHealth repair remains blocked.

- Repair can change derived or legacy display semantics.
- Repair can be destructive or confusing.
- Repair requires backup-first behavior.
- Repair can alter user trust in summary and history data.
- Repair remains blocked from browser mutation code.

## Backup / Import / Export / Reset / Recovery Analysis

- Backup/import/export over HTTP remains high risk.
- Reset/recovery over HTTP remains destructive.
- There is no browser reset route.
- There is no browser recovery route.
- There is no production data recovery.
- Backup/import/export/reset/recovery over HTTP remains blocked.

## Source-of-truth Migration Analysis

- Source-of-truth migration is not a mutation prototype.
- Current source of truth remains localStorage.
- No API-backed persistence adapter exists.
- No source-of-truth switch is approved.
- No dual-write strategy is active.
- No offline mutation queue exists.

## Risk Matrix

| Risk | Severity | Mitigation | Required gate |
| --- | --- | --- | --- |
| Active session data loss | High | Keep session mutations blocked until a recovery design exists. | Active-session recovery plan written and reviewed. |
| Duplicate session start | High | Define idempotency keys and duplicate-submit behavior before route planning. | Duplicate start behavior documented. |
| Duplicate session complete | High | Define completion idempotency and history de-duplication rules. | Duplicate complete behavior documented. |
| Unsaved session discard | High | Require strong confirmation and visible recovery policy. | Discard safety and recovery documented. |
| Stale active session patch | High | Require patch sequencing, conflict detection, and source snapshot checks. | Patch sequencing/idempotency documented. |
| Offline failed active-session mutation | High | Define offline/PWA failure behavior before any prototype. | Offline failure/recovery documented. |
| Source-of-truth divergence | High | Keep localStorage as source of truth and avoid API result merges. | localStorage integrity confirmed. |
| PR/e1RM/effectiveSet drift | Medium | Require parity tests before any session completion or patch prototype. | Training calculation impact documented. |
| DataHealth repair misuse | High | Keep repair blocked and require backup-first planning. | Repair remains blocked. |
| Backup/import data loss | High | Keep backup/import/export over HTTP blocked. | No browser backup/import/export route. |
| Reset/recovery destructive action | High | Keep reset/recovery over HTTP blocked. | No browser reset/recovery route. |
| Browser route expansion | High | Keep exact allowlist tests green. | Three-route boundary lock remains green. |
| Production exposure | High | Keep prototypes dev-only and explicit opt-in. | Production-like build exposes no mutation prototype. |
| User confusion | Medium | Require route-specific flags, clear copy, and manual acceptance. | Manual acceptance plan written. |

## Recommendation

Unique recommendation: Do not implement a fourth mutation next.

Next recommended task: `Task 4.56 Active Session Mutation Readiness & Recovery Plan V1`.

Task 4.56 must be planning-only.

- It must not implement `POST /sessions/start`.
- It must not implement `POST /sessions/active/patches`.
- It must not implement `POST /sessions/active/complete`.
- It must not implement `POST /sessions/active/discard`.
- It must define active-session recovery, idempotency, duplicate-submit prevention, offline failure behavior, source snapshot strategy, and discard/complete safety.

Rationale:

- Session mutation is the only remaining plausible product-value candidate area.
- It is too risky for direct implementation.
- DataHealth repair, backup/import/export, reset/recovery, and source-of-truth migration remain blocked.
- A dedicated active-session recovery and readiness plan is required before any prototype.

Task 4.55 must not recommend direct implementation.

## Required Gates Before Any Fourth Mutation Prototype

- Three-route regression lock remains green.
- Three-route manual regression remains valid.
- localStorage source-of-truth confirmed.
- Read-only diagnostics green.
- No-fake-success still green.
- Active-session recovery plan written.
- Duplicate start/complete/discard behavior documented.
- Patch sequencing/idempotency documented.
- Unsaved session failure/recovery documented.
- Offline/PWA behavior documented.
- Confirmation UX planned.
- Rollback UX planned.
- Manual acceptance plan written.
- Browser route allowlist updated only in an explicit future prototype.
- No DataHealth repair/backup/reset routes.
- Browser build clean.

## Decision Record

- Date: 2026-05-11
- Branch / commit: `codex/task4.55-fourth-mutation-candidate-readiness-audit` / pending until merge
- Decision: audit fourth mutation candidates and do not approve fourth mutation implementation.
- Recommended candidate area for future planning: active-session mutation readiness and recovery.
- Rejected candidates: direct session mutation implementation, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, source-of-truth migration, broad frontend mutation client, production backend/auth/sync/deployment.
- Required gates: active-session recovery plan, idempotency and duplicate-submit design, offline failure behavior, source snapshot strategy, confirmation and rollback planning, manual acceptance planning, exact route allowlist lock, and clean browser build.
- Next task: `Task 4.56 Active Session Mutation Readiness & Recovery Plan V1`
- Risks: active session data loss, duplicate session start/complete, unsaved session discard, stale patch corruption, offline failed mutation, source-of-truth divergence, training metric drift, repair misuse, backup/import data loss, reset/recovery destruction, route expansion, production exposure, user confusion.
- Rollback requirement: because Task 4.55 adds docs/static tests only, rollback is reverting the audit commit; existing prototypes remain governed by their own flags and runbooks.

## Final Recommendation

Task 4.55 result: Audit only.
No fourth mutation is implemented.
Browser mutation routes remain exactly DataHealth dismiss, History data-flag, and Limited History Edit.
Active session mutation is the only plausible future fourth candidate area for planning.
Next task should be Task 4.56 Active Session Mutation Readiness & Recovery Plan V1, planning-only.
Write-path migration remains blocked beyond the existing three dev-only prototypes.

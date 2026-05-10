# Third Mutation Candidate Readiness Audit

Task 4.43 audits possible third browser mutation candidates after the current two-route write-path state has been regression-locked.

## Scope / Non-goals

- This is a third mutation candidate readiness audit.
- This is not a third mutation implementation.
- This does not add a browser route.
- This does not add a third mutation route.
- This does not modify App.tsx.
- This does not add App.tsx mutation integration.
- This does not modify src/devApi runtime behavior.
- This does not add a frontend mutation client.
- This does not replace localStorage.
- This does not switch source of truth.
- This does not add an offline mutation queue.
- This does not add production backend, auth, sync, or deployment.
- This does not add a dependency or package script.
- There are no UI writes to API added by Task 4.43.
- This does not add normalized tables.
- Write-path migration remains limited to the two accepted dev-only prototypes.

## Current Two-route Baseline

- DataHealth dismiss is implemented, accepted, manually accepted, hardened, observability/recovery noted, and regression locked.
- History data-flag is planned, implemented, accepted, manually accepted, hardened, and regression locked.
- Browser mutation routes remain exactly:
  - `POST /data-health/issues/:issueId/dismiss`
  - `POST /history/:id/data-flag`
- localStorage remains source of truth.
- API results never overwrite AppData or localStorage.
- No session mutation route is exposed from browser code.
- No history edit route is exposed from browser code.
- No DataHealth repair route is exposed from browser code.
- No backup/import/export/reset/recovery route is exposed from browser code.

## Candidate Inventory

### Candidate B2: Limited history edit

- Route: `POST /history/:id/edit`
- Candidate status: plausible future third candidate for planning only.
- Current browser runtime status: blocked.
- Risk: high.
- Reason considered: a limited edit path could correct historical entry mistakes if it is field-constrained, audited, reversible, and manually accepted.
- Reason not ready: editing history can alter set logs, calculation inputs, summaries, audit trust, and readMirror parity.

### Candidate C: Session mutations

Routes:

- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

Status: blocked.

Reason: active session state is fragile, duplicate start/complete/discard can lose or duplicate training data, and offline/PWA recovery is not yet specified.

### Candidate D1: DataHealth repair

- Route: `POST /data-health/repair/apply`
- Status: blocked.
- Reason: repair can change derived or legacy display semantics and can look like a safe fix while altering user-visible history.

### Candidate D2: Backup/import/export over HTTP

- Status: blocked.
- Reason: backup/import/export over HTTP could bypass existing local file validation, confirmation, and recovery expectations.

### Candidate D3: Reset/recovery over HTTP

- Status: blocked.
- Reason: reset/recovery over HTTP is destructive and must not become a browser route.

### Candidate D4: Source-of-truth migration

- Status: blocked.
- Reason: source-of-truth migration is not a mutation prototype and requires a separate phase with storage, sync, recovery, and migration design.

### Candidate E: No third mutation yet; continue two-route hardening

- Status: selected current action.
- Reason: the two accepted dev-only prototypes should remain stable while the next plausible candidate is planned with field-level constraints before any implementation.

## Candidate Evaluation Criteria

Every third mutation candidate must be evaluated against:

- data semantics risk
- localStorage/source-of-truth impact
- PR/e1RM/effectiveSet impact
- readMirror parity impact
- audit trail requirement
- confirmation UX requirement
- rollback requirement
- idempotency/duplicate-submit requirement
- conflict/source snapshot requirement
- failure/no-fake-success requirement
- manual acceptance requirement
- browser route boundary risk
- offline/PWA risk
- user confusion risk

## Limited History Edit Readiness Analysis

Limited history edit is the most plausible future third candidate only for future planning, not implementation.

- Edit may affect set logs.
- Edit may affect actualWeightKg-derived calculations.
- Edit may affect PR/e1RM/effectiveSet.
- Edit may affect effective sets and weighted effective sets.
- Edit may affect summaries, calendar, history, and readMirror output.
- Edit requires strong audit trail visibility.
- Edit requires a stronger rollback plan than dataFlag changes.
- Edit requires field-level constraints that reject broad history edit.
- Edit requires before/after display.
- Edit requires manual acceptance and no-fake-success coverage.
- Edit requires conflict/source snapshot checks before any write can be considered successful.

The only acceptable next step for limited history edit is a planning-only task. That plan must define allowed fields, rejected fields, validation rules, source snapshot behavior, before/after review, audit output, rollback UX, manual acceptance, and route boundary gates before any prototype is considered.

## Session Mutation Readiness Analysis

Session mutation is not ready to be the third browser mutation candidate.

- Active session state is fragile.
- Duplicate start/complete/discard can lose data.
- Duplicate start/complete/discard can create duplicate or contradictory records.
- Offline/PWA behavior is complex.
- Unsaved training recovery is required before active-session writes.
- Session mutation cannot be third mutation yet.
- Session mutation requires a separate session recovery plan before any prototype.

## DataHealth Repair Readiness Analysis

DataHealth repair remains blocked.

- Repair can change derived or legacy display semantics.
- Repair can be destructive or confusing.
- Repair can blur the difference between diagnostics and user-approved data correction.
- Repair requires stronger confirmation and backup.
- Repair requires a dedicated plan before any browser mutation prototype.

## Backup / Import / Export / Reset / Recovery Analysis

- Backup/import over HTTP remains high risk.
- Export over HTTP remains blocked as part of the same backup/import/export browser mutation surface.
- Reset/recovery over HTTP remains destructive.
- There is no browser reset route.
- There is no browser recovery route.
- There is no production data recovery.
- Backup/import/export/reset/recovery over HTTP remains blocked.

## Source-of-truth Migration Analysis

- Source-of-truth migration is not a mutation prototype.
- Source-of-truth migration requires a separate phase.
- The current source of truth remains localStorage.
- No API-backed persistence adapter is approved.
- No source-of-truth switch is approved.
- No API result may overwrite AppData or localStorage.

## Risk Matrix

| Risk | Severity | Mitigation | Required gate |
| --- | --- | --- | --- |
| history edit corruption | High | Keep `POST /history/:id/edit` blocked until a field-constrained plan defines allowed edits, rejected fields, before/after review, audit output, and rollback UX. | Task 4.44 planning-only field constraint gate. |
| PR/e1RM/effectiveSet drift | High | Document every calculation input affected by edit, especially actualWeightKg-derived values, PR, e1RM, effectiveSet, and weighted effectiveSet outputs. | Calculation impact review gate. |
| active session data loss | High | Keep all `POST /sessions/*` routes blocked and require unsaved training recovery design first. | Session recovery plan gate. |
| duplicate session completion | High | Do not expose complete/discard routes until duplicate-submit, idempotency, and recovery behavior are specified. | Session idempotency gate. |
| offline failed mutation | Medium | Avoid active write expansion until offline/PWA failure states and no-fake-success behavior are documented. | Offline/PWA failure gate. |
| repair misuse | High | Keep `POST /data-health/repair/apply` blocked and require confirmation, backup, and audit semantics before planning any prototype. | Repair confirmation and backup gate. |
| backup/import data loss | Critical | Keep backup/import/export over HTTP blocked and preserve existing local file validation and confirmation semantics. | Backup safety parity gate. |
| reset/recovery destructive action | Critical | Keep browser reset and recovery routes absent. | No browser reset/recovery route gate. |
| source-of-truth divergence | High | Keep localStorage authoritative and block API-backed persistence adapters, dual-write, and API-to-AppData overwrite. | Source-of-truth lock gate. |
| browser route expansion | High | Keep browser mutation routes exactly the two accepted routes until a future explicit prototype updates the allowlist. | Two-route allowlist lock gate. |
| production exposure | High | Keep mutation prototypes dev-only and explicit opt-in with no production backend/auth/sync/deployment implication. | Production exposure boundary gate. |
| user confusion | Medium | Require visible before/after review, confirmation, no-fake-success, and audit trail wording before any user-facing correction flow. | Manual acceptance UX gate. |

## Recommendation

Unique recommendation: Do not implement a third mutation next.

Next recommended task: `Task 4.44 Limited History Edit Mutation Prototype Plan V1`.

Task 4.44 must be planning-only.

Task 4.44 must not implement `POST /history/:id/edit`.

Task 4.44 must define field-level constraints and reject broad history edit.

Task 4.43 must not recommend direct implementation.

Rationale:

- Limited history edit is the only plausible future third candidate.
- Limited history edit is still too risky for direct implementation.
- Session mutation remains blocked.
- DataHealth repair remains blocked.
- Backup/import/export/reset/recovery over HTTP remains blocked.
- Source-of-truth migration remains blocked.
- A dedicated plan is required before any prototype.

## Required Gates Before Any Third Mutation Prototype

- Two-route regression lock remains green.
- Two-route manual regression remains valid.
- localStorage source-of-truth confirmed.
- Read-only diagnostics green.
- No-fake-success still green.
- History edit field constraints documented.
- PR/e1RM/effectiveSet impact documented.
- Audit trail before/after display planned.
- Rollback UX planned.
- Manual acceptance plan written.
- Browser route allowlist updated only in explicit future prototype.
- No session routes.
- No repair routes.
- No backup/import/export/reset/recovery routes.
- Browser build clean.

## Decision Record

- Date: 2026-05-10
- Branch / commit: `codex/task4.43-third-mutation-candidate-readiness-audit` / pending until commit
- Decision: Audit possible third mutation candidates without implementing any third mutation.
- Recommended candidate for future planning: limited history edit through `Task 4.44 Limited History Edit Mutation Prototype Plan V1`, planning-only.
- Rejected candidates: session mutations, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, source-of-truth migration, and no direct third mutation implementation.
- Required gates: two-route regression lock, two-route manual regression, localStorage source-of-truth, read-only diagnostics, no-fake-success, field constraints, PR/e1RM/effectiveSet impact, before/after audit display, rollback UX, manual acceptance, explicit future allowlist update, no session/repair/backup/reset routes, and browser build cleanliness.
- Next task: `Task 4.44 Limited History Edit Mutation Prototype Plan V1`, planning-only.
- Risks: history edit corruption, PR/e1RM/effectiveSet drift, active session data loss, duplicate session completion, offline failed mutation, repair misuse, backup/import data loss, reset/recovery destructive action, source-of-truth divergence, browser route expansion, production exposure, and user confusion.
- Rollback requirement: because Task 4.43 adds docs/static tests only, rollback is reverting the audit commit; any future prototype must define its own rollback UX before implementation.

## Final Recommendation

Task 4.43 result: Audit only.

No third mutation is implemented.

Browser mutation routes remain exactly DataHealth dismiss and History data-flag:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`

Limited History edit is the only plausible future third candidate for planning.

Next task should be Task 4.44 Limited History Edit Mutation Prototype Plan V1, planning-only.

Write-path migration remains blocked beyond the existing two dev-only prototypes.

## Task 4.44 Follow-up Note

Task 4.44 adds `docs/LIMITED_HISTORY_EDIT_MUTATION_PROTOTYPE_PLAN.md` as a planning-only limited history edit prototype plan.

- It does not implement `POST /history/:id/edit`.
- It does not add a third browser mutation route.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.
- It defines field-level constraints for one existing set in one existing history session.
- It rejects broad history edit, session mutation, DataHealth repair, backup/import/export/reset/recovery, source-of-truth migration, production backend/auth/sync/deployment, dependencies, scripts, lockfile changes, normalized tables, and training algorithm changes.
- There is no automatic next task after Task 4.44.

## Task 4.45 Follow-up Note

Task 4.45 adds `docs/LIMITED_HISTORY_EDIT_MUTATION_READINESS_GATE.md` as a readiness gate for the Task 4.44 limited history edit prototype plan.

- It is gate-only and docs/static-test only.
- It does not implement `POST /history/:id/edit`.
- It does not add a third browser mutation route.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss` and `POST /history/:id/data-flag`.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.
- It concludes that limited history edit is ready for a user-approved implementation prompt, but not direct implementation.
- Task 4.46 Limited History Edit Mutation Prototype V1 requires explicit user approval and must not auto-start.

## Task 4.46 Follow-up Note

Task 4.46 moves limited history edit from planning candidate to dev-only prototype only after explicit user approval.

- The prototype adds only `POST /history/:id/edit` to browser mutation code.
- The accepted browser mutation routes are now exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- Session mutation, DataHealth repair, backup/import/export/reset/recovery, source-of-truth migration, production backend/auth/sync/deployment, and broad mutation clients remain blocked.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.

## Task 4.49 Follow-up Note

Task 4.49 hardens the accepted Limited History Edit prototype only.

- No fourth mutation candidate is introduced.
- No new browser mutation route is added.
- Browser mutation routes remain exactly `POST /data-health/issues/:issueId/dismiss`, `POST /history/:id/data-flag`, and `POST /history/:id/edit`.
- Session mutation, DataHealth repair, backup/import/export/reset/recovery, source-of-truth migration, production backend/auth/sync/deployment, and broad mutation clients remain blocked.
- localStorage remains source of truth and API results never overwrite AppData or localStorage.

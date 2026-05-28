# Data Integrity Remediation Tasks V1

Status: planning-only task specs (no implementation in this PR)
Last updated: 2026-05-27

Companion to [DATA_INTEGRITY_REMEDIATION_PLANNING_V1.md](DATA_INTEGRITY_REMEDIATION_PLANNING_V1.md). Each follow-up task below is independently approvable, independently shippable, and independently gated on the V1 data safety rules in [DATA_REPAIR_POLICY.md](DATA_REPAIR_POLICY.md).

**Implementation order recommendation** (see planning doc §18):

1. Partial Completion Quality V1
2. Replacement Equivalence Curated Remap V1
3. Duplicate Set ID Consumer Audit V1
4. (Optional) Stable Set UID V1
5. (Optional) Exercise Identity Migration V1

Tasks 1–3 may ship in any order. Task 4 is gated on Task 3 plus a concrete consumer need. Task 5 is V3+ and requires explicit owner + content-team approval.

---

## Task 1 — Partial Completion Quality V1

### Scope
- Add a derived `completionQuality` projection to `CleanAppDataView`: `'full' | 'partial' | 'aborted' | 'unknown'` per session.
- Add a pure helper `deriveCompletionQuality(session: TrainingSession)` in `src/dataHealth/cleanAppDataView.ts` (or a sibling pure module).
- Surface the derived value in `CleanAppDataView.guardDiagnostics` so the Data Health UI can show a passive count.
- Optionally surface the value on the Progress / Calendar UI as a non-blocking badge.

### Non-goals
- **No schema bump.** Do not add `TrainingSession.completionQuality` to the schema in this task.
- **No AppData mutation.** Do not write the derived value to `history`.
- **No cloud upload churn.** No `appDataHash` change.
- No change to `finalizeTrainingSession` write path.
- No change to TrainingDecision behavior — TD already reads partial-completion via existing fields.
- No change to PR / e1RM behavior — they already filter incomplete sets.

### Files likely affected
- `src/dataHealth/cleanAppDataView.ts` — add `completionQualityBySessionId: Map<string, 'full' | 'partial' | 'aborted' | 'unknown'>` and the helper.
- `src/dataHealth/dataHealthRuntimeGuard.ts` — optionally co-locate `deriveCompletionQuality` here.
- `src/features/ProgressView.tsx` — optional, only if the badge surface is approved.
- `src/features/RecordView.tsx` — optional, only if the badge surface is approved.
- `docs/REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md` — update the "Remaining risks" line that mentions `partialCompletionAuditV1`.
- `tests/cleanAppDataPartialCompletionDerived.test.ts` — new.
- `tests/realDataHealthRepair*` static guards — if needed.

### Data safety boundaries
- Pure projection only. No `setData` / `saveData` calls.
- No backup needed (no mutation).
- No upload gating impact.
- No localStorage write.
- The runtime-derived value MUST be recomputed from current `AppData` on every read; do not cache to disk.

### Schema impact
**None.** A V2 task (separate proposal) may later add `TrainingSession.completionQuality?` as a persisted field. This task explicitly does not.

### Tests
- `tests/cleanAppDataPartialCompletionDerived.test.ts`
  - returns `'full'` for a clean finalized session
  - returns `'partial'` for a session with `earlyEndReason='incomplete_main_work'` and ≥1 completed working set
  - returns `'aborted'` for a session with `earlyEndReason='incomplete_main_work'` and zero completed main working sets
  - returns `'unknown'` for `completed=false` or missing-session inputs
  - is pure (same input → same output, no side effects)
  - exact 2/10 sessions in `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json` resolve to `'partial'`
- `tests/realDataHealthRepairStaticGuards.test.ts` — extend to assert `buildCleanAppDataView` exposes the new map.
- `tests/dataIntegrityRemediationPlanningDocsParity.test.ts` (new, lightweight) — assert `docs/DATA_INTEGRITY_REMEDIATION_PLANNING_V1.md` still names `completionQuality` as derived-only in V1.

### Browser smoke
- Boot the redacted-fixture profile.
- Confirm the Data Health passive line reports the partial count.
- Confirm Progress / Record views unchanged for full sessions (no visual diff).
- Confirm partial sessions surface the new badge (if the badge UI is included).

### Merge / deploy rules
- One PR. Code + tests + docs in the same PR.
- Do not bundle with the schema-bump V2 task.
- No `--admin` merge. No branch-protection bypass.
- Cloud sync remains opt-in only.

---

## Task 2 — Replacement Equivalence Curated Remap V1

### Scope
- Add `src/data/replacementEquivalenceRemap.ts` containing the curated remap table (see planning doc §13).
- Extend `CleanAppDataView` to canonicalize `(actualExerciseId, equivalenceChainId, baseId)` against the remap during projection. Original record unchanged.
- Update `replacementEquivalenceAuditV1` to report which findings now have a curated resolution vs which remain audit-only.
- Surface canonicalization count in `CleanAppDataView.guardDiagnostics`.

### Non-goals
- **No AppData mutation.** Do not rewrite `history[].exercises[].baseId` / `equivalenceChainId`.
- **No schema change.**
- No change to `EXERCISE_EQUIVALENCE_CHAINS` content (those are catalogue definitions; remap is for legacy record correction only).
- No change to `getExerciseRecordPoolId` or e1RM pool keying.
- No change to PR aggregation order in `analytics.ts` — PR identity stays keyed by `actualExerciseId`.

### Files likely affected
- `src/data/replacementEquivalenceRemap.ts` (new).
- `src/dataHealth/cleanAppDataView.ts` — call canonicalization during `buildCleanSession`.
- `src/dataHealth/dataHealthRuntimeGuard.ts` — optionally house the canonicalization helper.
- `src/dataHealth/repairs/replacementEquivalenceAuditV1.ts` — extend detector to label "auto-canonical" vs "needs-curation".
- `tests/replacementEquivalenceCuratedRemap.test.ts` (new).
- `tests/realDataHealthRepairUnits.test.ts` — extend the audit unit test.
- `tests/realDataHealthRepairStaticGuards.test.ts` — add static guards.
- `docs/REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md` — update Remaining risks line.

### Data safety boundaries
- Runtime canonicalization only.
- The remap table is **content-owner approved** in the PR body — every row cites a `EXERCISE_EQUIVALENCE_CHAINS` entry.
- No `apply()` mutation. The audit `apply` continues to return `status='skipped'`.
- No upload gating impact.

### Schema impact
**None.** Persisted rewrite is the V3+ "Exercise Identity Migration V1" task.

### Tests
- `tests/replacementEquivalenceCuratedRemap.test.ts`
  - every remap row maps an `actualExerciseId` to a chain that is declared in `EXERCISE_EQUIVALENCE_CHAINS`
  - given the V1 redacted fixture, 9 exercises become canonical and 0 remain mislabeled
  - canonicalization is pure (idempotent across two calls)
  - original `history[].exercises[].baseId` is unchanged after projection
- `tests/realDataHealthRepairStaticGuards.test.ts` additions
  - `src/engines/e1rmEngine.ts` does NOT import the remap (PR pool stays by `actualExerciseId`)
  - `src/engines/analytics.ts` does NOT import the remap (PR aggregation stays by record fields)
  - only `src/dataHealth/cleanAppDataView.ts` (and tests) import the remap
  - the audit `apply()` still returns `status='skipped'`
- Regression: PR / e1RM output unchanged for the 9 affected exercises.

### Browser smoke
- Boot the redacted-fixture profile.
- Confirm the Data Health passive line reports "已自动整理 N 个动作的归属链" or equivalent.
- Confirm Progress page PR / e1RM history unchanged for the 9 affected exercises.
- Confirm next-session recommendation now groups assisted-pull-up under vertical-pull (where applicable).

### Merge / deploy rules
- One PR per remap-table revision. Re-curating rows = new PR.
- Co-sign in PR body by content owner.
- No `--admin` merge.

---

## Task 3 — Duplicate Set ID Consumer Audit V1

### Scope
- Add `src/dataHealth/repairs/duplicateSetIdAuditV1.ts` to the registry — audit-only, no mutation.
- Add `tests/duplicateSetIdConsumerAudit.test.ts` that formalizes the per-consumer audit table from planning doc §7.
- Add a static guard test that no consumer in `src/cloudProduction/`, `src/cloudSync/`, `src/sync/`, `apps/api/src/`, or any future export module keys on `set.id` globally.

### Non-goals
- **No historical set ID rewrite.** Ever.
- **No schema change.**
- No change to `set.id` write path (`sessionBuilder`, `focusModeStateEngine`).
- No change to record-edit API.
- No introduction of `stableSetUid` in this task (that is Task 4).

### Files likely affected
- `src/dataHealth/repairs/duplicateSetIdAuditV1.ts` (new).
- `src/dataHealth/appDataRepairRegistry.ts` — register the audit.
- `tests/duplicateSetIdConsumerAudit.test.ts` (new).
- `tests/realDataHealthRepairUnits.test.ts` — extend.
- `tests/realDataHealthRepairStaticGuards.test.ts` — add static guards.
- `docs/REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md` — update Remaining risks line.

### Data safety boundaries
- `apply()` returns `status='skipped'`, `repairedData === appData`, no mutation.
- Audit-only severity = `info`.
- Does not gate upload eligibility.
- No localStorage write.

### Schema impact
**None.** Set IDs are immutable historically.

### Tests
- `tests/duplicateSetIdConsumerAudit.test.ts`
  - detector returns the duplicate count for the V1 redacted fixture
  - `apply()` returns `status='skipped'`, no AppData diff
  - idempotent (two calls → same idempotency key)
- Static guards
  - no file under `src/cloudProduction/`, `src/cloudSync/`, `src/sync/` reads `set.id` directly (`grep` source text)
  - registry export includes `duplicateSetIdAuditV1`
  - the audit's `affectedAppDataPaths` is empty

### Browser smoke
- Boot the redacted-fixture profile.
- Confirm the Data Health passive line includes the audit count (or is silent if severity=info chooses to be silent — match V1 audit-only UX).
- Confirm record-edit on a duplicated `set.id` session still works (no regression on session-scoped addressing).

### Merge / deploy rules
- One PR.
- No `--admin` merge.

---

## Task 4 — Optional: Stable Set UID V1

### Scope
- Add `src/engines/stableSetUid.ts` — a pure helper `stableSetUid(sessionId, exerciseIndex, setIndex, setId?)` returning a derived string.
- Add static guard: any new consumer under `src/cloudProduction/`, `src/cloudSync/`, `src/sync/`, or any export module that joins on set-level identity must import `stableSetUid` instead of `set.id`.

### Non-goals
- **Do not rewrite historical `set.id`.**
- **Do not add `stableSetUid` to the schema.**
- Do not introduce this helper if no consumer needs it. The task is opt-in.

### Files likely affected
- `src/engines/stableSetUid.ts` (new).
- `tests/stableSetUid.test.ts` (new).
- `tests/realDataHealthRepairStaticGuards.test.ts` — add the static guard.

### Data safety boundaries
- Pure helper. No I/O. No mutation.

### Schema impact
**None.**

### Tests
- `tests/stableSetUid.test.ts`
  - deterministic over input quadruple
  - handles missing `setId` (uses empty string segment)
  - is reversible into its parts (optional, only if a parser ships)
- Static guard
  - no file imports both `set.id` field access and `stableSetUid` mixin in the same module

### Browser smoke
- Not required (no UI surface in this task).

### Merge / deploy rules
- Only ship if a concrete consumer needs global uniqueness.
- Otherwise close as "not needed".

---

## Task 5 — Optional: Exercise Identity Migration V1

### Scope (V3+, gated on owner + content-team approval)
- One-time backfill: rewrite `history[].exercises[].baseId` and `equivalenceChainId` based on the curated remap.
- This is destructive identity rewrite. **Highest risk class.**
- Must run through `autoRepairOrchestrator` with backup-first and full receipt.

### Non-goals
- **Do not ship this task before Tasks 1–3 have been live for at least one release cycle.**
- Do not skip the schema-version bump if any field is added in the process.
- Do not skip the regression fixture — every chain member must be covered.

### Files likely affected
- `src/dataHealth/repairs/replacementEquivalenceRecordRewriteV3.ts` (new).
- `src/dataHealth/appDataRepairRegistry.ts` — register the safe-auto repair.
- `tests/replacementEquivalenceRecordRewriteV3.test.ts` (new).
- `tests/realDataHealthRepairUnits.test.ts` — extend.
- `tests/realDataHealthRepairStaticGuards.test.ts` — extend.
- `docs/REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md` — extend.

### Data safety boundaries
- Backup-first (orchestrator handles).
- Receipt captured with full before/after diff.
- Cloud upload gates on `dataHealthAutoRepairLastRunAt >= appDataLastChangedAt` — already enforced by V3 guard.
- Reversible via per-receipt undo (deferred from V1).

### Schema impact
- Adds `legacyBaseIdAtRewrite?: string` per affected `TrainingSetLog` for provenance. Requires schema bump.

### Tests
- Per-row regression fixture with every member of every chain.
- PR / e1RM parity test — pool composition unchanged because `actualExerciseId` is unchanged.
- Cloud-upload parity test — confirm the new `appDataHash` is uploaded exactly once.
- Receipt parity test — `affectedIds` lists exactly the affected `(sessionId, exerciseId)` tuples.
- Idempotency: applying twice → `status='unchanged'` on second run.

### Browser smoke
- Manual acceptance against a synthetic fixture per chain member.
- Confirm Progress / Calendar / Record views render unchanged in the visible UI.
- Confirm Data Health passive line reports the one-time backfill count.

### Merge / deploy rules
- Two-person review minimum: data-health architecture + content owner.
- Mandatory before-merge: `npm run typecheck`, `npm test`, `npm run build`, `node scripts/scan-production-dist-safety.mjs`, `npm run api:dev:build`, `git diff --check`.
- No `--admin` merge.
- Staged rollout: enable behind a settings flag for one release before making it the default repair.

---

## Cross-cutting requirements

All five tasks share these baseline requirements:

1. **Honor [DATA_REPAIR_POLICY.md](DATA_REPAIR_POLICY.md) 10 questions in the PR body.**
2. **Use [appDataIngressPipeline.ts:processIncomingAppData](../src/dataHealth/appDataIngressPipeline.ts)** for any new AppData ingress (if applicable).
3. **Use [uploadEligibilityGuard.ts:ensureCloudUploadEligible](../src/dataHealth/uploadEligibilityGuard.ts)** if any cloud upload is touched (none of these tasks should touch upload, but the guard import invariant remains static-enforced).
4. **No silent mutation in `sanitizeData`.**
5. **No backwards-compatibility shims.** Repairs are first-class registry entries or they do not exist.
6. **No `--admin` merge. No `--no-verify`. No branch-protection bypass.**
7. **Background / default / cloud-primary sync stays disabled** (V3+V4 invariants).
8. **All tests live under `tests/` with the `realDataHealthRepair*` or `dataIntegrity*` prefix** so the existing static guards pick them up.

## Approval gate

This task list is the approval gate. Implementation of any task is BLOCKED until:

- The planning doc ([DATA_INTEGRITY_REMEDIATION_PLANNING_V1.md](DATA_INTEGRITY_REMEDIATION_PLANNING_V1.md)) is merged.
- The specific task's PR cites the planning doc by file path and references the relevant `§` section.
- The PR body answers the 10 questions in [DATA_REPAIR_POLICY.md](DATA_REPAIR_POLICY.md).
- For Task 2 / 5, the content owner has co-signed the curated remap rows.
- For Task 5, the schema bump has a separate, pre-approved migration plan.

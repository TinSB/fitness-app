# IronPath Data Repair Policy

Status: required, enforced by review
Last updated: 2026-05-27
Owner: data-health architecture

This policy applies to every code change that alters data semantics. A "data-semantic change" is any change that affects what AppData fields mean, how they are written, or how downstream engines read them. UI-only changes are out of scope.

## Why this exists

IronPath ran as an MVP while the app was being actively developed. Many historical training records were written by old code paths and old bugs. Recommendation rewrites and engine fixes do not heal the AppData that previous code wrote — dirty data remains in AppData and continues to poison new recommendation logic.

This is why every data-semantic change requires both a code fix AND a repair path. See [REAL_DATA_HEALTH_REPAIR_SYSTEM_V1_PLAN.md](REAL_DATA_HEALTH_REPAIR_SYSTEM_V1_PLAN.md) for the V1 implementation.

## 10-question policy

For every PR that changes data semantics, the PR body must answer:

1. **Did the bug write bad data?** Yes / No / Unknown. If "Unknown", explain how the diagnosis was attempted.
2. **Where is the bad data stored?** Path(s) into AppData (`history[].exercises[].sets[].setIndex`, `screeningProfile.adaptiveState.issueScores`, etc.).
3. **How do we detect old bad data?** Either reference an existing `RepairDefinition.detect` or describe the new one.
4. **Which layer does the repair live in?** Runtime Guard (non-mutating; always-on at CleanAppDataView) / Safe Auto (background; backup-first; receipt) / Audit Only (detect; no mutation) / Requires-schema-change (BLOCKED — file separate proposal).
5. **Is repair destructive?** Yes / No. If yes, justify under the V1 data safety rules.
6. **Does repair require backup?** Yes / No. If yes, the orchestrator auto-creates the local backup; no popup.
7. **Does cloud sync need to wait for the repair?** Yes / No. Cloud upload always waits for orchestrator to finish (`dataHealthAutoRepairLastRunAt >= appDataLastChangedAt`). If the repair is high-risk, it should stay audit-only so it does not affect upload eligibility.
8. **What regression fixture proves this?** Path to a fixture in `tests/fixtures/` that reproduces the dirty data shape.
9. **What repair receipt is recorded?** `DataRepairLogEntry` shape — `repairId`, `category`, `action`, `affectedIds`, `beforeSummary`, `afterSummary`.
10. **What user-visible Data Health issue appears?** Exact Chinese title + message that surfaces in `DataHealthClarityPanel`.

## Required artifacts

A compliant PR ships:

- **Code change** that fixes the new write path.
- **Registry entry** in `src/dataHealth/appDataRepairRegistry.ts` (new or extended).
- **Repair module** under `src/dataHealth/repairs/<verbNoun>V<n>.ts` (or a documented "no repair needed" decision).
- **Regression fixture** in `tests/fixtures/` named after the bug.
- **Tests** under `tests/` prefixed `realDataHealthRepair*` for repair tests, or `realDataRegression*` for fixture-driven tests.
- **PR-body answers to the 10 questions** above.

## When a repair is not needed

Some data-semantic changes do not require a repair. Examples:

- Adding a new optional AppData field with a safe default (no old data is "wrong" — just missing the new field).
- Changing the UI label of an existing field without changing semantics.
- Performance refactors that do not change what is written.

In these cases, the PR body must say: **"No repair needed because: [reason]."** Reviewers should challenge anything that looks like a semantic change disguised as a refactor.

## When a repair requires schema change

If the only honest repair is a new schema field (e.g., promoting `completionQuality` to first-class):

- STOP — do not implement.
- Open a separate PR proposing the migration with explicit owner approval.
- The original PR is held until the schema change lands.
- Document this in [REAL_DATA_HEALTH_REPAIR_SYSTEM_V1_PLAN.md §19](REAL_DATA_HEALTH_REPAIR_SYSTEM_V1_PLAN.md#19-open-questions-for-follow-up) so the question is tracked.

## Ingress linkage (V2)

Any feature that introduces or replaces AppData at runtime — file import, backup restore, cloud restore, cloud pull, read mirror, cloud parity, account switch, post-session save, Apple Health import — MUST flow through the central ingress pipeline `src/dataHealth/appDataIngressPipeline.ts:processIncomingAppData`. New ingress paths must:

1. Pick an `AppDataIngressSource` enum value (or add a new one and update the per-source defaults table).
2. Call `processIncomingAppData({ source, appData, ... })` before adopting the snapshot into local state.
3. Persist using `result.repairedAppData ?? originalAppData` (gated by `result.shouldPersist`).
4. Consult `result.shouldBlockCloudUpload` and `result.uploadEligibility` before any cloud write.
5. Pass the static checks in `tests/dataHealthCloudRestoreLinkageStaticGuards.test.ts`.
6. No raw cloud / restored AppData may feed `buildTrainingDecisionContext` directly. The engine pipeline already wraps via `buildCleanAppDataView`; any non-pipeline call site must explicitly clean the input.

See [DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md](DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md) for the per-source defaults table and the upload eligibility predicate.

## Anti-patterns

- **Silent mutation in `sanitizeData`**: `sanitizeData` in `src/storage/appDataSanitize.ts` must remain a shape-coercer, not a semantic repairer. If you need to repair, write a registry entry — do not extend `sanitize`.
- **Deleting "old" data**: deleting `history`, `sets`, `bodyWeights`, `recommendationSnapshots`, or `programAdjustmentHistory` is forbidden. Mark or degrade confidence instead.
- **Blocking modal for safe repairs**: safe-auto repairs run in the background after an automatic local backup. They MUST NOT show a confirm dialog. Reserve modals for genuinely destructive identity rewrites (none ship in V1).
- **Coupling cloud upload to repair**: the repair flow must not call `cloudPushCandidate` directly. The orchestrator persists via the normal write path, and the next sync window picks up the repaired snapshot. Upload gates only on `dataHealthAutoRepairLastRunAt >= appDataLastChangedAt`.
- **Letting raw AppData reach the recommendation engine**: V2 engines must consume `CleanAppDataView`. Even when raw AppData is dirty, the Runtime Guard layer makes the recommendation engine see clean inputs.
- **Console-logging repair details**: production builds must not log `before`/`after` snapshots. Receipts go to `AppData.settings.dataRepairLogs` only.
- **"This is just a quick fix — no repair needed"**: if the bug already wrote dirty data, a code fix without a repair is incomplete. Either ship the repair (or Runtime Guard rule) or document that the data is harmlessly stale (with reasoning).

## Static enforcement (V1 partial)

The V1 test suite contains static guards:

- `realDataHealthRepairLegacyFieldGuard.test.ts` proves `buildTrainingDecision` does NOT read `exercise.suggestion`, `exercise.adjustment`, `exercise.warning`, `exercise.prescription.weeklyAdjustment`, `session.explanations`, or `deloadDecision.title/options`.
- `realDataHealthRepairTodayStatusFreshness.test.ts` proves the readiness pipeline degrades or skips stale `todayStatus` past the configured threshold.
- `realDataHealthRepairHealthDataFreshness.test.ts` proves the readiness pipeline degrades or skips stale health data past the configured threshold.

Future enforcement (V2 target):

- A meta-test that fails CI if a new `RepairDefinition` is added without a matching test file under `tests/data-health/`.
- A lint rule that flags any new write path into `screeningProfile.adaptiveState.issueScores` without a paired decay/cap commit.

## Reviewer checklist

When reviewing a data-semantic PR, confirm:

- [ ] PR body answers all 10 questions OR documents "no repair needed because ...".
- [ ] If a repair was added: registry entry exists, repair module exists, tests exist, fixture exists.
- [ ] No deletions of history / sets / body weights / recommendation snapshots.
- [ ] No silent mutation in `sanitizeData`.
- [ ] No coupling of cloud upload to repair flow.
- [ ] The receipt category, action, and affectedIds are accurate and Chinese-localized.
- [ ] The data health UI surface (`DataHealthClarityPanel`) shows the new issue if appropriate.

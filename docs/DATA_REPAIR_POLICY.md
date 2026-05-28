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

## Cloud upload eligibility enforcement (V3)

Any feature that uploads AppData to cloud — explicit first upload, future `cloudPushCandidate`, production-acceptance orchestrator, manual upload, future background sync — MUST call the central guard `src/dataHealth/uploadEligibilityGuard.ts:ensureCloudUploadEligible`. The guard's contract:

1. Always calls `evaluateCloudUploadEligibility` internally. Callers MUST NOT duplicate eligibility logic.
2. Returns `{ ok, reason, eligibility?, repairSummary?, receiptSummary?, passiveStatus, safeUserMessage, hiddenDebugDetails? }`.
3. Callers branch ONLY on `guard.ok`. When `guard.ok === false`, the upload MUST NOT happen — no `gateway.writeSnapshot`, no Supabase `.insert`/`.upsert`, no fake success flags.
4. Failed eligibility MUST surface as a compact passive status (`数据正在自动整理，稍后同步` / `数据已整理完成，可同步` / `同步暂缓，等待数据整理完成`). No modal, no popup, no raw debug dump.
5. Audit-only findings DO NOT block upload by default. Callers can opt-in with `allowAuditOnly: false` when stricter behavior is required.
6. New `snapshotKind: 'subsequent-upload'` (V4+) requires a matching repair receipt (`ledgerHashMatches === true`); V3 defaults to `'first-upload'` where the receipt requirement is OFF.

Static enforcement (`tests/cloudUploadEligibilityEnforcementStatic.test.ts`):

- Any non-test file in `src/` outside `cloudProduction/`, `sync/`, `devApi/` that imports `runProductionFullAcceptanceSync`, `buildFirstUploadExplicitApply`, or `runCloudPushCandidate` MUST also import `ensureCloudUploadEligible`.
- Only `src/dataHealth/uploadEligibility.ts` may export `evaluateCloudUploadEligibility`. No file may declare a parallel evaluator.
- The guard module MUST NOT import cloud-side write helpers, Supabase clients, or modal/popup primitives.
- Background/default/cloud-primary sync flags remain off (`cloudPrimaryEnabled: false` / `defaultSyncEnabled: false` / `backgroundWorkEnabled: false` invariants).

See [CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md](CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md) for the failure semantics matrix and the per-source / per-snapshot-kind guard behavior.

## Subsequent upload flow (V4)

Any cloud upload that happens AFTER the first explicit upload — completed sessions, edited history, restored data, repairs, manual "立即同步" actions, future opt-in periodic upload — MUST go through `src/cloudProduction/cloudSubsequentUploadFlow.ts:runCloudSubsequentUpload`. Contract:

1. The flow calls `ensureCloudUploadEligible(..., snapshotKind: 'subsequent-upload')` internally; callers MUST NOT duplicate eligibility logic.
2. The flow computes `buildAppDataSnapshotHash(appData)` and compares to `loadCloudSyncFlowState().syncedAppDataHash`. If equal it returns `{ ok: true, skipped: true, reason: 'unchanged' }` and DOES NOT call the gateway.
3. If `lastCloudSnapshot.sourceSnapshotHash` is supplied and differs from the device's expected previous hash, the flow returns `{ ok: false, reason: 'cloud_conflict' }` and DOES NOT call the gateway. Conflict resolution stays on the existing override path.
4. The flow returns one of the 12 reason values (`uploaded`, `unchanged`, `not_enabled`, `pending_safe_repairs`, `backup_failed`, `partially_repaired`, `missing_repair_receipt`, `invalid_appdata`, `cloud_conflict`, `cloud_unavailable`, `upload_failed`, `unknown`). The caller branches only on `result.ok` plus `result.reason === 'unchanged'`.
5. The flow NEVER calls Supabase directly. It dispatches via an injected `gateway: CloudSubsequentUploadGateway` so test doubles and the existing production candidate share one interface.
6. Upload success is only ever reported when the gateway returns `ok: true`; blocked uploads surface a compact passive status (`无需同步` / `本地有更新，等待同步` / `同步发现云端有新内容，请稍后再试` / `同步失败，本地数据已保留`) and DO NOT set any "synced" flag.

Static enforcement (`tests/cloudSubsequentUploadFlowStatic.test.ts`):

- The V4 module imports `ensureCloudUploadEligible` and dispatches with `snapshotKind: 'subsequent-upload'`.
- The V4 module does not import `@supabase/supabase-js`, `createClient`, modal/confirm/prompt primitives, or `localStorage.clear`.
- UI callers that import `runCloudSubsequentUpload` do NOT call Supabase `.insert` or `writeCloudAppDataCandidate` directly.
- UI files do not import any Supabase write helper for cloud snapshot uploads.
- The V3 guard import invariant is preserved by V4 (no caller of `runProductionFullAcceptanceSync` / `buildFirstUploadExplicitApply` / `runCloudPushCandidate` outside `cloudProduction/sync/devApi` may skip the V3 guard import).
- Background / default / cloud-primary sync stays disabled.

See [CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4.md](CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4.md) for the dirty-state design, conflict handling, and the V4→V5 risk register.

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
- `trainingDecisionCleanInputContractStaticGuards.test.ts` (delivered in [TRAININGDECISION_CLEAN_INPUT_CONTRACT_LOCK_V1.md](TRAININGDECISION_CLEAN_INPUT_CONTRACT_LOCK_V1.md)) locks the *input* side: UI / feature / cloud paths cannot import `buildTrainingDecision` or `buildTrainingDecisionContext` directly. They must go through the `CleanTrainingDecisionInput` factory.

TrainingDecision input contract:

- TrainingDecision must never consume raw AppData. The only legal entry points for production code are `buildEnginePipeline(...)` (which internally builds `CleanAppDataView`) or `buildTrainingDecisionFromCleanInput(createCleanTrainingDecisionInput(cleanView, metadata))`.
- Every new TrainingDecision caller MUST use `CleanTrainingDecisionInput` or `CleanTrainingDecisionContextSource` from `src/engines/trainingDecisionCleanInput.ts`. PR review must reject any new caller that imports `buildTrainingDecision` or `buildTrainingDecisionContext` from the raw engine modules.
- Any future "new recommendation engine" must declare whether it is *signal-only* (consumes cleaned signals only; never emits the final user-facing recommendation) or *final decision* (the next iteration of TrainingDecision). Final-decision engines must accept only branded clean input.
- Legacy advice fields (`exercise.suggestion`, `exercise.adjustment`, `exercise.warning`, `prescription.weeklyAdjustment`, `session.explanations`, `session.deloadDecision`) are **snapshot-only** — they may be read by UI presenters to render historical sessions, but **never as a live recommendation signal** by any engine.

Future enforcement (V2 target):

- A meta-test that fails CI if a new `RepairDefinition` is added without a matching test file under `tests/data-health/`.
- A lint rule that flags any new write path into `screeningProfile.adaptiveState.issueScores` without a paired decay/cap commit.
- Lock `sessionBuilder.scoreSuggestedTemplates` and `sessionBuilder.pickSuggestedTemplate` signatures to require `CleanTrainingDecisionInput` / `CleanTrainingDecisionContextSource`.

## Reviewer checklist

When reviewing a data-semantic PR, confirm:

- [ ] PR body answers all 10 questions OR documents "no repair needed because ...".
- [ ] If a repair was added: registry entry exists, repair module exists, tests exist, fixture exists.
- [ ] No deletions of history / sets / body weights / recommendation snapshots.
- [ ] No silent mutation in `sanitizeData`.
- [ ] No coupling of cloud upload to repair flow.
- [ ] The receipt category, action, and affectedIds are accurate and Chinese-localized.
- [ ] The data health UI surface (`DataHealthClarityPanel`) shows the new issue if appropriate.

## Cloud upload immunity chain

Repair is one layer in a stack of orthogonal guarantees that protect AppData on its way to the cloud. The full chain, in execution order inside `runCloudSubsequentUpload`:

1. **V1 Real Data Health Repair** — local mutations always run through the repair orchestrator before being persisted; receipts record what changed and why.
2. **V2 Data Health Cloud Restore Linkage** — the cloud→local ingress pipeline applies repairs on restore so an old cloud snapshot can never poison a fresh device.
3. **V5 Cloud Optimistic Concurrency** — `runCloudSubsequentUpload` re-reads cloud `latest` and refuses to upload when the remote hash no longer matches the local synced (expected-previous) hash, eliminating the multi-device "stale base append" race within the client. See [`CLOUD_OPTIMISTIC_CONCURRENCY_V5.md`](CLOUD_OPTIMISTIC_CONCURRENCY_V5.md).
4. **V3 Cloud Upload Eligibility Enforcement** — `ensureCloudUploadEligible` blocks the write when the AppData has pending safe-auto repairs, a recent backup failure, partial-repair state, missing repair receipts, or an invalid AppData shape. See [`CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md`](CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md).
5. **V4 Cloud Subsequent Upload Flow** — `runCloudSubsequentUpload` itself: hashes, owner-mismatch guard, V4 caller-supplied `lastCloudSnapshot` legacy short-circuit, then write through an injected gateway. See [`CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4.md`](CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4.md).

Each layer is non-destructive: nothing in the chain deletes a cloud row, nothing clears `localStorage`, nothing overwrites an unknown remote latest. Append-only `cloud_appdata_snapshots` is **not** conflict-safe on its own — V5 is the client-side ceiling and a future V6 server-side compare-and-insert RPC would close the remaining residual race.

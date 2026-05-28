# Real Data Health Repair System V1 — Delivered

Status: delivered in PR [#385](https://github.com/TinSB/fitness-app/pull/385)
Branch: `claude/real-data-health-repair-system-v1`
Plan: [REAL_DATA_HEALTH_REPAIR_SYSTEM_V1_PLAN.md](REAL_DATA_HEALTH_REPAIR_SYSTEM_V1_PLAN.md)
Policy: [DATA_REPAIR_POLICY.md](DATA_REPAIR_POLICY.md)

## 1. User problem

IronPath ran as an MVP while the recommendation system was being actively rewritten. Older app versions wrote dirty data that current code can no longer produce, but the dirty data still lives in AppData and continues to poison the recommendation engine. The user reports that the system still pushes conservative recommendations even after the V2 rewrite. Cleaning code at HEAD does not heal AppData. This V1 introduces a permanent data immunity layer.

## 2. Real export findings (`ironpath-2026-05-27.json`)

Diagnosed against the user's real export (schemaVersion=8, 10 history sessions). All findings reproduced in the redacted fixture `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`.

| Class | Incidence | Example |
|---|---|---|
| Completed-session lifecycle residue | 10/10 sessions | every completed session has `restTimerState.isRunning=true` plus stale `currentExerciseId` / `currentFocusStepId` / `focusActualSetDrafts` |
| Impossible duration | 1/10 | `session-1777936222822` (2026-05-04 腿 A): `durationMin=4204`, `finishedAt-startedAt` span = 70.1 hours |
| Partial completion mislabeled | 2/10 | completed=true plus `earlyEndReason=incomplete_main_work` |
| Stale `todayStatus` | 1 | date=2026-05-04 vs export 2026-05-27 |
| Stale Apple Health | 1 | latest sample 2026-04-28 (29d old), `useHealthDataForReadiness=true` |
| `screeningProfile.adaptiveState.issueScores` explosion | 4 keys | `scapular_control=1846`, `upper_crossed=1206`, `breathing_ribcage=1206`, `thoracic_rotation=640` while every `movementFlags` is `good` |
| Legacy final-advice fields | every session | each session retains 6 `explanations` + every exercise still carries `suggestion`/`adjustment`/`warning`/`prescription.weeklyAdjustment` |
| `setIndex` collapse | 131/131 sets | every logged set has `setIndex=0` |
| Set-ID duplicates across sessions | 42/48 ids | e.g. `lat-pulldown-1` reused in 4 different sessions |
| Replacement/equivalence chain mismatch | 9 exercises | `assisted-pull-up` inherits the `horizontal-pull` chain via `baseId=barbell-row`; `assisted-dip` inherits the `fly` chain via `baseId=cable-fly` |

## 3. Repair registry architecture

Three layers, no popups:

- **Runtime Guard** (`src/dataHealth/dataHealthRuntimeGuard.ts` + `src/dataHealth/cleanAppDataView.ts`): pure, non-mutating projection. Strips legacy advice from sessions, suppresses completed-session pointers/timers, derives a sane `durationMin` fallback, marks stale `todayStatus`/health for readiness, caps `issueScores`, filters phantom `performanceDrops`. Consumed by `buildEnginePipeline` before `buildTrainingDecisionContext`. Recommendation V2 never sees raw dirty data.

- **Safe Auto Repair** (`src/dataHealth/autoRepairOrchestrator.ts` + `src/dataHealth/appDataRepairEngine.ts` + `src/dataHealth/repairs/*`): scheduled at boot via `App.tsx` `useEffect`. Creates a local IndexedDB backup (`ironpath_auto_repair_backup_*`), applies the safe-auto repair set, writes a `DataRepairLogEntry` receipt + a `DataHealthRepairLedgerEntry`, persists via the normal `saveData` path. Idempotent by `(repairId, affectedIds)` hash plus post-state `detect` convergence. Backup failure leaves AppData untouched — Runtime Guard keeps the recommendation engine safe.

- **Audit Only**: detection-only repairs surfaced through the ledger.

Supporting files:
- `src/dataHealth/appDataRepairTypes.ts` — `RepairLayer`, `RepairDefinition`, `DataHealthRepairLedgerEntry`, runtime-flag shape, constants.
- `src/dataHealth/appDataRepairLedger.ts` — `readLedger`, `appendLedgerEntry`, `isIdempotentMatch`, `summarizeLedger`. Stored at `AppData.settings.dataHealthRepairLedger` (open settings slot — no schema change).
- `src/dataHealth/appDataRepairRegistry.ts` — V1 registry export + lookup.
- `src/dataHealth/autoRepairBackupAdapter.ts` — IndexedDB primary / localStorage fallback / in-memory last-resort. Retention: 5 entries.

## 4. Repair IDs

| repairId | Layer | What it does |
|---|---|---|
| `sessionLifecycleResidueV1` | Safe Auto | Stops timers, clears `currentExerciseId`/`currentFocusStepId`/`currentSetIndex`, drops `focusActualSetDrafts` from completed sessions. Sets and history preserved. |
| `impossibleDurationV1` | Safe Auto | Replaces `durationMin > 240min` (or `finishedAt-startedAt > 360min`) with the sane span when available, else fallback 60min and `durationInvalid=true`. Startedat/finishedAt/sets preserved. |
| `staleTodayStatusV1` | Safe Auto | Marks `settings.dataHealthRuntimeFlags.todayStatusIgnoredAt` + `observedDate` so the Runtime Guard skips stale subjective state. User-entered fields preserved. |
| `staleHealthReadinessGuardV1` | Safe Auto | Marks `settings.dataHealthRuntimeFlags.healthDataStaleSince` when latest health sample is older than 14 days. `useHealthDataForReadiness` user preference preserved. |
| `screeningIssueScoreRuntimeGuardV1` | Runtime Guard | Caps `issueScores` (hard 50; soft 12 when movementFlags all good and no pain/restriction) at view time. No AppData mutation. |
| `screeningIssueScoreRepairV1` | Safe Auto | Writes capped values to AppData only when movementFlags all good AND `painTriggers=[]` AND `restrictedExercises=[]`. Receipt captures before/after. `painByExercise` / `painTriggers` / `restrictedExercises` preserved. |
| `legacyFinalAdviceIsolationGuardV1` | Runtime Guard | CleanAppDataView never surfaces `exercise.suggestion`/`adjustment`/`warning`/`prescription.weeklyAdjustment`, `session.explanations`, `session.deloadDecision` to TrainingDecision V2. AppData retains them for historical UI rendering. |
| `setIndexRenumberV1` | Safe Auto | Renumbers `setIndex` to its array index (0..n-1) when the array has all-zero or duplicate indices. Real weight/reps/RIR preserved. |
| `replacementEquivalenceAuditV1` | Audit Only | Detects vertical-pull on horizontal-pull chain and vertical-push on fly chain. No auto-mutation — needs curated remap table. |

## 5. Dry-run / apply behavior

Every `RepairDefinition` exposes `detect`, `dryRun`, and (when safe) `apply`:

- `detect` is pure; returns `{ detected, occurrences, affectedIds, severity, userMessage }`.
- `dryRun` extends `detect` with `{ changeSummary, changedPaths, beforeAfterSample (≤3), idempotencyKey }`. Repeated invocations on the same AppData produce the same `idempotencyKey` (verified by test `realDataHealthRepairDryRunIsPureAndIdempotent`).
- `apply` clones AppData, mutates, returns `{ status, repairedData, receipt, warnings }`. `runRepair` in the engine appends the receipt to `settings.dataRepairLogs` (capped 500). Audit-only repairs return `status='skipped'` without mutation.

## 6. Backup-first behavior (no popup)

`AutoRepairOrchestrator` calls `LocalBackupAdapter.snapshot` before applying any safe-auto repair. The backup record carries the pre-repair `appDataHash` and the `repairIdScope`. Failure is non-fatal — the orchestrator records `status='backup_failed'` in the ledger, no mutation occurs, Runtime Guard continues to protect recommendation output. File downloads are never forced for automatic flows; the existing manual `exportAppData` download flow is unchanged.

## 7. Receipt format

`DataRepairLogEntry` (UI-facing, capped 500 at `AppData.settings.dataRepairLogs`):
```ts
{ id, repairId, createdAt, repairedAt, category, action, affectedIds, beforeSummary, afterSummary, before?, after? }
```

`DataHealthRepairLedgerEntry` (idempotency authority, capped 1000 at `AppData.settings.dataHealthRepairLedger`):
```ts
{ ledgerId, repairId, idempotencyKey, appliedAt, triggeredBy, status, occurrences, affectedIds,
  appDataHashBefore?, appDataHashAfter?, backupId?, receiptId?, warnings[] }
```

## 8. Tests added

38 tests across four files (all prefix `realDataHealthRepair*`):

- `tests/realDataHealthRepairFixture.test.ts` — fixture loads with schemaVersion 8; CleanAppDataView diagnostics catch all dirty-data classes A–F; registry exposes the V1 repair set.
- `tests/realDataHealthRepairUnits.test.ts` — 19 per-repair detect/apply tests covering every V1 repair, plus non-destructive guarantees (history/sets length preserved) and idempotency of dryRun.
- `tests/realDataHealthRepairPipeline.test.ts` — orchestrator boots without popup, applies repairs only after successful backup, treats backup failure as non-mutating, runs idempotently across two cycles, exposes `DataHealthAutoRepairSummary`.
- `tests/realDataHealthRepairStaticGuards.test.ts` — engine pipeline source contains `buildCleanAppDataView` and feeds `buildTrainingDecisionContext` from the cleaned view; `trainingDecisionEngine.ts`/`readinessEngine.ts`/`adaptiveFeedbackEngine.ts` do not reference legacy advice field paths; `App.tsx` schedules `runAutoRepairOrchestrator({ triggeredBy: 'boot' })`; orchestrator source has no `confirm(`/`alert(`/`prompt(`/`window.confirm`.

Full suite: 5592/5592 passing.

## 9. Browser smoke

- `npm run build` produces a clean Vite bundle that includes the new `DataHealthClarityPanel` chunk with the passive status line.
- `node scripts/scan-production-dist-safety.mjs` passes — no forbidden visible copy, no secret-like patterns in the bundle.
- `npm run api:dev:build` succeeds — SSR runtime bundle builds.

End-to-end interactive smoke requires opening the deployed PWA against the redacted fixture and confirming:
- Boot triggers orchestrator (visible in Data Health page status line as "已自动修复 X 个旧版本问题").
- Completed sessions display without running rest timers.
- Today readiness no longer surfaces 23-day-old subjective state.
- Recommendation does not push "conservative" on a CleanAppData view with all `movementFlags=good`.

The orchestrator is wired through the existing `setData` / `saveData` write path so smoke validation only needs to verify the passive status line + recommendation output.

## 10. Data safety statement

V1 enforces these hard rules and is covered by tests:

- No deletions: completed sessions, sets, body weights, recommendation snapshots, program adjustment history, pain history, PR/e1RM history stay intact.
- No localStorage clearing.
- No direct cloud snapshot writes from the orchestrator.
- AppData schema version (`schemaVersion=8`) unchanged. All new state lives in open settings slots:
  `settings.dataHealthRuntimeFlags`, `settings.dataHealthRepairLedger`, `settings.dataHealthAutoRepairSummary`, plus existing `settings.dataRepairLogs`.
- No exposure of tokens / env vars / API keys / raw private data in receipts or UI.

## 11. Cloud sync safety

- V1 orchestrator hooks at boot only. Existing sync upload paths remain unchanged.
- The repaired snapshot will be uploaded on the next normal sync window through the existing sync candidate flow because the orchestrator persists via `setData` + `saveData` and dispatches the new `data_health_auto_repaired` derived-state invalidation event.
- `cloudParityCheck` already treats `settings.dataRepairLogs` as content-stable; the new `dataHealthRepairLedger` is in the same settings root and is therefore part of the same parity envelope.
- **V2 follow-up shipped**: `processIncomingAppData` + `evaluateCloudUploadEligibility` route every AppData ingress (import, backup restore, cloud restore, cloud pull, read mirror, parity, post-session, account switch) through the V1 immunity layer. See [DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md](DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md).

## 12. Remaining risks

- `partialCompletionAuditV1` (Class C) ships as audit-only — promoting it requires a `completionQuality` first-class field (schema bump).
- `duplicateSetIdAuditV1` (Class I) deferred — need a downstream consumer audit before a safe rewrite.
- `replacementEquivalenceAuditV1` (Class J) audit-only — needs a content-side curated remap table.
- Per-receipt `appDataRepairUndo` deferred to V2.
- Cloud restore / read mirror trigger (orchestrator at cloud-restore time) deferred to V2 — V1 already protects via Runtime Guard at every read path, so this is an automation gap, not a safety gap.

## 13. Future repair policy

Every future bug fix that changes data semantics MUST answer the 10 questions in [DATA_REPAIR_POLICY.md](DATA_REPAIR_POLICY.md) and ship either a registry entry (Runtime Guard / Safe Auto / Audit Only) or an explicit "no repair needed because ..." justification in the PR body. The Runtime Guard layer is the primary fallback whenever a Safe Auto repair is unsafe to write — it never mutates AppData but always shields the recommendation engine.

## 14. PR delivery

- PR: [#385](https://github.com/TinSB/fitness-app/pull/385)
- Branch: `claude/real-data-health-repair-system-v1`
- Validation: `npm run typecheck`, `npm test` (5592/5592), `npm run build`, `node scripts/scan-production-dist-safety.mjs`, `npm run api:dev:build`, `git diff --check`, no `package.json`/lockfile drift, no `pnpm-lock.yaml`.

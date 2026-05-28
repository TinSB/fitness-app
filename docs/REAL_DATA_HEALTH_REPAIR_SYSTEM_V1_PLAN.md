# Real Data Health Repair System V1 — Revised Design Plan (Automation-First)

Status: revised draft, awaiting approval before implementation
Last updated: 2026-05-27
Owner: data-health architecture
Branch: `claude/real-data-health-repair-system-v1`
Real-user regression fixture: `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`

## 0. Reset note

This plan supersedes the earlier manual-panel design. The earlier draft pushed the user through a "view → backup → confirm → apply" flow per issue. That is rejected.

The revised plan makes Data Health Repair an **automatic data immunity layer**. Safe repairs run in the background. Runtime guards always protect TrainingDecision regardless of what raw AppData contains. The user interacts with at most a single compact passive status. Modals and walls of text are forbidden for the safe path.

## 1. Executive summary

IronPath has accumulated AppData defects from MVP-era code paths. Cleaning code at HEAD does not heal the data those bugs wrote, and that data is still poisoning the recommendation engine.

The fix is a two-layer immunity:

- **Layer A — Runtime Guard**: a pure read-side derivation that produces `CleanAppDataView`. TrainingDecision, readiness, deload, and weekly-plan engines consume the Clean view, not raw AppData. Even if raw AppData is dirty, the recommendation engine sees clean inputs. No mutation.
- **Layer B — Safe Auto Repair**: a background orchestrator that runs after every AppData load (boot, import, cloud restore, post-session). It creates a local backup snapshot, applies safe repairs, writes a receipt, persists through the normal single-write path, and refreshes derived state. The user is not asked to confirm.

A third layer — **Audit Only** — detects issues that require human curation (replacement chain remap, set-id rewrite, partial-completion promotion). These never mutate AppData; the Runtime Guard handles their impact on recommendations.

UI surface is one compact passive line. No popups. No "please choose repair" flow.

## 2. Real-export evidence summary

Diagnosed against `ironpath-2026-05-27.json` (schemaVersion=8, 10 history sessions):

| # | Class | Real-export incidence | Layer |
|---|---|---|---|
| A | Completed-session lifecycle residue | 10/10 sessions | Safe Auto |
| B | Impossible duration (4204 min) | 1/10 | Safe Auto |
| C | Partial-completion mislabeled | 2/10 | Audit Only |
| D | Stale todayStatus (23d old) | 1 | Runtime Guard + Safe Auto |
| E | Stale Apple Health (29d old) + `useHealthDataForReadiness=true` | 1 | Runtime Guard + Safe Auto |
| F | `issueScores` explosion (640–1846 vs all `movementFlags=good`) | 4 keys | Runtime Guard + Safe Auto |
| G | Legacy final-advice fields (`suggestion/adjustment/warning/explanations/...`) | every session | Runtime Guard (always) + Audit |
| H | `setIndex` collapse (131/131 sets are 0) | 51 exercises | Safe Auto |
| I | Set-ID duplicates across sessions | 42/48 IDs | Audit Only |
| J | Replacement/equivalence chain mismatch | 9 exercises | Audit Only (+Runtime Guard prevents poison via Clean view) |

The user reports the system "still pushes conservative recommendations". With Layer A in place, even before Layer B runs, the recommendation engine sees: capped issueScores, stale todayStatus skipped, stale health degraded, legacy advice fields invisible, completed sessions presented with timers stopped, and 4204-min sessions presented with a sane fallback duration.

## 3. Architecture — automation-first pipeline

```
[App boot / import / cloud restore / post-session complete]
        │
        ▼
[loadData → migrate → sanitize]   ← shape-only; no semantic repair
        │
        ▼
[DataHealthRuntimeGuard.derive(rawAppData)]      ← pure; non-mutating
        │
        ▼
[CleanAppDataView]   ← what every recommendation engine reads
        │
        ├──► [TrainingDecision / readiness / deload / weekly plan]   uses CleanAppDataView
        │
        ▼
[AutoRepairOrchestrator.runAfterLoad(rawAppData)]  ← background, async
        │
        ├──► [Local backup snapshot]   IndexedDB / localStorage backup adapter
        │            │ on failure → DO NOT mutate; runtime guard still protects
        │            ▼
        ├──► [run registry safe-auto repairs in order]
        │            │
        │            ▼
        ├──► [DataHealthRepairLedger.write(receipts)]
        │
        ▼
[saveData(repaired)]   ← single normal write path
        │
        ▼
[invalidateDerivedState('data_health_auto_repaired')]
        │
        ▼
[Cloud sync sees a stable repaired snapshot whose payload includes receipts]
```

Failure modes:

- **Backup adapter fails** → orchestrator skips mutation. Runtime Guard continues to provide the Clean view. UI shows: "数据正在自动整理".
- **A safe repair throws** → that repair returns `failed`; the orchestrator continues with the others. The receipt records the failure.
- **Detect returns false after apply** → idempotency satisfied. Repeat scans return `no_op`.

## 4. New file layout

```
src/dataHealth/
  appDataRepairTypes.ts              types: RepairDefinition, RepairResult, RepairScope, RepairSeverity, layer enum
  appDataRepairRegistry.ts           registry: V1 repairs grouped by layer
  appDataRepairEngine.ts             primitive: detect / dryRun / apply by id (still used by orchestrator + tests)
  appDataRepairLedger.ts             NEW: compact post-state ledger for idempotency + receipts
  cleanAppDataView.ts                NEW: derive CleanAppDataView from raw AppData; layered guards
  dataHealthRuntimeGuard.ts          NEW: pure functions per guard rule; consumed by CleanAppDataView
  autoRepairOrchestrator.ts          NEW: background runner; wires backup, registry, ledger, save
  repairs/
    sessionLifecycleResidueV1.ts                       Safe Auto
    impossibleDurationV1.ts                             Safe Auto
    staleTodayStatusV1.ts                               Safe Auto (writes ignoredForCurrentReadiness marker)
    staleHealthReadinessGuardV1.ts                      Safe Auto (writes staleAfterAt receipt)
    screeningIssueScoreRuntimeGuardV1.ts                Runtime Guard (no mutation; consumed by CleanAppDataView)
    screeningIssueScoreRepairV1.ts                      Safe Auto (writes before/after; only when uncertainty is low)
    legacyFinalAdviceIsolationGuardV1.ts                Runtime Guard + Audit (CleanAppDataView strips for V2; no AppData mutation)
    setIndexRenumberV1.ts                                Safe Auto
    replacementEquivalenceAuditV1.ts                    Audit Only
```

Existing `src/engines/dataHealthRepairEngine.ts` (`repairLegacyDisplayWeights`) stays as-is and is reachable from the registry under id `legacyDisplayWeightV1` so the orchestrator can include it in the safe-auto loop without code relocation.

## 5. Layer responsibilities

### Layer A — Runtime Guard / CleanAppDataView (always-on, non-mutating)

`CleanAppDataView` is a structural projection of raw AppData with the following derived fields, computed lazily:

| Guard | Effect on CleanAppDataView | Source rule |
|---|---|---|
| Legacy advice strip | exercises[].suggestion/adjustment/warning, exercise.prescription.weeklyAdjustment, session.explanations, session.deloadDecision are not exposed | TrainingDecision V2 contract |
| Completed-session pointer suppression | session.restTimerState reported as `{ ...rest, isRunning: false }` if `session.completed === true`; currentExerciseId/currentFocusStepId reported empty; focusActualSetDrafts reported empty | residue rule |
| Impossible duration fallback | session.derivedDurationMin = first-set→last-set span if sane, else estimated from completed working sets × template rest, else flagged `durationInvalid=true` and excluded from fatigue/recovery math | duration rule |
| todayStatus freshness | view.todayStatus.ignoredForCurrentReadiness = true if `date` older than DATA_HEALTH_TODAY_STATUS_STALE_DAYS | readiness rule |
| Health-data freshness | view.healthDataConfidence = 'stale' if latest sample older than DATA_HEALTH_HEALTH_DATA_STALE_DAYS; readiness engine drops health signal when stale | readiness rule |
| issueScores cap | view.screening.adaptiveState.issueScores values are capped at DATA_HEALTH_ISSUE_SCORE_HARD_CAP and at DATA_HEALTH_ISSUE_SCORE_SOFT_CAP when movementFlags are all `good` | deload trigger rule |
| performanceDrops sanity | drops are removed from view if every adaptiveCalibrationEntry says `outcome=on_target` for that exerciseId in last 4 sessions | deload trigger rule |

CleanAppDataView is consumed by:
- `buildTrainingDecision` (V2 entry)
- `buildReadinessResult` + `mapTodayStatusToReadinessInput`
- `buildAdaptiveDeloadDecision`
- `exercisePrescriptionEngine` (for the safe wrapper paths)
- weekly progression / plan presenter
- session explanation presenter (legacy strip)

Raw AppData remains available for:
- History list / detail rendering (shows historical advice as a snapshot, with a small `历史快照` label)
- Editing past sessions (edits go to raw AppData; the Clean view re-derives)
- Backup / export (raw + receipts)

### Layer B — Safe Auto Repair (background, automatic)

Triggered by `AutoRepairOrchestrator`:

1. After every successful `loadData` on boot.
2. After every successful `importAppData`.
3. After every cloud restore / read-mirror apply.
4. After every `completeTrainingSessionIntoHistory` write.

Sequence:
1. Compute current `appDataHash` (stable JSON-hash of repaired-relevant slices).
2. Call `DataHealthRepairLedger.list()` to skip any repair whose `idempotencyKey` was applied for the same input hash within the last 24h.
3. For each unsuppressed safe-auto repair:
   a. Run `detect`; skip if `detected=false`.
   b. Call `LocalBackupAdapter.snapshot()` — IndexedDB key `ironpath_auto_repair_backup_{timestamp}_{hash}`; fallback to in-memory snapshot if IndexedDB unavailable; if all storage fails, log and stop the orchestrator (Layer A still protects).
   c. Call `apply` on a clone of AppData.
   d. Write receipt + ledger entry.
   e. Update working AppData; continue to next repair.
4. After all repairs: single `saveData(working)`, single `invalidateDerivedState('data_health_auto_repaired')`.
5. Mark `appData.settings.dataHealthAutoRepairLastRunAt` (open settings slot — no schema change).

No popup at any stage. No "请确认". No download forced.

### Layer C — Audit Only

Runs on demand from Data Health UI (passive) or as part of the orchestrator's detect phase. Never mutates. Audit findings are surfaced as:

- `dataHealthAuditFindings` (in-memory, not persisted) for the UI.
- Receipt with `status='skipped'` and `action='audit'` (no AppData change).

## 6. Per-repair automation level

| repairId | Layer | Auto-applies? | Mutation | Backup-first | Receipt | UI |
|---|---|---|---|---|---|---|
| `sessionLifecycleResidueV1` | Safe Auto | yes | yes | yes | yes | passive |
| `impossibleDurationV1` | Safe Auto | yes | yes (sets `durationInvalid`, sane fallback) | yes | yes | passive |
| `staleTodayStatusV1` | Runtime Guard + Safe Auto | yes (marks `ignoredForCurrentReadiness=true` in raw; does not delete user-entered fields) | mark only | yes | yes | passive |
| `staleHealthReadinessGuardV1` | Runtime Guard + Safe Auto | yes (writes `settings.healthDataStaleGuard` marker; preserves `useHealthDataForReadiness`) | mark only | yes | yes | passive |
| `screeningIssueScoreRuntimeGuardV1` | Runtime Guard | always (no mutation) | none | n/a | runtime-only | none (silent guard) |
| `screeningIssueScoreRepairV1` | Safe Auto | yes when divergence is unambiguous; else audit-only | cap (before/after captured) | yes | yes | passive |
| `legacyFinalAdviceIsolationGuardV1` | Runtime Guard + Audit | strip always at view; audit detects raw presence | none | n/a | runtime + audit | passive count |
| `setIndexRenumberV1` | Safe Auto | yes (only when no `done=true` set would be reordered into a different position than its array index) | yes | yes | yes | passive |
| `replacementEquivalenceAuditV1` | Audit Only | no | none | n/a | audit | passive (details) |
| `legacyDisplayWeightV1` (existing) | Safe Auto adapter | yes | yes | yes | yes | passive |

## 7. Repair ID convention

`<verbNoun>V<majorVersion>`. The `V<n>` suffix is part of the ID. Examples: `sessionLifecycleResidueV1`, `screeningIssueScoreRuntimeGuardV1`, `screeningIssueScoreRepairV1`.

Bumping behavior or scope requires a new id (`V2`) so that historical ledger entries keyed by V1 remain interpretable.

## 8. Backup-first (automatic, no popup)

`LocalBackupAdapter` (new minimal wrapper, reuses existing `exportAppData`):

- Primary: IndexedDB store `ironpath_auto_repair_backups` (object store keyed by `id`).
- Fallback: localStorage key `ironpath_auto_repair_backup_inline_{timestamp}` (bounded; only stores compressed JSON if quota allows).
- Last resort on storage failure: in-memory only for the session, with a passive notice "本地空间紧张".
- File download is NEVER forced for automatic repairs; the existing `exportAppData` download path is only used when the user explicitly clicks "下载完整备份" in Data Health details.
- Each backup snapshot includes `appDataHash` + `triggeredBy` (boot / import / cloud / post-session) + `repairIdScope` (which repair will run after).

Retention: keep last 5 auto-repair backups; older ones are pruned (oldest first) when a new one is created. User can promote any auto-backup to a downloadable file via Data Health details bottom sheet.

If `LocalBackupAdapter.snapshot()` throws or rejects:
- `AutoRepairOrchestrator` stops the apply path.
- `DataHealthRepairLedger` records an entry with `status='backup_failed'`.
- Runtime Guard remains active so the recommendation engine is still safe.

## 9. Repair receipts and ledger

Two related structures:

### 9.1 `dataRepairLogs` (existing, capped at 500)

UI-facing log. Stored at `AppData.settings.dataRepairLogs`. Each entry uses the existing `DataRepairLogEntry` shape. The capped list is what the Data Health details surface reads.

### 9.2 `DataHealthRepairLedger` (new)

Stored at `AppData.settings.dataHealthRepairLedger` (open settings slot — no schema change).

Schema (TypeScript, plain):

```ts
type DataHealthRepairLedgerEntry = {
  ledgerId: string;                  // uuid-like
  repairId: string;
  idempotencyKey: string;            // hash of (repairId, sorted affectedIds, normalized affected snapshot)
  appliedAt: string;
  triggeredBy: 'boot' | 'import' | 'cloud_restore' | 'post_session' | 'manual' | 'audit';
  status: 'applied' | 'no_op' | 'skipped' | 'failed' | 'backup_failed';
  occurrences: number;
  affectedIds: string[];
  appDataHashBefore?: string;
  appDataHashAfter?: string;
  backupId?: string;                 // points at LocalBackupAdapter snapshot id
  receiptId?: string;                // points at the dataRepairLogs entry id
  warnings: string[];
};
```

Idempotency rules (post-state biased per user feedback):

1. After `apply` succeeds, the orchestrator calls `definition.detect(repairedData)`. If `detected=true` for the same affectedIds, the apply did not converge — orchestrator records `status='failed'` and does NOT re-run in the same orchestration cycle (avoids infinite loops).
2. Before re-applying in a future cycle, the orchestrator looks up the ledger for an entry with the same `idempotencyKey` and `status='applied'` within last 24h. If found AND current `detect` still returns `detected=false`, treat as no-op. If detect now returns detected=true (regression), proceed.
3. `dataRepairLogs` capped truncation does NOT remove ledger entries — the ledger is the authoritative idempotency record.

Ledger is also capped (1000 entries) but in a separate cap so UI truncation never invalidates idempotency state within recent activity.

## 10. Cloud sync interaction

Rule: **cloud uploads never contain a partially repaired AppData.** This means uploads occur AFTER `saveData(repaired)` in the orchestrator finishes — never during the apply window.

Mechanics:

- Existing `cloudPushCandidate` / `cloudWriteShadowCandidate` paths consume the live AppData. The orchestrator calls `saveData` once at the end, then invokes `invalidateDerivedState('data_health_auto_repaired')` which existing wiring may pick up to schedule the next upload window.
- Cloud parity (`cloudParityCheck`) is extended to understand `dataHealthRepairLedger` entries: a difference in ledger between local and cloud is expected if local just ran auto repair. This is recognized as `auto_repair_drift`, not `conflict`.
- A safe auto repair does NOT block cloud upload.
- An audit-only finding does NOT block cloud upload.
- A `screeningIssueScoreRepairV1` apply with `blocksCloudUploadUntilAccepted=true` (when present) uses a compact passive state: "数据正在自动整理，稍后同步" — no modal. Once the receipt exists and orchestrator finishes, upload eligibility returns.

Cloud restore (`cloudPullCandidate` / `readMirrorVerification`) triggers the same orchestrator flow on the restored snapshot. Restored AppData goes through migrate → sanitize → guard → orchestrator before the user is allowed to use it as live data.

## 11. Strong linkage points

Every linkage is hot-wired in V1:

| Linkage | Call site (target) | Behavior |
|---|---|---|
| App boot | `loadData()` → `App.tsx` initial effect | `DataHealthRuntimeGuard.derive` immediately; schedule orchestrator on next tick |
| localStorage read | inside `loadData()` (no behavior change to sanitize) | post-sanitize hook calls orchestrator |
| Import / restore | `importAppData()` success path | call orchestrator on the imported AppData before persisting |
| Cloud restore / read mirror | `cloudPullCandidate.apply()` / `cloudReadMirrorVerification.apply()` | orchestrator runs against the cloud-restored AppData |
| Before TrainingDecision build | `buildTrainingDecision` callers (App.tsx engine pipeline) | input wrapper passes `CleanAppDataView`, not raw AppData |
| Session complete | `completeTrainingSessionIntoHistory()` post-write | orchestrator triggered with `triggeredBy='post_session'` |
| Data Health summary | `buildDataHealthClaritySummary()` | reads ledger for "auto-repaired in last 24h" badge |
| Cloud upload eligibility | upload candidate paths | check `dataHealthAutoRepairLastRunAt` >= `appDataLastChangedAt` |
| Backup/export metadata | `exportAppData()` payload | include `dataHealthRepairLedger` (already part of settings) |

## 12. Passive minimal UI

One compact line in the existing `DataHealthClarityPanel` summary header (or its equivalent in the home/today view):

```
数据已自动检查 · 已自动修复 X 个旧版本问题 · Y 个已隔离 · Z 个待人工
```

States:

| State | Trigger | Copy |
|---|---|---|
| `clean` | last ledger run has 0 applied + 0 audit | `数据状态正常` |
| `auto_repaired` | last ledger run applied ≥ 1 | `已自动修复 X 个旧版本问题` |
| `audit_pending` | audit-only findings non-zero | `Y 个数据问题已隔离，不影响训练建议` |
| `backup_failed` | last ledger entry `status='backup_failed'` | `数据正在自动整理` |
| `mixed` | combination | concatenated comma-separated short fragments |

Affordances:
- The line is non-clickable by default in the home view.
- Inside the dedicated Data Health page, the line can expand into the details bottom sheet on tap. Bottom sheet shows a list grouped by category, each row collapsed to one line; tapping a row reveals the receipt action/affected summary. No modal.
- No "查看详情" toast spam. No "请确认" prompts for safe path.

Existing `renderIssueActions` callback in `DataHealthClarityPanel` keeps working for the legacy display-weight repair (which already shipped as a manual-confirm flow). For V1, that legacy repair MIGRATES into the auto-orchestrator and the panel no longer needs to render its confirm-style button by default.

## 13. Repair fallback rules (per user spec, codified)

| Repair | Fallback recipe (deterministic) |
|---|---|
| `impossibleDurationV1` | Try first-set `completedAt` → last-set `completedAt` span if sane (≤240min); else estimate `working_set_count × template.estimatedSetMin + warmup_count × 1.5min`; else mark `durationInvalid=true` and exclude from fatigue/recovery math (Clean view never reports invalid durations to those engines). Never use the raw 70h span. |
| `sessionLifecycleResidueV1` | Stop active timer (set `isRunning=false`, preserve `durationSec` for audit), clear `currentExerciseId`/`currentFocusStepId`/`currentSetIndex`, align `focusSessionComplete=true` only when at least one main exercise has any logged set. Do NOT delete `focusActualSetDrafts` or `focusWarmupSetLogs` unless tests prove every draft has a matching exercises[].sets[] entry; otherwise leave drafts in place and let the Clean view simply not expose them to TrainingDecision. |
| `staleTodayStatusV1` | Set `appData.todayStatus.ignoredForCurrentReadiness=true` (open boolean field via index signature on TodayStatus is not allowed — we put the flag in `settings.dataHealthRuntimeFlags.todayStatusIgnoredAt={iso}` and keep the user-entered subjective fields). Runtime Guard reads this flag and skips todayStatus for current readiness; the user is still shown their old answers when they revisit "今日状态". Current readiness asks the user to re-enter (existing UI) or falls back to health-summary-only readiness. |
| `staleHealthReadinessGuardV1` | Set `settings.healthDataStaleGuard.staleAfterAt={iso}` + `observedDaysOld`. Runtime Guard checks the marker and lowers `healthSummary.confidence` to 'low' until a new sample import bumps `latestSampleAt` within freshness. Do NOT flip `useHealthDataForReadiness=false` (that is a user preference). |
| `screeningIssueScoreRuntimeGuardV1` | NEVER mutates AppData. Clean view caps `issueScores` per pair: hard cap = 50; soft cap = 12 when ALL `movementFlags` for the user are 'good' AND `painTriggers.length === 0` AND `restrictedExercises.length === 0`. Caps applied per-key. |
| `screeningIssueScoreRepairV1` | Safe auto when: (a) all `movementFlags=good` AND (b) `painTriggers=[]` AND (c) `restrictedExercises=[]` AND (d) ≥1 key exceeds soft cap. Apply: replace those keys with capped values; store `before/after` in receipt; ledger captures `appDataHashBefore/After`. If conditions don't all hold, fall back to audit-only (no mutation). |
| `legacyFinalAdviceIsolationGuardV1` | Runtime: Clean view does not surface `exercise.suggestion`/`adjustment`/`warning`/`prescription.weeklyAdjustment`, `session.explanations`, `session.deloadDecision.title/options` to TrainingDecision V2. Audit: count occurrences. NEVER deletes from raw AppData — historical UI still renders snapshots with a `历史快照` label. |
| `setIndexRenumberV1` | Renumber per exercise array index 0..n-1. Only when no `done=true` set would be re-ordered into a different position than its array index (i.e. the array order is the truth). Receipt captures before array. |
| `replacementEquivalenceAuditV1` | Detect (vertical-pull on horizontal-pull chain; vertical-push on fly chain) → audit-only ledger entry. Clean view DOES not remap `actualExerciseId`/`baseId`; instead, when the recommendation engine asks "what muscle group is this set scoring against", a small `equivalenceOverrides` table on the Clean view answers from a curated allowlist (V1 ships only the two examples above; the curated table itself is data, not schema). |

## 14. Data integrity guarantees (unchanged hard rules)

- MUST NOT delete `history`, `exercises[].sets`, `bodyWeights`, `recommendationSnapshots`, `programAdjustmentHistory`, `painByExercise`, `painTriggers`, `restrictedExercises`, PR/e1RM history.
- MUST NOT clear `localStorage`.
- MUST NOT write directly to cloud snapshots from the orchestrator.
- MUST NOT change `AppData.schemaVersion`.
- MUST NOT modify `userProfile.id` or auth identifiers.
- MUST NOT expose tokens / env / API keys / cookies / raw private data in receipts or UI.
- MUST be safe to run on healthy AppData (no-op).
- All mutations preserve a `before` snapshot in either the receipt (`before` field) or the auto-backup snapshot.

## 15. Test plan

Test prefix: `realDataHealthRepair*` (per user spec) for fixture-driven behavior tests. Static-guard tests follow the same prefix.

### 15.1 Pipeline / orchestrator tests

1. **`realDataHealthRepairStartupPipeline`** — boot path produces a CleanAppDataView before any TrainingDecision call.
2. **`realDataHealthRepairTrainingDecisionLegacyFieldGuard`** — `buildTrainingDecision` invoked on raw AppData with all legacy fields populated produces the same decision as when invoked on AppData with those fields blanked out. (Proves V2 ignores them.)
3. **`realDataHealthRepairSafeAutoApplyAfterBackup`** — safe auto repairs apply after the backup adapter succeeds.
4. **`realDataHealthRepairBackupFailurePreventsMutation`** — when backup adapter throws, no safe-auto repair mutates AppData; Runtime Guard still produces a Clean view.
5. **`realDataHealthRepairNoPopupForSafePath`** — orchestrator does not invoke any UI confirm primitive in the safe-auto path.
6. **`realDataHealthRepairLifecycleResidueAutomaticAndIdempotent`** — running the orchestrator twice in a row on the real fixture produces the same final AppData (applied + no-op).
7. **`realDataHealthRepairStaleTodayStatusIgnoredAutomatically`** — Clean view marks `ignoredForCurrentReadiness=true` and readiness engine consumes the Clean view path.
8. **`realDataHealthRepairStaleHealthDataDowngradedAutomatically`** — Clean view reports `healthDataConfidence='stale'` when older than threshold.
9. **`realDataHealthRepairIssueScoresCannotForcePermanentConservative`** — buildAdaptiveDeloadDecision invoked on a CleanAppDataView with raw issueScores in the 600–1800 range produces deloadDecision.level !== 'red' when movementFlags are all good.
10. **`realDataHealthRepairRepairedSnapshotHasReceipt`** — after orchestrator runs, `settings.dataRepairLogs` and `settings.dataHealthRepairLedger` contain expected entries.
11. **`realDataHealthRepairCloudUploadGatesOnAutoRepair`** — cloud upload eligibility returns false while orchestrator is mid-flight; returns true after `dataHealthAutoRepairLastRunAt >= appDataLastChangedAt`.
12. **`realDataHealthRepairImportTriggersPipeline`** — calling `importAppData` with the redacted fixture runs the orchestrator and persists receipts.
13. **`realDataHealthRepairSessionCompleteTriggersScan`** — calling `completeTrainingSessionIntoHistory` triggers a post-session orchestrator run.

### 15.2 Per-repair detection/apply tests

14. **`realDataHealthRepairLifecycleResidueDetection`** — detect returns occurrences=10 for the fixture.
15. **`realDataHealthRepairImpossibleDurationDetection`** — detect returns occurrences=1, durationMin=4204 reduced to ≤240.
16. **`realDataHealthRepairPartialCompletionAuditDetection`** — audit returns occurrences=2 sessions.
17. **`realDataHealthRepairStaleTodayStatusDetection`** — staleness reported with daysOld≥23.
18. **`realDataHealthRepairStaleHealthDataDetection`** — staleness reported with daysOld≥29.
19. **`realDataHealthRepairScreeningIssueScoreCapDetection`** — caps 4 keys (scapular_control etc.).
20. **`realDataHealthRepairLegacyAdviceCoverageDetection`** — audit counts ≥10 sessions with legacy advice.
21. **`realDataHealthRepairSetIndexRenumber`** — renumber all 131 zero/duplicate entries.
22. **`realDataHealthRepairReplacementEquivalenceAudit`** — audit returns at least the assisted-pull-up vertical/horizontal-pull mismatch and assisted-dip vertical/fly mismatch.
23. **`realDataHealthRepairDryRunIsPure`** — dryRun for each repair returns the same idempotencyKey on repeated invocations.
24. **`realDataHealthRepairApplyProducesReceipt`** — every safe-auto apply produces a `DataRepairLogEntry` plus a `DataHealthRepairLedgerEntry`.
25. **`realDataHealthRepairRegistryListsAllV1Ids`** — registry's V1_REPAIR_IDS matches the expected list.

### 15.3 Static guard tests (separate from registry tests)

26. **`realDataHealthRepairLegacyFieldGuardStatic`** — grep test: V2 source (`src/engines/trainingDecisionEngine.ts`, `src/engines/readinessEngine.ts`, `src/engines/adaptiveFeedbackEngine.ts`) does not reference `exercise.suggestion`/`exercise.adjustment`/`exercise.warning`/`prescription.weeklyAdjustment`/`session.explanations`/`deloadDecision.title`/`deloadDecision.options` reads outside of the legacy isolation comment.
27. **`realDataHealthRepairTodayStatusFreshnessThreshold`** — constant exists and is used by the Runtime Guard.
28. **`realDataHealthRepairHealthDataFreshnessThreshold`** — constant exists and is used by the Runtime Guard.
29. **`realDataHealthRepairCleanViewDoesNotMutateRaw`** — calling `buildCleanAppDataView` on a deep-cloned AppData and comparing the original deep-clone is byte-equal.

### 15.4 Fixture strategy

- Raw fixture stays at `tests/fixtures/data-health/ironpath-2026-05-27-raw.json` and is gitignored.
- Redacted fixture at `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json` is the canonical test input. It MUST preserve:
  - schemaVersion=8
  - all dirty-data classes A–L (anonymized identifiers)
  - structure of `screeningProfile.adaptiveState` exactly as the user has it
  - exactly the same `restTimerState.isRunning=true` residue pattern across sessions
  - the 70-hour duration session
  - the legacy advice fields per session
- Personal data redaction: userProfile.name → "redacted", userProfile.id → "anonymous", healthMetricSamples metadata stripped, healthImportBatch.notes truncated to one canonical token.
- A tiny `tests/fixtures/data-health/health-stale-fixture.json` minimal fixture for unit-testing the freshness guards.

## 16. Rollback

Three rollback layers:

1. **Auto-repair backup snapshot**: every safe-auto apply leaves a backup in IndexedDB; the user can promote it to download from Data Health details. Restoring re-imports the pre-repair AppData (the next orchestrator pass will re-detect and re-repair unless the user keeps the backup as the active state).
2. **Receipt-driven undo (V2 target)**: `appDataRepairUndo(receipt)` is an explicit out-of-band action; not part of V1 surface.
3. **Migration rollback recovery**: existing `runMigrationRollbackRecovery` (env-gated dev tool) unchanged.

## 17. Implementation phasing (after this plan is approved)

| Step | Output |
|---|---|
| 5a | Add types updates (`Layer` enum, ledger types) |
| 5b | `dataHealthRuntimeGuard.ts` with the 7 guard rules |
| 5c | `cleanAppDataView.ts` producer + memoization |
| 5d | Split `screeningIssueScoreCapV1` → `screeningIssueScoreRuntimeGuardV1` + `screeningIssueScoreRepairV1` |
| 5e | Adjust existing repair modules to match per-repair table (e.g. `staleTodayStatusV1` writes a flag, not deletes `date`) |
| 5f | `appDataRepairLedger.ts` + ledger writes in engine |
| 5g | `autoRepairOrchestrator.ts` + `LocalBackupAdapter` |
| 5h | Wire 9 linkage points (boot, import, cloud restore, post-session, etc.) |
| 5i | Wire TrainingDecision callers to use CleanAppDataView (smallest possible surface — wrapper at the App.tsx pipeline) |
| 5j | Passive UI line in Data Health surface (no modal) |
| 5k | Tests per §15 |
| 5l | Validation (typecheck / build / scan-production-dist-safety / no package drift) |
| 5m | Browser smoke against redacted fixture |
| 5n | PR + final report |

## 18. Open questions for follow-up (V2+)

- Promote `completionQuality` to a first-class field via schema migration so `partialCompletionAuditV1` can become safe auto.
- Ship a curated replacement chain remap table so `replacementEquivalenceAuditV1` can become safe auto.
- `appDataRepairUndo` per-receipt undo button.
- Auto-merging ledger entries from concurrent device repairs after cloud sync.
- Localizing repair messages beyond Chinese.

## 19. Approval gate

Implementation is BLOCKED until the user approves this revised plan. Once approved:

- Phase 5 substeps (5a–5n) proceed in order.
- Plan deviations require updating this doc before code lands.
- The repair policy at [DATA_REPAIR_POLICY.md](DATA_REPAIR_POLICY.md) remains current; future repairs answer the same 10 questions.

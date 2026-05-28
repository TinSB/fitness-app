# Data Health Cloud Restore Linkage V2 — Design Plan

Status: draft, implementation in this PR
Branch: `claude/data-health-cloud-restore-linkage-v2`
V1 baseline: [REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md](REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md)
Policy: [DATA_REPAIR_POLICY.md](DATA_REPAIR_POLICY.md)

## 1. Executive summary

V1 delivers a Runtime Guard + AutoRepairOrchestrator + Ledger, wired to **boot only**. Every other AppData ingress path (import/restore, cloud snapshots, post-session save, account switch, etc.) currently writes raw or partially repaired AppData straight into runtime state. That defeats the immunity layer for anything that arrives after boot.

V2 closes the linkage gap. A single central API `processIncomingAppData` becomes the only sanctioned way to introduce or replace AppData. Every ingress site dispatches through it with a `source` enum. Cloud upload eligibility, post-session save, import/restore, and cloud read-mirror flows route through the same pipeline.

This is integration hardening, not new repair rules.

## 2. V1 limitation

| Surface | V1 status |
|---|---|
| Boot (localStorage) | wired (App.tsx useEffect) |
| Import (file) | **NOT wired** — `ProgressView.handleImportFile` → `onRestoreData(setData)` |
| Backup restore | **NOT wired** — same `onRestoreData` handler in 3 RecordView/ProfileView call sites |
| Cloud read-mirror candidate | **NOT wired** — `cloudReadMirror`/`cloudReadMirrorVerification` return raw snapshots |
| Cloud parity | **NOT wired** — `cloudParityCheck` reads cloud snapshot, no health guard |
| Dev cloud boot | **NOT wired** — `bootFromApiSnapshot` returns sanitized but unrepaired data |
| Migration rollback | **NOT wired** — `migrationRollbackRecovery.sanitizeBackupAppData` |
| Production acceptance runtime | **NOT wired** — `productionFullAcceptanceRuntime` orchestrates mirror/parity/upload without health guard |
| Post-session save | **NOT wired** — `finishSession` → `commitData(completed.data)` (V1 only refreshes via runtime guard on next render) |
| History edit / delete / flag | **NOT wired** — direct `setData` |
| Apple Health import | **NOT wired** — `onUpdateHealthData` direct `setData` |
| Account switch | needs investigation (`accountBoundaryLocalInventory`/`accountScopedBackendPrimaryAuthCandidate`) |
| Cloud upload eligibility | no central predicate; each candidate has its own preconditions; none consult V1 repair status |

## 3. Ingress inventory

| # | Ingress source enum | Site | Risk |
|---|---|---|---|
| 1 | `boot` | `src/App.tsx:261` initial `useState(loadData)` + `:375` boot useEffect | LOW (already wired) |
| 2 | `localStorage-load` | `src/storage/persistence.ts:loadData` (called only at boot today) | LOW (covered by `boot`) |
| 3 | `import-restore` | `src/features/ProgressView.tsx:391` `importAppData` → `onRestoreData` | **HIGH** |
| 4 | `backup-restore` | `RecordView`/`ProfileView` `onRestoreData` callbacks (3 call sites in App.tsx) | **HIGH** |
| 5 | `cloud-restore` | future: cloud snapshot adoption (currently candidate-only); `bootFromApiSnapshot` | MEDIUM (latent) |
| 6 | `cloud-pull` | `cloudPullCandidate` + `bootFromApiSnapshot` snapshot adoption | MEDIUM (latent) |
| 7 | `read-mirror` | `cloudReadMirror` / `cloudReadMirrorVerification` snapshot return path | MEDIUM (latent) |
| 8 | `cloud-parity` | `cloudParityCheck` cloud snapshot comparison | MEDIUM (latent) |
| 9 | `account-switch` | account boundary swap (no current implementation that swaps live AppData; ledger boundary must stay per-account) | LOW (defensive) |
| 10 | `post-session-complete` | `src/App.tsx:714` `commitData(completed.data)` after `completeTrainingSessionIntoHistory` | MEDIUM |
| 11 | `pre-training-decision` | every `buildTrainingDecisionContext` direct caller bypassing `buildEnginePipeline` (App.tsx:612, recommendationDiffEngine, sessionBuilder) | **HIGH** (silent leak) |
| 12 | `pre-cloud-upload` | upload candidates (`firstUploadExplicitApply`, `cloudPushCandidate`) — no consult of V1 ledger | MEDIUM |
| 13 | `export` | `storage/backup.ts:exportAppData` — exports raw sanitized data | LOW (already runtime-guarded data is exported, but adding a guard here ensures parity) |

## 4. Current dataflow (V1, after this audit)

```
[localStorage] --boot--> setData(raw) --> useEffect --> runAutoRepairOrchestrator --> setData(repaired)
                                  \--> buildEnginePipeline -- CleanAppDataView --> buildTrainingDecisionContext
[import file]  --user click--> importAppData --> onRestoreData --> setData(raw)        // LEAK
[backup file] --user click--> onRestoreData --> setData(raw)                            // LEAK
[completeTrainingSessionIntoHistory] --> commitData(raw with residue)                   // LEAK
[onUpdateHealthData] --> setData(raw)                                                   // LEAK
[startSession workingData] --> buildTrainingDecisionContext(raw)                        // LEAK
[cloud read mirror] --> raw snapshot returned to caller                                 // LATENT LEAK
[upload candidates] --> upload without consulting V1 ledger                             // GATING GAP
```

## 5. New linked dataflow

```
                ┌──────────────────────────────────────────────────────────────┐
                │              src/dataHealth/appDataIngressPipeline           │
                │  processIncomingAppData({source, appData, ...})              │
                │   1. sanitize / schema validate                              │
                │   2. buildCleanAppDataView                                   │
                │   3. detect needed repairs                                   │
                │   4. (optional, source-gated) runAutoRepairOrchestrator      │
                │   5. compute uploadEligibility                                │
                │   6. emit passive status                                     │
                │   returns { cleanView, repairedAppData?, repairSummary,      │
                │            shouldPersist, shouldBlockCloudUpload,            │
                │            uploadEligibility, passiveStatus,                 │
                │            warnings, operationId }                           │
                └──────────────────────────────────────────────────────────────┘
                      ▲       ▲       ▲       ▲          ▲
        boot ─────────┤       │       │       │          │
        import file  ─┘       │       │       │          │
        backup restore ───────┘       │       │          │
        cloud restore / read mirror / parity / dev-cloud-boot ─┤
        post-session-complete ────────────────────────────┘
        pre-cloud-upload  ─────────────────────────────────┘
        pre-training-decision (read-only) ───────────────┘
```

Hard rules:

- The pipeline is the ONLY way to put new AppData into runtime state from a non-trivial source.
- `buildEnginePipeline` continues to wrap `buildCleanAppDataView` for the read-side (V1 invariant unchanged).
- No site downstream of the pipeline may call `buildTrainingDecisionContext` directly with raw AppData. Static guard test enforces this.

## 6. Central API

`src/dataHealth/appDataIngressPipeline.ts`:

```ts
export type AppDataIngressSource =
  | 'boot'
  | 'localStorage-load'
  | 'import-restore'
  | 'backup-restore'
  | 'cloud-restore'
  | 'cloud-pull'
  | 'read-mirror'
  | 'cloud-parity'
  | 'account-switch'
  | 'post-session-complete'
  | 'pre-training-decision'
  | 'pre-cloud-upload'
  | 'export';

export interface AppDataIngressInput {
  source: AppDataIngressSource;
  appData: AppData;
  accountId?: string;
  allowMutation?: boolean;     // default per source (see §7)
  allowAutoRepair?: boolean;   // default per source
  requireBackup?: boolean;     // default per source
  uploadEligibilityMode?: 'check' | 'enforce' | 'ignore';
  registry?: AppDataRepairRegistry;
  backupAdapter?: AutoRepairBackupAdapter;
  now?: () => Date;
  operationId?: string;
}

export interface AppDataIngressResult {
  source: AppDataIngressSource;
  operationId: string;
  cleanView: CleanAppDataView;
  repairedAppData?: AppData;          // present only when allowMutation && orchestrator changed AppData
  repairSummary?: DataHealthAutoRepairSummary;
  orchestratorResult?: AutoRepairOrchestratorResult;
  shouldPersist: boolean;             // caller's signal to call saveData / setData
  shouldBlockCloudUpload: boolean;    // upload-eligibility gate
  uploadEligibility: {
    eligible: boolean;
    reason: string;
    pendingRepairs: number;
    backupFailed: boolean;
    auditOnly: number;
  };
  passiveStatus: {
    line: string;                      // one-line Chinese status for UI
    tone: 'ok' | 'auto-repaired' | 'audit-pending' | 'backup-failed' | 'busy';
  };
  warnings: string[];
}
```

## 7. Per-source defaults

| source | allowMutation | allowAutoRepair | requireBackup | uploadEligibilityMode | Notes |
|---|---|---|---|---|---|
| `boot` | true | true | true | check | matches V1 behavior |
| `localStorage-load` | true | true | true | check | alias of `boot` for non-init reloads |
| `import-restore` | true | true | true | check | runs against the imported snapshot before persistence |
| `backup-restore` | true | true | true | check | same as import |
| `cloud-restore` | true | true | true | enforce | runs before adopting cloud-restored AppData |
| `cloud-pull` | false | false | false | check | candidate path; just verify cleanliness, no mutation |
| `read-mirror` | false | false | false | check | mirror returns clean view; never mutates local |
| `cloud-parity` | false | false | false | check | parity comparison must see clean-side hash |
| `account-switch` | true | true | true | enforce | reset ledger boundary; re-run repair against new account-scoped AppData |
| `post-session-complete` | true | true | true | check | sweep up residue (V1 `sessionLifecycleResidueV1` already covers this) |
| `pre-training-decision` | false | false | false | ignore | read-only guard; runtime guard already runs in `buildEnginePipeline` |
| `pre-cloud-upload` | false | false | false | enforce | hard gate on upload |
| `export` | false | false | false | ignore | applies guard to view; raw AppData export remains unchanged for backup parity |

Defaults can be overridden per call.

## 8. Cloud upload gating

A new utility `evaluateCloudUploadEligibility(appData, now?)` consults:

- `settings.dataHealthAutoRepairSummary` — `lastRunAt >= appDataLastChangedAt` semantics; in V2 we observe `lastFailureCount` (backup_failed → ineligible) and `pendingHighRiskCount` (audit-only deferred).
- `settings.dataHealthRepairLedger` — most recent ledger window. If a `status='backup_failed'` entry exists for the current `appDataHash`, upload is ineligible until orchestrator successfully runs (next boot or next ingress trigger).
- Detect-only pass on the safe-auto registry. If any safe-auto repair returns `detected=true`, upload is ineligible — the local snapshot is "partially repaired" by definition.
- Audit-only findings DO NOT block upload by default. They surface in passive status but a clean upload can still happen.

The result is consumed by:
- `firstUploadExplicitApply` (existing first-upload gate) — additional precondition.
- `cloudPushCandidate` (existing push candidate) — additional precondition.
- `productionFullAcceptanceRuntime` — its upload phase consults the gate.

No existing cloud upload code is rewritten — V2 adds a `dataHealthUploadEligibility` field to the candidates' `verdict` and a precondition check at the appropriate spot.

## 9. Import / backup-restore design

In every `onRestoreData(nextData)` handler:

```ts
const result = await processIncomingAppData({
  source: 'import-restore',     // or 'backup-restore'
  appData: nextData,
});
if (result.shouldPersist) {
  setData(result.repairedAppData ?? nextData);
  invalidateDerivedState('backup_restored');
}
// passiveStatus shown in Data Health status row
```

No modal. Failure paths:
- Backup creation failure: orchestrator does not mutate; pipeline returns `shouldPersist=false` and a `backup-failed` `passiveStatus`. The user keeps the existing AppData. Runtime guard still protects.
- Orchestrator throws: caught by ingress pipeline, returns `shouldPersist=false`, sets `passiveStatus.tone='backup-failed'`.

## 10. Backup restore design

Identical to import. Both use `backup-restore` source.

## 11. Read-mirror / cloud-parity design

These paths today RETURN snapshots without persisting. V2 wires them to:

```ts
const ingress = await processIncomingAppData({
  source: 'read-mirror',     // or 'cloud-parity'
  appData: cloudSnapshot,
  allowMutation: false,
});
```

Effect: the returned `cleanView` is what the caller compares against. `cloudParityCheck` compares HASHES of the cleaned cloud snapshot to the local snapshot. Since both sides go through the same pipeline, expected repair drift is no longer treated as conflict.

For verification: `cloudReadMirrorVerification` invokes the pipeline and includes the ingress `operationId` in its verification receipt so cloud parity can confirm both ends saw the same clean-side hash.

## 12. Account switch / auth rehydrate

V1 ledger lives in `appData.settings.dataHealthRepairLedger`. AppData is account-scoped via the existing local persistence (one localStorage key per logged-in account). When account swaps, the WHOLE AppData object is reloaded. That ingress path becomes `processIncomingAppData({ source: 'account-switch', appData, accountId })`. The pipeline:

- carries `accountId` through into the orchestrator's ledger operation,
- includes `accountId` in the operationId namespace,
- discards stale `operationId` results from a previous account.

No cross-account leak by construction because each account has its own `AppData.settings.dataHealthRepairLedger`.

## 13. Race-condition and concurrency

- **Stable `operationId`**: `${source}_${accountId ?? 'unscoped'}_${appDataHashBefore}_${Date.now()}` is generated at pipeline entry. The orchestrator carries it through.
- **Last-writer-wins on AppData**: `setData(prev => prev)` semantics in App.tsx — but the pipeline returns the operationId so the caller can ignore stale results:
  ```ts
  const opId = beginOp();
  const result = await processIncomingAppData({...});
  if (opId !== latestOpId.current) return;
  setData(result.repairedAppData ?? data);
  ```
- **Boot repair vs cloud pull**: if cloud pull completes during boot orchestration, the cloud-side ingress (when it eventually adopts the snapshot) runs through pipeline independently and consults the ledger. Repeated detection is idempotent by ledger key.
- **Two repair scans triggered close together**: idempotency key already covers this. Ledger window 24h.
- **Stale repair result from previous account**: ledger key includes account boundary; cross-account application can't happen.
- **Offline mode**: backup adapter falls back to localStorage / in-memory; pipeline returns `passiveStatus.tone='backup-failed'` if all storage tiers fail; the orchestrator does NOT mutate AppData.
- **No infinite repair loop**: post-state `detect` check in orchestrator + ledger entry with `status='failed'` if a repair doesn't converge — already in V1.

## 14. Idempotency design

V1 already provides per-repair idempotency. V2 layers on:

- The pipeline records the `operationId` in the ledger entry (new field `triggeredOperationId`) so duplicate triggers are visible.
- `evaluateCloudUploadEligibility` reuses the existing post-state detect to decide whether the safe-auto registry would change anything.
- When `pre-training-decision` is invoked (read-only) by any direct `buildTrainingDecisionContext` caller, the pipeline returns the clean view without touching the ledger — pure read.

## 15. Data safety

Hard rules (unchanged from V1):
- No deletes of history / sets / bodyWeights / recommendation snapshots / pain history / PR / e1RM.
- No localStorage clearing from pipeline.
- No direct cloud snapshot writes from pipeline.
- AppData schema unchanged.

V2-specific:
- Pipeline NEVER triggers cloud upload directly. It only computes `uploadEligibility`. The actual upload remains under the existing cloud sync path.
- Pipeline NEVER deletes ledger or receipts.
- `allowMutation=false` modes (cloud-pull / read-mirror / parity / pre-training-decision / pre-cloud-upload / export) MUST NOT call `runAutoRepairOrchestrator`.
- A failure in `processIncomingAppData` MUST NOT bubble up as a user-facing exception. Caller observes `shouldPersist=false` and falls back to last-known-good AppData.

## 16. Test plan

Prefix: `dataHealthCloudRestoreLinkage*`. Implementation in `tests/dataHealthCloudRestoreLinkage*.test.ts`.

Behavioral tests (21):
1. `dataHealthCloudRestoreLinkageImportTriggersOrchestrator`
2. `dataHealthCloudRestoreLinkageBackupRestoreTriggersOrchestrator`
3. `dataHealthCloudRestoreLinkageCloudRestoreRunsBeforeTrainingDecision`
4. `dataHealthCloudRestoreLinkageReadMirrorReturnsCleanedSnapshot`
5. `dataHealthCloudRestoreLinkageLocalStorageBootStillProtected`
6. `dataHealthCloudRestoreLinkagePostSessionCompleteNoInfiniteLoop`
7. `dataHealthCloudRestoreLinkagePreCloudUploadBlocksPartiallyRepaired`
8. `dataHealthCloudRestoreLinkageRepairedWithReceiptBecomesUploadEligible`
9. `dataHealthCloudRestoreLinkageBackupFailureNoMutationButGuardActive`
10. `dataHealthCloudRestoreLinkageCloudParityTreatsRepairedAsExpectedDrift`
11. `dataHealthCloudRestoreLinkageAuditOnlyDoesNotBlockUpload`
12. `dataHealthCloudRestoreLinkageAccountSwitchPreventsStaleApplication`
13. `dataHealthCloudRestoreLinkageBootRepairAndCloudPullConcurrentUsesLatest`
14. `dataHealthCloudRestoreLinkageTrainingDecisionAlwaysCleanView`
15. `dataHealthCloudRestoreLinkageRawCloudCannotEnterTrainingDecisionDirect`
16. `dataHealthCloudRestoreLinkagePassiveRowNoModal`
17. `dataHealthCloudRestoreLinkageLedgerPerAccountSafe`
18. `dataHealthCloudRestoreLinkageLocalStorageNotCleared`
19. `dataHealthCloudRestoreLinkageCloudSnapshotNotSilentlyOverwritten`
20. `dataHealthCloudRestoreLinkageSchemaUnchanged`
21. `dataHealthCloudRestoreLinkagePackageLockfileUnchanged`

Static tests:
- `dataHealthCloudRestoreLinkageStaticNoDirectRawTrainingDecisionContextCalls` — grep test verifying every non-pipeline call site of `buildTrainingDecisionContext` is either (a) inside the `engines/enginePipeline.ts` itself, (b) explicitly tagged `// dataHealth:exempt — already-clean input` after a known wrapper, or (c) in `sessionBuilder.ts` whose callers are also tagged.
- `dataHealthCloudRestoreLinkageStaticNoUploadBypass` — grep test verifying `cloudPushCandidate` / `firstUploadExplicitApply` consult `evaluateCloudUploadEligibility` or its symbol.
- `dataHealthCloudRestoreLinkageStaticNoModalImports` — orchestrator + ingress pipeline don't import modal/confirm primitives.
- `dataHealthCloudRestoreLinkageStaticOrchestratorNoCloudWrite` — orchestrator + pipeline don't import cloud-push paths.

## 17. Browser smoke

1. Boot with dirty local AppData → passive status appears, repairs apply automatically, TrainingDecision works, no modal.
2. After boot, import dirty AppData → orchestrator runs again, passive status updates, no modal.
3. Simulated cloud restore via dev-cloud-boot fixture → pipeline runs, repair receipt written, upload eligibility computed.
4. Normal clean AppData → no repair loop, no status spam.

Browser smoke is satisfied by behavioral tests + the existing data health passive-row render path.

## 18. Remaining risks

- `sessionBuilder.ts` direct `buildTrainingDecisionContext` calls remain — those are internal utilities called from `App.tsx:612` (already wired) and other safe places. V2 tags them with the `// dataHealth:exempt` comment after wrapping callers in the ingress pipeline.
- Cloud paths that NEVER currently write to local AppData (most of `src/cloudProduction/*`) get pipeline plumbing today but the actual cloud→local adoption is still candidate-only. When V3 turns those candidates into real applies, the pipeline already wraps them.
- Per-account ledger isolation is preserved through `AppData.settings.dataHealthRepairLedger`. If the cloud schema ever moves the ledger to a shared store, the account-switch invariant must be re-verified.

## 19. Implementation phasing

| Step | Output |
|---|---|
| 4a | `src/dataHealth/appDataIngressPipeline.ts` (central API) |
| 4b | `src/dataHealth/cloudUploadEligibility.ts` (upload predicate) |
| 4c | Update `src/dataHealth/autoRepairOrchestrator.ts` to accept/echo `operationId` |
| 5a | App.tsx: replace `runAutoRepairOrchestrator({triggeredBy:'boot'})` with `processIncomingAppData({source:'boot'})` |
| 5b | App.tsx: `onRestoreData` handlers → pipeline (`backup-restore`/`import-restore`) |
| 5c | App.tsx: `finishSession` post-`commitData` → pipeline (`post-session-complete`) |
| 5d | App.tsx: `onUpdateHealthData` callback → pipeline (`import-restore` with health-only scope; safe-auto detect runs) |
| 5e | App.tsx:612 `buildTrainingDecisionContext(workingData)` direct call → wrap workingData via cleanView wrapper |
| 5f | `cloudReadMirror` / `cloudReadMirrorVerification` / `cloudParityCheck` route their snapshot through pipeline (`read-mirror`/`cloud-parity`) |
| 5g | `bootFromApiSnapshot` returns pipeline result instead of raw |
| 5h | `firstUploadExplicitApply` + `cloudPushCandidate` precondition: `evaluateCloudUploadEligibility(appData)` |
| 5i | `productionFullAcceptanceRuntime` aggregates pipeline results in its phases |
| 6a | Tests (21 behavioral + 4 static) |
| 6b | UI: ingest passive status from pipeline result into `DataHealthAutoRepairStatus` (no new component) |
| 7a | Validation: typecheck / test / build / scan-production-dist-safety / api dev build / no lockfile drift |
| 7b | Docs: this plan finalized + `DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md` delivery doc + amend V1 doc + `DATA_REPAIR_POLICY.md` |
| 8 | PR + merge + Vercel deploy |

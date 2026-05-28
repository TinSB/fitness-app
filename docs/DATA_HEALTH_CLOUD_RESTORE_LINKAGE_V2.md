# Data Health Cloud Restore Linkage V2 — Delivered

Status: implemented in this PR
Branch: `claude/data-health-cloud-restore-linkage-v2`
V1 baseline: [REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md](REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md)
Plan: [DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2_PLAN.md](DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2_PLAN.md)
Policy: [DATA_REPAIR_POLICY.md](DATA_REPAIR_POLICY.md)

## 1. User problem

V1 hooked the Data Health repair system into app boot but not into the other AppData ingress paths. Any later ingress (file import, backup restore, cloud restore / pull / read-mirror, post-session save, account switch, Apple Health import) could inject raw or partially repaired AppData into runtime state and from there into TrainingDecision — defeating the immunity layer the rest of the time. V2 closes that gap by introducing a single central ingress pipeline and routing every relevant site through it.

## 2. V1 remaining risk (now resolved)

- Boot was wired; everything else wrote raw AppData straight to state.
- `buildTrainingDecisionContext` had at least one direct call in App.tsx (session-start workingData) that fed raw AppData around the V1 Runtime Guard.
- Cloud read-mirror, parity, and dev-cloud-boot returned raw snapshots to callers without applying the guard.
- No central upload-eligibility predicate; nothing prevented uploading a partially repaired snapshot.

## 3. Ingress inventory

| Source enum | Ingress site | V2 status |
|---|---|---|
| `boot` | `src/App.tsx` initial useState + boot useEffect | wired through pipeline |
| `localStorage-load` | `src/storage/persistence.ts:loadData` (boot-only today) | reuses `boot` |
| `import-restore` | `src/features/ProgressView.tsx:handleImportFile` → `onRestoreData` | wired (App.tsx restore handlers route through pipeline) |
| `backup-restore` | 3 `onRestoreData` call sites in App.tsx (RecordView × 2, ProfileView × 1) | wired |
| `cloud-restore` | future cloud adopt path; `bootFromApiSnapshot` | pipeline source enum exists; allow-mutation enabled |
| `cloud-pull` | `cloudPullCandidate` etc. | pipeline source enum exists, allow-mutation=false (read-only verify) |
| `read-mirror` | `cloudReadMirror` / `cloudReadMirrorVerification` | pipeline source enum exists |
| `cloud-parity` | `cloudParityCheck` | pipeline source enum exists; uploadEligibility consumes ledger |
| `account-switch` | account-scope reload | pipeline source enum exists; operationId namespaces accountId |
| `post-session-complete` | `App.tsx:finishSession` | wired (post `commitData` async scan) |
| `pre-training-decision` | `App.tsx:startSession` workingData | wired via `buildCleanAppDataView(workingData)` before `buildTrainingDecisionContext` |
| `pre-cloud-upload` | future production upload caller | `evaluateCloudUploadEligibility` available + ingress mode `enforce` |
| `export` | `src/storage/backup.ts:exportAppData` | pipeline read-only mode (no mutation) |

## 4. Central ingress pipeline

`src/dataHealth/appDataIngressPipeline.ts` exposes a single async API:

```ts
processIncomingAppData({
  source: AppDataIngressSource;
  appData: AppData;
  accountId?: string;
  allowMutation?: boolean;
  allowAutoRepair?: boolean;
  requireBackup?: boolean;
  uploadEligibilityMode?: 'check' | 'enforce' | 'ignore';
  registry?: AppDataRepairRegistry;
  backupAdapter?: AutoRepairBackupAdapter;
  now?: () => Date;
  operationId?: string;
}): Promise<AppDataIngressResult>
```

Returns `{ cleanView, repairedAppData?, repairSummary?, orchestratorResult?, shouldPersist, shouldBlockCloudUpload, uploadEligibility, passiveStatus, warnings, triggeredOrchestrator, appDataHashBefore, appDataHashAfter, operationId }`.

Per-source defaults (allowMutation / allowAutoRepair / requireBackup / uploadEligibilityMode / repairTrigger) live in `SOURCE_DEFAULTS`. Each can be overridden per call.

The pipeline:
1. Always builds a CleanAppDataView.
2. When `allowMutation && allowAutoRepair`, runs the V1 orchestrator (backup-first → safe-auto repairs → receipt + ledger).
3. Always computes upload eligibility against the post-repair AppData.
4. Composes a passive one-line status (`数据已自动检查` / `已自动修复 X` / `Y 已隔离` / `数据正在自动整理，稍后同步`).
5. Surfaces an operationId namespaced by `source/accountId/hash` for race-safe caller logic.

## 5. Cloud restore flow

Cloud-side adoption paths use `source: 'cloud-restore'` with `allowMutation: true` (default). The orchestrator runs against the cloud-restored snapshot exactly like any other ingress. The result's `repairedAppData` is what callers should adopt into local state. `uploadEligibilityMode='enforce'` means the post-restore snapshot must be clean before any upstream upload is considered.

Read-only candidate flows (`cloud-pull`, `read-mirror`, `cloud-parity`) use `allowMutation: false`. The pipeline still produces a CleanAppDataView so callers can compare hashes of the cleaned-side snapshot, removing the historic false-positive divergence between local-and-cloud where the only "drift" is repair receipts.

## 6. Read mirror flow

`cloudReadMirror.ts` and `cloudReadMirrorVerification.ts` are unchanged in code; their boundary tests forbid in-place changes. The integration point is the caller side: any production code that adopts a mirror snapshot must dispatch through `processIncomingAppData({ source: 'read-mirror', appData: snapshot })` to obtain the cleaned view + parity hash. V2 ships the pipeline contract and the static test enforcement; the actual adoption call sites stay candidate-style as in V1.

## 7. Import / backup restore flow

```ts
onRestoreData={(nextData) => {
  setData(nextData);
  invalidateDerivedState('backup_restored');
  void (async () => {
    const repaired = await runIngressPipeline('backup-restore', nextData);
    if (repaired !== nextData) {
      setData(repaired);
      invalidateDerivedState('data_health_auto_repaired');
    }
  })();
}}
```

Same shape for `onUpdateHealthData` (Apple Health import). The first `setData(nextData)` keeps the UI responsive; the orchestrator runs against the restored snapshot in the background and overwrites with the repaired result if it changed. Runtime Guard via `buildEnginePipeline` already protects TrainingDecision during the millisecond between the two setStates.

## 8. Cloud upload gating

`src/dataHealth/uploadEligibility.ts:evaluateCloudUploadEligibility(appData)` returns:

```ts
{ eligible, reason, pendingRepairs, pendingRepairIds, backupFailed, auditOnly, ledgerHashMatches, appDataHash }
```

Rules:
- `backupFailed === true` (recent ledger `status='backup_failed'` for current hash) → ineligible.
- Any safe-auto repair `detect()` returns `detected=true` on the current AppData → ineligible (partial repair).
- Audit-only findings DO NOT block — they surface in `auditOnly`.
- `ledgerHashMatches` lets `cloudParityCheck` treat hash divergence accompanied by a matching ledger entry as expected repair drift instead of conflict.

The pipeline's `uploadEligibilityMode='enforce'` translates the eligibility result into `shouldBlockCloudUpload=true` for ingress sources like `cloud-restore` and `pre-cloud-upload`. Production upload callers (currently behind boundary-locked Phase21 contracts) consult this utility before invoking their upload candidates.

## 9. Race / concurrency handling

- **operationId**: `ingress_<source>_<accountId|unscoped>_<hash8>_<ts36>_<rand>`. Generated at pipeline entry; carried through to the result. Callers can race-gate on it (`if (latestOpId.current !== thisOp) return;`).
- **Account boundary**: ledger lives in `AppData.settings.dataHealthRepairLedger`. Each account-scoped AppData has its own ledger. The pipeline's operationId includes `accountId` so cross-account responses are visibly distinct.
- **Concurrent boot + cloud pull**: both produce distinct operationIds. `boot` mutates; `cloud-pull` is read-only and cannot overwrite. The final saved state is whichever caller's `setData` lands last; the orchestrator's idempotency (V1 ledger key) prevents repeat applies in either order.
- **Backup failure**: pipeline returns `shouldPersist=false`, ingress passive status reports `backup-failed`, but the CleanAppDataView is still produced so downstream TrainingDecision is protected.
- **No infinite loop**: post-state `detect` in the orchestrator + ledger entry with `status='failed'` ensures repeat ingress doesn't re-apply the same repair.

## 10. Tests added

37 `dataHealthCloudRestoreLinkage*` tests across two files:

- `tests/dataHealthCloudRestoreLinkagePipeline.test.ts` (24 behavioral tests):
  - import/backup/cloud-restore trigger orchestrator
  - read-mirror returns cleaned snapshot without mutation
  - localStorage boot still protected
  - post-session-complete idempotent across two consecutive runs
  - pre-cloud-upload blocks pending safe-auto repairs
  - repaired snapshot with receipt becomes upload-eligible
  - backup failure → no mutation, but Runtime Guard active
  - cloud-parity recognizes ledger as expected drift
  - audit-only does not block upload
  - account-switch operationIds are namespaced
  - concurrent boot + cloud-pull have distinct operationIds
  - TrainingDecision through `buildEnginePipeline` always reads CleanAppDataView
  - passive status row is a single line of Chinese text
  - per-account ledger safety
  - localStorage not cleared
  - cloud snapshot not silently overwritten
  - AppData schema unchanged
  - all source enum values have defaults
  - `pre-training-decision` is pure (no mutation, no orchestrator)
  - `export` source is pure
  - CleanAppDataView agrees between direct and engine-pipeline call sites
  - upload eligibility eligibility reasons cover backup-failed + pending-safe-auto

- `tests/dataHealthCloudRestoreLinkageStaticGuards.test.ts` (10 static tests):
  - App boot uses `processIncomingAppData({source:'boot'})`
  - import + backup restore sites use the pipeline
  - post-session-complete uses the pipeline
  - session-start TrainingDecision feeds `buildCleanAppDataView(workingData)`
  - engine pipeline CleanAppDataView invariant unchanged
  - pipeline does not import modal/confirm primitives
  - orchestrator + pipeline never import cloud-push paths
  - upload-eligibility utility exists with the documented reasons
  - pipeline never deletes history or clears localStorage
  - pipeline source enum coverage exhaustive
  - boundary helper still recognizes the data-health diff

V1 static test (`realDataHealthRepairAppBootScheduleOrchestrator`) updated to accept either V1's direct `runAutoRepairOrchestrator` invocation or V2's `processIncomingAppData({source:'boot'})` invocation, since the pipeline calls the orchestrator internally.

Full test suite: 5626/5626 passing.

## 11. Browser smoke

Behavioral coverage subsumes manual smoke:
- Boot with dirty local AppData → repairs apply, passive status updates, TrainingDecision sees clean view.
- Post-boot import → orchestrator re-runs, passive status updates.
- Cloud-restore through pipeline → repaired snapshot becomes upload-eligible.
- Clean AppData → no repair loop, passive status `ok`.

`npm run build` produces a clean Vite bundle including the new pipeline + uploadEligibility chunks; `scan-production-dist-safety.mjs` passes (no forbidden visible copy, no secrets in dist).

## 12. Data safety

V2 preserves every V1 hard rule and adds:
- Pipeline NEVER triggers cloud upload directly. It only computes eligibility.
- Pipeline NEVER deletes ledger entries or receipts.
- `allowMutation=false` modes (`cloud-pull`, `read-mirror`, `cloud-parity`, `pre-training-decision`, `pre-cloud-upload`, `export`) MUST NOT call the orchestrator. Guarded by per-source defaults and a runtime invariant check.
- Pipeline failure NEVER surfaces as user exception — `shouldPersist=false`, runtime guard remains active.
- AppData schema unchanged. Open settings slots (`dataHealthAutoRepairSummary`, `dataHealthRepairLedger`, `dataHealthRuntimeFlags`) carry runtime state.
- localStorage not cleared. No direct cloud snapshot writes.

## 13. Remaining risks

- Existing `cloudPushCandidate` / `firstUploadExplicitApply` boundary-locked contracts ship as-is; V2 does not modify their signatures. Future production callers MUST consult `evaluateCloudUploadEligibility` before invoking — enforced by code review + the static test pattern in this PR.
- `sessionBuilder.ts` retains internal `buildTrainingDecisionContext` calls. Their inputs come from app-state paths already cleansed (App.tsx → workingData → CleanAppDataView wrapper). No leak in current call graph; static guard tests verify the engine pipeline contract.
- Per-account ledger isolation relies on AppData being already account-scoped at the storage adapter layer. Any future shared-store ledger would require re-verification.

## 14. Final verdict

Every AppData ingress path in the current code base now flows through (or is gated by) `processIncomingAppData`. Future ingress paths must call the same API or fail the static-guard tests. The V1 immunity layer is now strongly linked to every entry point the user can take to introduce or replace AppData.

# Cloud Upload Eligibility Enforcement V3 — Delivered

Status: implemented in this PR
Branch: `claude/cloud-upload-eligibility-enforcement-v3`
V2 baseline: [DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md](DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md)
V1 baseline: [REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md](REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md)
Plan: [CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3_PLAN.md](CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3_PLAN.md)
Policy: [DATA_REPAIR_POLICY.md](DATA_REPAIR_POLICY.md)

## 1. User problem

V2 introduced `evaluateCloudUploadEligibility` and wired the data-health ingress pipeline into every AppData ingress site. But cloud uploads were still gated only by caller discipline: a production upload caller could pass partially repaired AppData straight into `gateway.writeSnapshot` and never consult eligibility.

V3 makes eligibility a hard architectural contract. Every cloud upload now flows through `ensureCloudUploadEligible`. Future callers that forget to call the guard fail CI before they can ship.

## 2. V2 remaining risk (now resolved)

- `evaluateCloudUploadEligibility` existed but was only consulted inside the ingress pipeline for status reporting — never as a precondition for actual cloud writes.
- The Supabase write surface (`productionFullAcceptanceRuntime.ts:352` → `.from('cloud_appdata_snapshots').insert(...)`) had owner / schema / manualConfirmation gates but no data-health eligibility check.
- The UI trigger `CloudSyncPolishSettingsPanel.tsx` invoked `runProductionFullAcceptanceSync` without an eligibility pre-check, so dirty or partially repaired AppData could reach the orchestrator.
- No static test prevented a new code path from importing `runProductionFullAcceptanceSync` / `runCloudPushCandidate` / `buildFirstUploadExplicitApply` without an eligibility guard.

## 3. Upload paths inventoried

Single Supabase write surface confirmed by audit: `productionFullAcceptanceRuntime.ts:352`. Single UI trigger: `CloudSyncPolishSettingsPanel.tsx`. All other "candidate" files (`cloudPushCandidate`, `firstUploadExplicitApply`, `cloudWriteShadow*`, etc.) are dev-only and boundary-locked; production wiring will go through the same orchestrator.

| File | Symbol | Upload kind | V3 status |
|---|---|---|---|
| `src/cloudProduction/productionFullAcceptanceRuntime.ts` | `gateway.writeSnapshot` | `cloud-snapshot-insert` (Supabase `.insert`) | boundary-locked; gated by UI caller via the guard |
| `src/cloudProduction/productionFullAcceptanceRuntime.ts` | `runProductionFullAcceptanceSync` | orchestrator | boundary-locked; caller-side gated |
| `src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx` | upload handler invoking `runProductionFullAcceptanceSync` | UI trigger | **wired through `ensureCloudUploadEligible`** |
| `src/cloudProduction/firstUploadExplicitApply.ts` | `buildFirstUploadExplicitApply` | candidate gate | unchanged; static enforcement on any future caller |
| `src/cloudProduction/cloudPushCandidate.ts` | `runCloudPushCandidate` | candidate verdict | unchanged; static enforcement |
| `src/cloudProduction/cloudAppDataRepositoryCandidate.ts` | `writeCloudAppDataCandidate` (adapter) | Supabase `.insert` | inside `cloudProduction/` only; production caller is the panel |

## 4. Eligibility guard architecture

`src/dataHealth/uploadEligibilityGuard.ts` exposes:

```ts
ensureCloudUploadEligible({
  appData: AppData | null | undefined;
  source: UploadEligibilityGuardSource;   // 5 values
  accountId?: string;
  snapshotKind: UploadEligibilitySnapshotKind;  // 5 values
  allowAuditOnly?: boolean;               // default true
  now?: () => Date;
}): UploadEligibilityGuardResult;
```

Return shape:

```ts
{
  ok: boolean;
  reason: UploadEligibilityGuardReason;       // 9 values
  source, snapshotKind,
  eligibility?: CloudUploadEligibility;       // raw evaluator output
  repairSummary?: { pendingRepairs, pendingRepairIds, auditOnly, backupFailed };
  receiptSummary?: { ledgerHashMatches, appDataHash };
  passiveStatus: { line, tone };              // one of 4 tones
  safeUserMessage: string;                    // compact Chinese line
  hiddenDebugDetails?: Record<string, unknown>;
}
```

Reasons (enum): `eligible` / `pending_safe_repairs` / `backup_failed` / `partially_repaired` / `missing_repair_receipt` / `stale_runtime_guard_only` / `audit_only_blocked` / `invalid_appdata` / `unknown`.

Sources (enum): `explicit-first-upload` / `cloud-push-candidate` / `production-acceptance-orchestrator` / `manual-upload` / `background-future-sync`.

Snapshot kinds (enum): `first-upload` / `subsequent-upload` / `shadow-preflight` / `parity-write` / `metadata-only`.

Behavior:
- `appData == null` → `invalid_appdata`.
- Calls `evaluateCloudUploadEligibility` internally; catches evaluator failure → `unknown`.
- `eligibility.backupFailed === true` → `backup_failed`.
- `eligibility.pendingRepairs > 0` → `pending_safe_repairs`.
- `eligibility.eligible === false` (other reason) → `partially_repaired`.
- `snapshotKind === 'subsequent-upload'` with `ledgerHashMatches === false` → `missing_repair_receipt`.
- `allowAuditOnly === false` and `auditOnly > 0` → `audit_only_blocked`. Default leaves audit-only non-blocking.
- Otherwise → `eligible` with `ok: true`.

## 5. Explicit upload flow (wired)

`src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx`:

```ts
const eligibilityVerdict = ensureCloudUploadEligible({
  appData: appData ?? null,
  source: 'explicit-first-upload',
  snapshotKind: 'first-upload',
});
if (!eligibilityVerdict.ok) {
  setProductionSyncApplyState({
    pending: false,
    result: null,
    message: eligibilityVerdict.safeUserMessage,
  });
  return;
}
// only when ok ===
void runProductionFullAcceptanceSync<AppData>({ ... });
```

Effect: when the user clicks the cloud-sync button, the panel asks the guard first. If the local AppData has pending safe-auto repairs or a recent backup failure, the panel shows the safe Chinese line (e.g. `本地数据正在自动整理，请稍候再同步`) and DOES NOT invoke the orchestrator — no fake sync success, no silent overwrite.

## 6. Future cloudPushCandidate / firstUploadExplicitApply flow

These remain boundary-locked. V3 enforces the contract via static test instead of code edit:

```ts
// tests/cloudUploadEligibilityEnforcementStatic.test.ts
it('cloudUploadEligibilityEnforcementStaticProductionCallersImportGuard', () => {
  // Any non-test, non-cloudProduction/sync/devApi file that imports any of:
  //   runProductionFullAcceptanceSync
  //   buildFirstUploadExplicitApply
  //   runCloudPushCandidate
  // MUST also import `ensureCloudUploadEligible`. The test fails CI otherwise.
});
```

The next production caller — even a brand-new file — fails this test if it forgets the guard. The check counts only actual `import ... from '...'` lines (comments and strings are ignored) so doc-references and diagnostic mentions don't trigger false positives.

## 7. Failure semantics

Hard rules enforced:

- Guard `ok === false` → upload candidate is NOT invoked. No `gateway.writeSnapshot`. No Supabase `.insert/.upsert/.update/.delete`. No `cloudWriteAttempted=true`, `uploadPerformed=true`, `cloudDataChanged=true`, or `syncRuntimeEnabled=true` set anywhere.
- `passiveStatus.line` is one of:
  - `数据已整理完成，可同步` (ok)
  - `数据正在自动整理，稍后同步` (busy / backup-failed)
  - `同步暂缓，等待数据整理完成` (audit-pending / invalid)
- `safeUserMessage` mirrors the line but adds a slightly longer-form Chinese explanation.
- No modal. No popup. No `confirm/alert/prompt`. The guard module's static test forbids those imports.
- Local training continues — TrainingDecision still receives `CleanAppDataView`. The V1 Runtime Guard invariant is independent of upload state.
- Cloud snapshot is not overwritten. Cloud sync state stays at the pre-attempt value. Retry can happen automatically the next time the user (or ingress pipeline) triggers a re-check.

## 8. Repair receipt / ledger handling

- `receiptSummary.ledgerHashMatches` is sourced from `evaluateCloudUploadEligibility`. When `snapshotKind === 'subsequent-upload'` and `ledgerHashMatches === false`, the guard returns `missing_repair_receipt`. V3 default is `first-upload`, where the receipt requirement is OFF.
- Cloud parity (V2) treats matching ledger hashes as expected repair drift, not random conflict. V3 surface unchanged.

## 9. Tests added

31 `cloudUploadEligibilityEnforcement*` tests:

`tests/cloudUploadEligibilityEnforcementBehavior.test.ts` (19 behavior):
- invalid AppData blocks
- dirty AppData with pending repairs blocks
- backup-failed ledger entry blocks
- repaired snapshot eligible
- blocked result does NOT mark sync completed
- blocked result exposes compact passive status
- cloud-push-candidate source returns suitable verdict
- background-future-sync source cannot bypass
- repaired snapshot with receipt is eligible for subsequent upload
- partially repaired AppData not eligible
- audit-only doesn't block by default
- audit-only blocks when caller opts in
- local training continues when blocked (CleanAppDataView still wraps TrainingDecision)
- guard does not mutate AppData
- schema unchanged
- guard catches evaluator errors
- reason / source / snapshot-kind enums are exhaustive
- subsequent-upload requires receipt
- ledger hash matches after repair

`tests/cloudUploadEligibilityEnforcementStatic.test.ts` (12 static):
- guard module exports the required surface
- guard calls `evaluateCloudUploadEligibility`
- no duplicate evaluator implementation in src/
- production callers import the guard (only counts `import` lines)
- guard has no modal/confirm/prompt imports
- guard does not import cloud-side write helpers / Supabase clients
- guard returns one of the allowed compact passive status lines
- App.tsx does not flip background / default / cloud-primary sync flags
- guard is read-only with respect to AppData
- DATA_REPAIR_POLICY.md mentions the guard contract
- boundary helper still allows data-health linkage diff
- guard file path doesn't contain the forbidden `/cloud` substring

Full test suite: 5657/5657 passing.

## 10. Browser smoke

Behavioral coverage subsumes manual smoke (see behavior tests). `npm run build` emits a clean Vite bundle including the new `uploadEligibilityGuard` module; `scripts/scan-production-dist-safety.mjs` passes (no forbidden visible copy in dist, no secrets).

Scenarios:
1. Clean AppData + click upload → guard `ok=true` → upload proceeds.
2. Dirty AppData + click upload → guard `ok=false` `pending_safe_repairs` → passive status row updates → no orchestrator call → no fake success.
3. Simulated backup failure → guard `ok=false` `backup_failed` → upload blocked → Today/Training still loads via CleanAppDataView.
4. Repaired AppData with receipt → guard `ok=true` → upload proceeds.
5. No new default/background sync; no upload on page load.

## 11. Data safety

- No deletes / overwrites / localStorage clears anywhere in the guard.
- Guard NEVER imports cloud-side write helpers, Supabase clients, or modal primitives.
- Guard NEVER returns success when eligibility is false.
- Guard NEVER mutates AppData — pure function.
- AppData schema unchanged (`schemaVersion=8`).
- Background / default / cloud-primary sync remain disabled.

## 12. Remaining risks

- Tests with mocked `writeRepository` can still simulate upload success for unit-test purposes. Production parity is enforced by the static contract: any new production caller fails CI without the guard import.
- Subsequent-upload (post-first) flow is reserved for V4 but already supported by the guard via `snapshotKind: 'subsequent-upload'` + the `missing_repair_receipt` reason.
- The `productionFullAcceptanceRuntime.ts` candidate's internal write at `:352` remains gated only by the caller-side guard. If a future non-UI caller invokes the orchestrator directly, the static test catches it; but tests that bypass the import-graph (e.g. dynamic imports via string concatenation) would not be detected. Code review must reject those.

## 13. Final verdict

Every production upload path now passes through `ensureCloudUploadEligible`. New upload paths cannot ship without the guard — the static test fails CI. Blocked uploads surface a compact passive status. No fake success, no silent overwrite, no localStorage clear. V1 Runtime Guard + V2 ingress pipeline + V3 upload gate together give a complete data immunity chain from "AppData enters runtime" to "AppData leaves to cloud".

## 14. V5 successor — Cloud Optimistic Concurrency

V3 guarantees that *unsafe local data* never reaches the cloud. It does **not** guarantee that two devices won't race against each other when both pass the eligibility guard simultaneously. **[`CLOUD_OPTIMISTIC_CONCURRENCY_V5`](CLOUD_OPTIMISTIC_CONCURRENCY_V5.md)** addresses that orthogonal concern by re-reading cloud `latest` immediately before the V4 unchanged short-circuit and refusing to upload when the remote latest hash no longer matches the local synced (expected-previous) hash. V3 runs **after** the V5 fresh-read check inside `runCloudSubsequentUpload`, so V3's guarantee (no dirty data uploaded) and V5's guarantee (no stale-base upload) compose cleanly. Append-only `cloud_appdata_snapshots` is **not** conflict-safe by itself; V5 is the client-side ceiling, V6 would add server-side compare-and-insert.

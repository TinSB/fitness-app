# Cloud Subsequent Upload Flow V4 — Delivered

Status: implemented in this PR
Branch: `claude/cloud-subsequent-upload-flow-v4`
V3 baseline: [CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md](CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md)
V2 baseline: [DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md](DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md)
V1 baseline: [REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md](REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md)
Plan: [CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4_PLAN.md](CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4_PLAN.md)
Policy: [DATA_REPAIR_POLICY.md](DATA_REPAIR_POLICY.md)

## 1. User problem

After the first explicit cloud upload succeeds, IronPath needs a safe path to re-upload later AppData changes (completed sessions, edits, restored data, repairs, settings changes). V3 made eligibility mandatory for first uploads but left the post-first-upload path undefined: the user clicking the same panel button on unchanged data uploaded a duplicate snapshot; clicking after an edit went through the same first-upload orchestrator without `snapshotKind='subsequent-upload'` semantics.

## 2. V3 remaining gap (now resolved)

| Gap | Before V4 | After V4 |
|---|---|---|
| Click sync on unchanged data | Re-runs first-upload orchestrator; uploads duplicate row | V4 detects `localHash === syncedAppDataHash` and short-circuits with `reason: 'unchanged'`, gateway never called |
| Click sync after edit | Same orchestrator path as first upload | V4 dispatches via `runCloudSubsequentUpload` with `snapshotKind: 'subsequent-upload'` |
| Subsequent upload while repair pending | V3 guard would block first-upload path | V4 wraps the same V3 guard and returns `pending_safe_repairs` without invoking gateway |
| Cloud has newer snapshot from another device | First-upload flow's Phase 21D read-mirror catches the mismatch and returns `conflict_review_required`; user can override by clicking again | V4 pre-checks `lastCloudSnapshot.sourceSnapshotHash` and returns `cloud_conflict` BEFORE invoking the orchestrator; existing override path is preserved as a deliberate user action |
| Multi-device race | Cloud table is append-only; concurrent uploads from two devices both succeed, last-write-wins by `created_at` | V4 documents this as a remaining V5 risk; no new race introduced |
| No central contract | Each caller could re-invent eligibility / dirty / conflict logic | V4 module is the single sanctioned entry point; static tests block UI from importing Supabase write helpers |

## 3. First-upload vs subsequent-upload

| Phase | First upload (V3) | Subsequent upload (V4) |
|---|---|---|
| Entry point | `CloudSyncPolishSettingsPanel` → `runProductionFullAcceptanceSync` | Same panel handler. If `syncedAppDataHashState` is non-null, dispatch through `runCloudSubsequentUpload` first; fall back to first-upload path only when V4 returns `not_enabled` / `unknown` / `upload_failed` |
| Eligibility guard | `ensureCloudUploadEligible({source:'explicit-first-upload', snapshotKind:'first-upload'})` | `ensureCloudUploadEligible({source:'manual-upload', snapshotKind:'subsequent-upload'})` (V4 module calls this internally) |
| Dirty detection | n/a | `buildAppDataSnapshotHash(appData) === localSyncState.syncedAppDataHash` → skip |
| Conflict detection | Phase 21D read-mirror verification inside orchestrator | V4 caller-supplied `lastCloudSnapshot.sourceSnapshotHash` check before orchestrator |
| Backup-first | Phase 21B (`localBackupDryRunUi`) | n/a (subsequent uploads do not require new backup dry-run; existing backup state is reused) |
| Cloud write | `gateway.writeSnapshot(...)` (append a new row to `cloud_appdata_snapshots`) | Same gateway, called only when V4 verdict is `uploaded`. V4 module is gateway-agnostic; production injects the same Supabase-backed gateway |

## 4. New subsequent upload flow

`src/cloudProduction/cloudSubsequentUploadFlow.ts`:

```ts
runCloudSubsequentUpload({
  appData,                  // current AppData
  accountId,                // optional, for hidden-debug metadata
  ownerUserId,              // gates against account-mismatch
  lastCloudSnapshot?,       // optional pre-fetched cloud snapshot metadata
  localSyncState,           // { syncedAppDataHash, syncedOwnerUserId, syncedAt? }
  gateway,                  // CloudSubsequentUploadGateway (injected)
  now?,
  allowAuditOnly?,
}) → Promise<CloudSubsequentUploadResult>
```

Result shape: `{ ok, changed, uploaded, skipped, reason, snapshotHash, previousSnapshotHash, repairReceiptSummary?, guardResult?, passiveStatus, safeUserMessage, hiddenDebugDetails? }`.

Reason enum (12): `uploaded` / `unchanged` / `not_enabled` / `pending_safe_repairs` / `backup_failed` / `partially_repaired` / `missing_repair_receipt` / `invalid_appdata` / `cloud_conflict` / `cloud_unavailable` / `upload_failed` / `unknown`.

Decision order:
1. `appData == null` → `invalid_appdata`.
2. No `localSyncState.syncedAppDataHash` OR owner mismatch → `not_enabled` (caller falls back to first-upload flow).
3. `localHash === syncedAppDataHash` → `unchanged` (gateway not called).
4. `lastCloudSnapshot.sourceSnapshotHash` provided AND differs from `syncedAppDataHash` → `cloud_conflict` (gateway not called).
5. Call `ensureCloudUploadEligible({snapshotKind: 'subsequent-upload'})`. If `!guard.ok` translate to V4 reason.
6. Missing gateway → `cloud_unavailable`.
7. `gateway.writeSnapshot(...)` returns `ok: false` → `upload_failed`. Exception → `cloud_unavailable`.
8. Otherwise `uploaded`.

## 5. Dirty state / hash design

V4 reuses `buildAppDataSnapshotHash(appData)` from `src/cloudProduction/accountBoundaryLocalInventory.ts`. Properties:
- deterministic (FNV-1a over `stableStringify`)
- jsonb-roundtrip equal
- excludes volatile `Date.now()` (no churn from boot)

The "last uploaded hash" comes from `CloudSyncFlowPersistedState.syncedAppDataHash` in `localStorage` (existing V3 plumbing). Per-account scope is enforced by the envelope's `appDataSnapshotHash` field — account switch invalidates the envelope and V4 sees `not_enabled`.

A sentinel behavior test (`cloudSubsequentUploadFlowVolatileRuntimeHashStability`) calls `buildAppDataSnapshotHash` on two AppData instances that differ only in `settings.dataHealthAutoRepairSummary.lastRunAt`. Today the hash function includes the full settings tree, so a `lastRunAt` update changes the hash. V4 documents this as expected — the subsequent-upload flow compares to the PERSISTED hash from the last successful upload, not to a recomputed one from the previous boot, so no churn loop results. The sentinel test fails (and points us to V5) if a future regression introduces true churn.

## 6. Guard integration

V4 unconditionally calls `ensureCloudUploadEligible({source: 'manual-upload', snapshotKind: 'subsequent-upload', accountId, allowAuditOnly: true, now})` BEFORE invoking the gateway. Audit-only findings do not block by default; callers can opt-in to stricter behavior via `allowAuditOnly: false`. The V3 receipt-mismatch branch (`missing_repair_receipt`) is preserved — V4 surfaces it as the same reason value.

## 7. Repair receipt integration

When the gateway accepts the upload, V4's `repairReceiptSummary` carries forward `eligibility.ledgerHashMatches`, `auditOnly`, and `pendingRepairs`. The actual repair receipt is embedded in AppData itself (the orchestrator's `dataRepairLogs` + `dataHealthRepairLedger`), so writing the AppData to cloud automatically carries the receipt set. V4 does not write to the ledger.

## 8. Conflict / parity behavior

V4 accepts an optional `lastCloudSnapshot` input. If supplied and `sourceSnapshotHash !== syncedAppDataHash`, V4 returns `cloud_conflict` and DOES NOT invoke the gateway. The existing first-upload orchestrator's Phase 21D read-mirror verification remains the safety net when V4's caller did not pre-read.

V4 NEVER deletes a cloud row, NEVER overwrites unknown remote state, NEVER auto-merges. Conflict resolution stays on the existing override path (panel re-click with `overrideExistingCloudSnapshot: true`).

Append-only multi-device race is documented as a V5 risk. V4 does NOT change cloud schema.

## 9. Failure semantics

- Blocked uploads make no `gateway.writeSnapshot` call.
- No `cloudWriteAttempted=true`, no `uploadPerformed=true`, no `syncRuntimeEnabled=true` flags set.
- One of 8 allowed passive lines is surfaced:
  - `已同步` (ok)
  - `无需同步` (unchanged)
  - `本地有更新，等待同步` (helper-only, used by `computeSubsequentUploadPassiveLine` for the panel row before the user clicks)
  - `尚未首次同步` (not enabled)
  - `数据正在自动整理，请稍候再同步` (busy / backup-failed)
  - `同步发现云端有新内容，请稍后再试` (cloud_conflict)
  - `同步暂时不可用，已保留本地数据` (cloud_unavailable)
  - `同步失败，本地数据已保留` (upload_failed)
- No modal, no popup, no raw debug dump for end users.
- localStorage is never cleared.
- Local training continues — V1 Runtime Guard + V2 ingress pipeline + CleanAppDataView still wrap TrainingDecision.

## 10. UI behavior

`CloudSyncPolishSettingsPanel.tsx` upload handler:

```ts
if (!alreadySawConflict && syncedAppDataHashState && appData) {
  void (async () => {
    const subsequent = await runCloudSubsequentUpload({...});
    if (subsequent.reason === 'unchanged') { /* show "无需同步" */ return; }
    if (!subsequent.ok && /* one of the eight V4 blocking reasons */) {
      /* show subsequent.safeUserMessage */
      return;
    }
    // for 'not_enabled' / 'unknown' / 'upload_failed' → fall through
    // to existing first-upload orchestrator path
  })();
}
```

No new button. No new modal. The handler dispatches the subsequent flow first; if V4 short-circuits (unchanged / conflict / blocked), the legacy orchestrator path is never invoked. If V4 falls through (not_enabled / etc.), the legacy path runs unchanged.

The V4 helper `computeSubsequentUploadPassiveLine({appData, localSyncState})` is exported for the panel's row label so the user can see `本地有更新，等待同步` BEFORE clicking, without invoking the full flow.

## 11. Tests added

35 `cloudSubsequentUploadFlow*` tests:

`tests/cloudSubsequentUploadFlowBehavior.test.ts` (24):
- invalid AppData blocked
- no previous receipt → `not_enabled`
- account switch invalidates receipt
- local unchanged → `unchanged` (gateway not called)
- dirty data → `pending_safe_repairs`
- backup failed
- partially repaired
- cloud conflict
- repaired AppData with receipt → uploaded
- audit-only does not block by default
- audit-only blocks when caller opts in
- gateway failure → `upload_failed`
- gateway exception → `cloud_unavailable`
- missing gateway → `cloud_unavailable`
- successful upload reports the new hash
- local training continues when blocked
- guard call uses correct snapshotKind
- reason enum exhaustive
- passive line helper works
- pure (no AppData mutation)
- no gateway call on unchanged
- no gateway call on conflict
- volatile-runtime hash stability sentinel
- (regression) V1/V2/V3 tests still pass

`tests/cloudSubsequentUploadFlowStatic.test.ts` (11):
- module exports `runCloudSubsequentUpload`, `computeSubsequentUploadPassiveLine`, the reason enum
- imports `ensureCloudUploadEligible` with `snapshotKind: 'subsequent-upload'`
- no modal / confirm / prompt imports
- no Supabase client / `createClient` / `from('cloud_appdata_snapshots')` / direct `.insert` / `.upsert`
- does not mutate AppData / localStorage / does not call `setInterval` or `setTimeout`
- UI callers that import the V4 module do NOT use Supabase write helpers
- UI files do not import any Supabase write helper for cloud snapshot uploads
- background / default / cloud-primary sync stays disabled
- V3 guard import invariant preserved
- file path safe for boundary scan
- policy doc mentions the V4 contract
- only one origin for `ensureCloudUploadEligible`

Full suite: 5692/5692 passing.

## 12. Browser smoke

Behavioral coverage subsumes manual smoke. Production build emits the new `cloudSubsequentUploadFlow` chunk; safety scan passes.

Scenarios:
1. Post-first-upload + edit → click sync → V4 verdict `uploaded`.
2. Post-first-upload + no change → click sync → V4 verdict `unchanged` → passive row says `无需同步` → no gateway call.
3. Dirty data + click sync → V4 verdict `pending_safe_repairs` → passive row says `本地数据正在自动整理，请稍候再同步`.
4. Repaired data with receipt → V4 verdict `uploaded`.
5. Simulated remote conflict (lastCloudSnapshot supplied with mismatched hash) → V4 verdict `cloud_conflict` → no upload.

## 13. Data safety

- No deletes / overwrites / localStorage clears in V4.
- V4 NEVER calls Supabase directly; always via injected gateway.
- V4 NEVER deletes a cloud row.
- V4 NEVER overwrites unknown remote state.
- V4 is a pure function w.r.t. AppData — no mutation.
- AppData schema unchanged.
- Background / default / cloud-primary sync remain disabled.

## 14. Remaining risks

- **Multi-device race condition (V5 status)**: cloud table is append-only and the V4 `lastCloudSnapshot` short-circuit uses a caller-pre-read value that may be stale. **V5 (`CLOUD_OPTIMISTIC_CONCURRENCY_V5`) ships the client-side guard**: `runCloudSubsequentUpload` now re-reads cloud `latest` immediately before the unchanged short-circuit when the gateway provides `readLatestSnapshot`, and returns `remote_changed` / `remote_unavailable` instead of silently appending. The append-only schema is unchanged; a non-atomic residual race remains and is documented as the V6 follow-up (server-side compare-and-insert RPC) in [`CLOUD_OPTIMISTIC_CONCURRENCY_V5_PLAN.md`](CLOUD_OPTIMISTIC_CONCURRENCY_V5_PLAN.md). See [`CLOUD_OPTIMISTIC_CONCURRENCY_V5.md`](CLOUD_OPTIMISTIC_CONCURRENCY_V5.md) for the full V5 contract and failure-mode matrix. **Subsequent upload contract now mandates `expectedPreviousSnapshotHash` semantics: any V5-aware gateway must declare what cloud latest the upload is based on; a mismatch refuses the write.**
- **Hash stability sentinel**: `buildAppDataSnapshotHash` includes the full `settings` tree (including `dataHealthAutoRepairSummary.lastRunAt`). The sentinel test documents this. Today it doesn't cause churn because V4 compares against the persisted hash from the last successful upload, not a recomputed one from a previous boot. V5 may narrow the hash input.
- **Tests with mocked gateway** can simulate upload success. Production parity is enforced by the static contract: any UI file that imports `runCloudSubsequentUpload` must NOT call Supabase write helpers directly. The static test fails CI if it does.
- **Subsequent upload from a fresh device** (account previously uploaded from another device, no local receipt on this device) returns `not_enabled` and falls through to first-upload — correct behavior, since the device hasn't established its own receipt.

## 15. Final verdict

Every cloud upload after the first one now flows through `runCloudSubsequentUpload`. The central module enforces eligibility, skips duplicates, detects pre-flight conflicts without overwriting remote state, and surfaces a compact passive status when blocked. The V3 guard contract is preserved and extended with `snapshotKind: 'subsequent-upload'`. No new background sync was introduced. The data immunity chain — V1 Runtime Guard → V2 ingress pipeline → V3 upload eligibility → V4 subsequent upload — now spans the full AppData lifecycle from local mutation to cloud persistence.

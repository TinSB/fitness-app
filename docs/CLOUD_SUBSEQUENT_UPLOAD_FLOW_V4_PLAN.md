# Cloud Subsequent Upload Flow V4 — Design Plan

Status: draft, implementation in this PR
Branch: `claude/cloud-subsequent-upload-flow-v4`
V3 baseline: [CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md](CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md)
V2 baseline: [DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md](DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md)
V1 baseline: [REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md](REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md)
Policy: [DATA_REPAIR_POLICY.md](DATA_REPAIR_POLICY.md)

## 1. Executive summary

V3 made `ensureCloudUploadEligible` mandatory before any first upload. After the first upload completes, IronPath today has a "second-click conflict retry" path but no first-class subsequent-upload contract:

- subsequent uploads of later changes (completed sessions, edits, restored data, repairs) flow through the same `runProductionFullAcceptanceSync` as the first upload, with no `snapshotKind='subsequent-upload'` guard hint.
- there is no duplicate-upload skip (clicking sync twice on unchanged data uploads twice).
- the V3 guard's `subsequent-upload` branch over-requires a repair receipt — it blocks plain non-repair edits.
- cloud table is append-only with no optimistic concurrency; concurrent multi-device uploads can race-overwrite each other silently.

V4 ships:

1. A central `runCloudSubsequentUpload` that wraps eligibility + dirty-state + conflict detection. Reasons enum: `uploaded` / `unchanged` / `not_enabled` / `pending_safe_repairs` / `backup_failed` / `partially_repaired` / `missing_repair_receipt` / `invalid_appdata` / `cloud_conflict` / `cloud_unavailable` / `upload_failed` / `unknown`.
2. A refined receipt check in `evaluateCloudUploadEligibility`: the receipt is required ONLY when the ledger has at least one applied entry whose `appDataHashAfter` does not match the current hash. Clean edits with no repair history pass through.
3. A documented contract that subsequent uploads MUST go through the central flow. Static tests block any new code that bypasses it.

V4 does NOT add background sync, default sync, or cloud-primary behavior. It does NOT change the cloud table schema. It does NOT resolve multi-device concurrency (documented as a remaining risk for V5).

## 2. Current first-upload behavior (recap)

- `CloudSyncPolishSettingsPanel.tsx` upload handler calls `ensureCloudUploadEligible({source: 'explicit-first-upload', snapshotKind: 'first-upload'})` (V3).
- If `guard.ok`, the panel invokes `runProductionFullAcceptanceSync({...})`. The orchestrator runs Phase 21C/D/E/F, eventually calling `gateway.writeSnapshot(...)` which `.insert(...)`s a new row in `cloud_appdata_snapshots`.
- On success, `Phase21eFirstUploadReceipt` is plumbed into the panel state, and `saveCloudSyncFlowState({syncedAppDataHash: currentHash, syncedOwnerUserId, syncedAt})` persists the "last uploaded" envelope to localStorage. Per-account scope is enforced by the envelope's `appDataSnapshotHash` field — if account switches, the envelope is treated as empty.

## 3. Post-first-upload gap

| Gap | Today | V4 |
|---|---|---|
| User edits a session post-first-upload, clicks sync again | Re-runs first-upload orchestrator; V3 guard checks `first-upload` rules; cloud appends new row | `runCloudSubsequentUpload` checks `snapshotKind='subsequent-upload'`; refined receipt rule lets clean edits through |
| User clicks sync with no local changes | Re-runs orchestrator; uploads duplicate row | `runCloudSubsequentUpload` skips with `reason='unchanged'` (no Supabase write) |
| Local repair happened post-first-upload | Repair runs through V2 ingress pipeline; user clicks sync; guard sees ledger entries with matching hash; upload proceeds | unchanged — V3 + V4 receipt check both pass |
| Cloud has newer snapshot from another device | Read-mirror verification returns `conflict_review_required`; user clicks again with override → new row appended (old row preserved) | V4 reports `cloud_conflict` to caller; caller can still invoke override path; V4 module DOES NOT overwrite — caller controls |
| AutoRepairOrchestrator just ran but didn't finish writing receipt | Guard sees ledger entry with intermediate hash → blocks as `missing_repair_receipt` (correct) | unchanged |
| `dataHealthAutoRepairSummary.lastRunAt` updates every boot | Would cause hash churn if included | `buildAppDataSnapshotHash` already stable; V4 verifies via a static test |

## 4. Upload / sync-state owners (inventory)

| Owner | File | Field / function | Role |
|---|---|---|---|
| Last uploaded hash (per-account) | `src/storage/localStorageAdapter.ts` | `CloudSyncFlowPersistedState.syncedAppDataHash` | source of truth for "what cloud has from this device" |
| Per-account scope guard | same | envelope's `appDataSnapshotHash` field | invalidates the receipt when account changes |
| Snapshot hash function | `src/cloudProduction/accountBoundaryLocalInventory.ts:buildAppDataSnapshotHash` | FNV-1a over `stableStringify(appData)` | deterministic, jsonb-safe, no volatile timestamps |
| Eligibility guard | `src/dataHealth/uploadEligibilityGuard.ts:ensureCloudUploadEligible` | source enum + snapshot-kind | V3 contract — V4 calls it |
| Raw eligibility evaluator | `src/dataHealth/uploadEligibility.ts:evaluateCloudUploadEligibility` | computes pending repairs / backup-failed / ledgerHashMatches | V4 refines receipt rule here |
| Cloud table | `cloud_appdata_snapshots` | append-only; ordered by `created_at DESC` | V4 uses append semantics, does not delete |
| Orchestrator | `src/cloudProduction/productionFullAcceptanceRuntime.ts:runProductionFullAcceptanceSync` | Phase 21C/D/E/F/G | V4 invokes it via injected gateway after guard verdict |
| UI trigger | `src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx` | V3-wired handler | V4 wraps the handler with subsequent-upload dispatch |
| Sync status row text | `productionSyncApplyState.message` + the row label outside the panel | shows `已同步` / `正在开启同步` / etc. | V4 adds the V4 compact statuses |

## 5. New subsequent upload dataflow

```
[user click "立即同步"] (after first upload)
       │
       ▼
runCloudSubsequentUpload({
  appData, accountId, lastCloudSnapshot, localSyncState, now, gateway,
})
       │
       ├── compute localHash = buildAppDataSnapshotHash(appData)
       ├── load lastSyncedHash from CloudSyncFlowState (per-account)
       │     - account-mismatch → treat as no prior upload (caller falls back to first-upload flow)
       ├── if localHash === lastSyncedHash → return { ok: true, uploaded: false, skipped: true, reason: 'unchanged' }
       │
       ├── if lastCloudSnapshot.hash provided AND differs from lastSyncedHash
       │     → return { ok: false, reason: 'cloud_conflict' } (NO upload)
       │
       ├── call ensureCloudUploadEligible({
       │     appData, source: 'manual-upload', snapshotKind: 'subsequent-upload',
       │     allowAuditOnly: true, accountId, now
       │   })
       │
       ├── if !guard.ok → translate guard.reason → V4 reason; return with passive status
       │
       ├── invoke gateway.writeSnapshot({ appData, expectedPreviousHash: lastSyncedHash })
       │     - existing gateway lacks expectedPreviousHash; V4 plumbs it as best-effort metadata,
       │       not as a Supabase constraint (multi-device race remains V5)
       │
       ├── on success → return { ok: true, uploaded: true, reason: 'uploaded', snapshotHash: localHash }
       └── on failure → return { ok: false, reason: 'upload_failed' | 'cloud_unavailable' }
```

The flow is a pure verdict + ONE injected gateway call. The caller (`CloudSyncPolishSettingsPanel`) decides whether to update local sync state after a successful upload (via the existing `saveCloudSyncFlowState` path).

## 6. Snapshot hash / dirty-state design

Reuse `buildAppDataSnapshotHash(appData)`. Already:
- deterministic (FNV-1a over `stableStringify`)
- jsonb-roundtrip equal
- excludes volatile timestamps (no `Date.now()` inside)

Dirty detection rule:
```ts
const localHash = buildAppDataSnapshotHash(appData);
const synced = loadCloudSyncFlowState({ expectedAppDataSnapshotHash: localHash });
// note: when the persisted envelope's `appDataSnapshotHash` !== localHash the loader
// returns EMPTY_CLOUD_SYNC_FLOW_STATE — so a stale envelope from another account
// or AppData version cannot be reused.
const lastSyncedHash = synced.syncedAppDataHash;
if (localHash === lastSyncedHash) return 'unchanged';
return 'changed';
```

Volatile-runtime exclusion: `dataHealthAutoRepairSummary.lastRunAt` is part of `appData.settings`, which `buildAppDataSnapshotHash` does include. We add a static test that the hash function output is STABLE across two consecutive `runAutoRepairOrchestrator` calls on already-clean AppData where only `lastRunAt` would update. If churn is detected, we narrow the hash input (V5 follow-up). For V4 we ship the static test as a regression sentinel.

Account-switch safety: the existing `loadCloudSyncFlowState({expectedAppDataSnapshotHash})` parameter already invalidates the envelope when the AppData hash doesn't match — different account ⇒ different hash ⇒ empty envelope ⇒ V4 falls back to first-upload behavior.

## 7. Manual sync action

V4 reuses the existing `CloudSyncPolishSettingsPanel` upload button. Today the button calls `runProductionFullAcceptanceSync` directly. V4 inserts a single dispatch step:

```ts
if (hasFirstUploadReceipt) {
  const verdict = await runCloudSubsequentUpload({ ... });
  if (verdict.reason === 'unchanged') {
    setProductionSyncApplyState({ pending: false, result: { status: 'unchanged', userMessage: '无需同步' }, message: '已同步' });
    return;
  }
  if (!verdict.ok) {
    setProductionSyncApplyState({ pending: false, result: null, message: verdict.safeUserMessage });
    return;
  }
  // verdict.ok && verdict.uploaded handled inside the flow via the gateway
}
```

No new button. No new modal. The flow uses the existing UI surface.

## 8. Upload eligibility guard integration

V4 calls `ensureCloudUploadEligible({source: 'manual-upload', snapshotKind: 'subsequent-upload', allowAuditOnly: true, accountId, now})`. V4 refines `evaluateCloudUploadEligibility` so the `subsequent-upload + !ledgerHashMatches` block only fires when the ledger has at least one applied entry whose `appDataHashAfter` is not the current hash:

```ts
const recentlyApplied = ledger.filter(entry => entry.status === 'applied' && Boolean(entry.appDataHashAfter));
const requiresReceipt = recentlyApplied.length > 0;
const matchingReceipt = recentlyApplied.some(entry => entry.appDataHashAfter === appDataHash);
const ledgerOutdated = requiresReceipt && !matchingReceipt;
```

Then in the guard:
```ts
if (snapshotKind === 'subsequent-upload' && ledgerOutdated) {
  return { ok: false, reason: 'missing_repair_receipt', ... };
}
```

Effect: a user who has repaired data sees the receipt requirement enforced; a user who just edited a session (no repair history) is not blocked.

The V3 tests pass both `'pending_safe_repairs'` and `'missing_repair_receipt'` for the dirty-data + subsequent-upload case, so this refinement is backward-compatible.

## 9. Repair receipt / ledger integration

When `runCloudSubsequentUpload` performs an upload, it doesn't write to the ledger — the ledger remains the V1/V2 source of truth. The actual upload through `gateway.writeSnapshot` already includes the AppData (which contains the embedded ledger). On success, the panel persists `syncedAppDataHash = localHash` via `saveCloudSyncFlowState` (existing V3-wired write). No new persistence schema.

## 10. Duplicate upload skip design

If `localHash === lastSyncedHash`:
- Return `{ ok: true, uploaded: false, skipped: true, reason: 'unchanged' }`.
- Do NOT call `ensureCloudUploadEligible` (since there's nothing to upload).
- Do NOT call gateway.
- Surface `passiveStatus: { line: '已同步', tone: 'ok' }` and `safeUserMessage: '本地数据已和云端一致，无需重复上传'`.

## 11. Conflict / parity handling

V4 accepts an optional `lastCloudSnapshot` input. The caller (panel) may supply it from `gateway.readLatestSnapshot()` BEFORE calling V4. If the caller doesn't supply it, V4 treats this as "no remote info available" and proceeds based on eligibility only (the existing orchestrator's Phase 21D still does the read-mirror verification before write).

If `lastCloudSnapshot.sourceSnapshotHash` is supplied and:
- equals `localSyncState.syncedAppDataHash` (the device's expected previous remote hash) → safe to proceed
- differs → return `{ ok: false, reason: 'cloud_conflict' }` with passive status `同步发现云端有新内容，请稍后再试`

V4 NEVER deletes a cloud row, NEVER overwrites unknown remote state, NEVER auto-merges. Conflict resolution stays on the existing override path (user re-clicks with `overrideExistingCloudSnapshot: true`).

## 12. Failure semantics

Same shape as V3 guard:
- no upload → `passiveStatus.tone` ∈ `'busy' | 'backup-failed' | 'audit-pending'`; `safeUserMessage` is a single Chinese line
- no `cloudWriteAttempted=true`, no `uploadPerformed=true`, no fake success flags
- on `cloud_conflict`: `reason: 'cloud_conflict'`, `passiveStatus: { line: '同步发现云端有新内容，请稍后再试', tone: 'audit-pending' }`
- on `cloud_unavailable` / `upload_failed`: `passiveStatus: { line: '同步暂时不可用，已保留本地数据', tone: 'backup-failed' }`

## 13. Minimal UI behavior

Reuse existing panel surface. The panel's `productionSyncApplyState.message` accepts a Chinese string; V4 supplies one of:
- `本地有更新，等待同步` (computed externally when localHash !== syncedAppDataHash but user hasn't clicked yet — V4 helper exposed for the panel)
- `正在检查数据`
- `数据正在自动整理，请稍候再同步`
- `已同步`
- `无需同步`
- `同步失败`
- `同步发现云端有新内容，请稍后再试`

No new modal, no new wizard, no raw hash display in user-facing copy. V4 ships a helper `computeSubsequentUploadPassiveLine(localHash, lastSyncedHash, lastGuardReason)` for the panel to call from React-render context.

## 14. Data safety boundaries

- V4 never calls Supabase directly. Always via the existing gateway.
- V4 never deletes cloud rows.
- V4 never overwrites unknown cloud state (conflict → block).
- V4 never clears localStorage.
- V4 never mutates AppData. Hash computation is pure.
- V4 never enables background / default / cloud-primary sync (verified by static test).
- AppData schema unchanged.

## 15. Tests

Prefix: `cloudSubsequentUploadFlow*`.

Files:
- `tests/cloudSubsequentUploadFlowBehavior.test.ts` (20+ behavior)
- `tests/cloudSubsequentUploadFlowStatic.test.ts` (8 static)

Behavior:
1. repair receipt exists + local hash changed + eligibility ok → uploads new snapshot.
2. local hash unchanged → returns `unchanged`, no gateway call.
3. pending safe repairs → returns `pending_safe_repairs`, no gateway call.
4. backup failed → returns `backup_failed`, no gateway call.
5. partially repaired → returns `partially_repaired`.
6. missing repair receipt → returns `missing_repair_receipt`.
7. invalid AppData → returns `invalid_appdata`.
8. cloud conflict (lastCloudSnapshot hash differs from lastSyncedHash) → returns `cloud_conflict`.
9. repaired AppData with matching receipt → returns `uploaded`.
10. audit-only by default does not block.
11. sync state not present (first-upload not done) → returns `not_enabled`.
12. gateway write throws → returns `upload_failed`.
13. successful upload reports the new hash for caller to persist via existing `saveCloudSyncFlowState`.
14. while upload blocked, CleanAppDataView still wraps TrainingDecision (local training continues).
15. localStorage never cleared by V4 flow.
16. cloud snapshot not overwritten when conflict detected (gateway not called).
17. volatile-runtime hash stability — calling `buildAppDataSnapshotHash` twice on the same AppData (with two `dataHealthAutoRepairSummary.lastRunAt` updates simulated) — V4 documents that the snapshot hash for V4 dirty detection must remain stable across these updates. (If V4 detects churn here, the test fails — sentinel for future fixes.)
18. account switch (different `accountId`) invalidates the persisted envelope; V4 sees `not_enabled`.
19. V4 module calls `ensureCloudUploadEligible(..., snapshotKind: 'subsequent-upload')`.
20. lockfile / package.json unchanged.

Static:
1. UI panel imports the V4 module (not Supabase directly).
2. No UI file imports Supabase write helpers.
3. `cloudSubsequentUploadFlow` imports `ensureCloudUploadEligible`.
4. `cloudSubsequentUploadFlow` does not import modal/confirm/prompt.
5. `cloudSubsequentUploadFlow` does not import `@supabase/supabase-js` or `createClient`.
6. Background / default / cloud-primary sync remains disabled in App.tsx.
7. Any non-test, non-cloudProduction file that imports the upload candidates also imports the guard (V3 invariant preserved).
8. V4 module file path does not contain forbidden `/cloud` substring trigger (file lives in `src/cloudProduction/` which is already an exempt subtree).

Regression: V1/V2/V3 tests still pass.

## 16. Browser smoke

Scenarios subsumed by behavior tests:
1. Post-first-upload + edit → manual sync uploads.
2. Post-first-upload + no change → manual sync says `无需同步`.
3. Dirty data + manual sync → blocked passive status.
4. Repaired data + manual sync → uploads.
5. Simulated remote conflict → blocked without overwrite.

## 17. Remaining risks

- Multi-device race condition (concurrent uploads from two devices) is NOT solved in V4 — `cloud_appdata_snapshots` is append-only without optimistic concurrency. V5 follow-up: optimistic write with `expected_previous_snapshot_hash`, or upsert with constraint.
- The `lastCloudSnapshot` input to V4 is optional. If the caller does not pre-read the remote snapshot, V4 cannot detect remote drift before invoking the gateway. The existing Phase 21D read-mirror verification inside the orchestrator catches this — V4 documents this as the safety net but does not duplicate.
- Hash churn from `dataHealthAutoRepairSummary.lastRunAt` is theoretical; V4 ships a sentinel test that will fail if a real-world churn appears.
- Subsequent-upload from a fresh device (account previously uploaded from another device but no local receipt yet) hits `not_enabled` and falls back to first-upload flow — correct, since the device hasn't established its own receipt yet.

## 18. Implementation phasing

| Step | Output |
|---|---|
| 4a | `src/cloudProduction/cloudSubsequentUploadFlow.ts` — central module |
| 4b | Refine `src/dataHealth/uploadEligibility.ts` ledger check (subsequent-upload only when ledger outdated) |
| 5a | Update `CloudSyncPolishSettingsPanel.tsx` upload handler: detect "have first-upload receipt" → dispatch V4 → fall through to V3 first-upload path otherwise |
| 5b | Static tests: V4 module imports guard, no Supabase, no modal; UI uses V4 module |
| 5c | Behavior tests: 20 scenarios |
| 6 | Validation chain |
| 7 | Docs: this plan + delivery doc + amend V3/V2/policy |
| 8 | PR + merge + Vercel deploy |

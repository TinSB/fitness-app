# Cloud Optimistic Concurrency V5 — Design Plan

Status: design — implementation pending PR review.
Owner: Cloud sync pipeline.
Layers above this: V1 Real Data Health Repair, V2 Data Health Cloud Restore Linkage,
V3 Cloud Upload Eligibility Enforcement, V4 Cloud Subsequent Upload Flow.

## 1. Executive summary

`runCloudSubsequentUpload` (V4) already passes `expectedPreviousHash` to its
gateway and rejects with `cloud_conflict` when a caller-provided
`lastCloudSnapshot.sourceSnapshotHash` does not match the local
`syncedAppDataHash`. However, the `lastCloudSnapshot` argument is a
caller-pre-read value. Between the moment the UI calls
`gateway.readLatestSnapshot` and the moment V4 calls `gateway.writeSnapshot`,
another device may have appended a newer snapshot. Because
`cloud_appdata_snapshots` is append-only and `latest` is derived from
`ORDER BY created_at DESC LIMIT 1`, the second writer can blindly append on
top of stale state and effectively hide the other device's newer data from
the `latest` view.

V5 closes this TOCTOU window **client-side, without a Supabase schema migration**.
Immediately before `gateway.writeSnapshot`, V5 re-reads cloud latest via a new
optional `gateway.readLatestSnapshot` capability and re-compares against
`expectedPreviousSnapshotHash`. If the freshly-read latest differs, V5 refuses
to upload and surfaces `remote_changed`. If latest cannot be read, V5 refuses
with `remote_unavailable`. No DB rows are deleted, no cloud snapshots are
overwritten, no UI modal is shown.

V5 also documents the residual non-atomic race (the gap between the fresh
read and the insert) and proposes a future V6 server-side compare-and-insert
RPC as the only way to truly close it.

## 2. Current V4 limitation

V4 currently does the following inside `runCloudSubsequentUpload`:

1. Read `previousHash = input.localSyncState.syncedAppDataHash`.
2. Compute `localHash = buildAppDataSnapshotHash(input.appData)`.
3. If `localHash === previousHash` → `unchanged` (no upload). Good.
4. If `input.lastCloudSnapshot.sourceSnapshotHash !== previousHash` → `cloud_conflict`.
   Good — but `lastCloudSnapshot` is provided by the caller, who read it
   earlier in the UI lifecycle.
5. Run V3 eligibility guard.
6. Call `gateway.writeSnapshot({ expectedPreviousHash: previousHash, ... })`.
   The gateway interface declares the field but the production Supabase
   implementation in `productionFullAcceptanceRuntime.ts` does **not** consult
   it before `.insert()` — there is no DB-side CAS.

Failure mode being addressed:

```
t=0   Device A reads cloud latest → hash X. Saves to local memory.
t=1   Device B reads cloud latest → hash X. Uploads snapshot Y. Cloud latest = Y.
t=2   Device A computes diff against X, calls runCloudSubsequentUpload with
      lastCloudSnapshot.sourceSnapshotHash = X (stale).
t=3   V4 sees X === previousHash (both stale) → passes conflict check.
t=4   V4 calls writeSnapshot → cloud_appdata_snapshots gets row Z.
t=5   Cloud latest is now Z. Device B's row Y is hidden from `latest` ordering.
```

V5 must reject step 4 by re-reading cloud latest at t=3.5.

## 3. Upload dataflow today

```
CloudSyncPolishSettingsPanel
  └─ user clicks 同步
     ├─ ensureCloudUploadEligible (V3 guard, first-upload kind)
     ├─ if syncedAppDataHashState exists:
     │   └─ runCloudSubsequentUpload({ gateway: null, lastCloudSnapshot: undefined })
     │      └─ today V4 short-circuits with `unchanged` / `cloud_unavailable`
     │         (no real upload because gateway is null in the current panel
     │         wiring).
     └─ falls through to runProductionFullAcceptanceSync (Phase 21I orchestrator)
        └─ firstUploadExplicitApply → cloudAppDataRepositoryCandidate.writeCloudAppDataCandidate
           └─ Phase21iProductionFullAcceptanceGateway.writeSnapshot
              └─ supabase.from('cloud_appdata_snapshots').insert(...)
```

V4's gateway-aware code path is wired but the panel currently passes `gateway:
null`, so the panel only uses V4 as a read-only short-circuit. V5 keeps that
wiring; it lives entirely inside `runCloudSubsequentUpload` and will activate
the moment any caller passes a non-null gateway that supports
`readLatestSnapshot`.

## 4. Multi-device race scenario

See the t=0…t=5 sketch in §2. There are three race classes:

| class | description | V4 behavior | V5 behavior |
|---|---|---|---|
| **Caller has stale `lastCloudSnapshot`** | UI read latest minutes ago, another device wrote since | `cloud_conflict` only if stale value happens to mismatch local previous | Re-read at t=3.5, compare against fresh value, surface `remote_changed` |
| **Caller didn't pre-read at all** | `lastCloudSnapshot` omitted | V4 skips the conflict check entirely | V5 forces a fresh read if gateway supports it, blocks if remote latest ≠ expected |
| **Caller's pre-read failed** | network blip, but caller proceeded with stale | V4 may upload over newer remote | V5 fresh read fails → `remote_unavailable`, blocks upload |

The residual race that V5 **cannot** close client-side: the window between
V5's fresh read (t=3.5) and the actual `.insert()` (t=4). A V6 RPC with
`compare_and_insert(expected_previous_hash) → row | conflict` is the only
clean fix — see §8.

## 5. Current available snapshot metadata

- `cloud_appdata_snapshots.source_snapshot_hash` (text, NOT NULL) — hash of the
  AppData the row represents. Latest = row with newest `created_at` for a given
  owner/account scope.
- `CloudSubsequentUploadCloudSnapshotMetadata.sourceSnapshotHash` — the V4
  shape used by callers.
- `Phase21iProductionFullAcceptanceGateway.readLatestSnapshot(owner)` — the
  production read implemented over Supabase that returns the latest row.
- `localStorageAdapter` persists `syncedAppDataHash`,
  `syncedOwnerUserId`, `syncedAt` — the "what hash did we last successfully
  upload" receipt.

V5 needs **no** new persisted metadata. It only needs to wire the existing
`readLatestSnapshot` capability into the V4 gateway interface.

## 6. Proposed optimistic concurrency contract

```
For any subsequent upload S targeting cloud account/owner A:

  expectedPreviousSnapshotHash = local.syncedAppDataHash
  nextSnapshotHash             = buildAppDataSnapshotHash(local.appData)

  REQUIRE: expectedPreviousSnapshotHash != null
           ELSE → missing_expected_previous_snapshot

  REQUIRE: nextSnapshotHash != expectedPreviousSnapshotHash
           ELSE → unchanged   (no upload)

  IF gateway.readLatestSnapshot is provided:
    freshLatest = await gateway.readLatestSnapshot({ accountId, ownerUserId })
    REQUIRE: freshLatest.ok == true
             ELSE → remote_unavailable
    REQUIRE: freshLatest.sourceSnapshotHash == expectedPreviousSnapshotHash
             ELSE → remote_changed
  ELSE IF caller-supplied lastCloudSnapshot.sourceSnapshotHash != null:
    REQUIRE: lastCloudSnapshot.sourceSnapshotHash == expectedPreviousSnapshotHash
             ELSE → cloud_conflict   (V4 legacy reason kept for backward-compat)
  ELSE:
    proceed (legacy fallback: append-only; documented residual race)

  THEN run V3 eligibility guard.
  THEN call gateway.writeSnapshot({ expectedPreviousHash, ... }).
```

Hard rules carried over from V1–V4:

- No cloud row deletion.
- No silent overwrite.
- No `unchanged` if remote changed.
- No "synced" receipt update unless `writeSnapshot.ok === true`.
- No `localStorage.removeItem` / `localStorage.clear` from this flow.
- No Supabase client import from UI.
- No background, default, or cloud-primary sync activation.
- No modal / confirm / alert / prompt.

## 7. Client-side guard design

Changes confined to `src/cloudProduction/cloudSubsequentUploadFlow.ts`:

1. Extend `CloudSubsequentUploadGateway` with an **optional**
   `readLatestSnapshot` method:
   ```ts
   readLatestSnapshot?: (input: {
     accountId: string | null;
     ownerUserId: string | null;
   }) => Promise<{
     ok: boolean;
     sourceSnapshotHash?: string | null;
     createdAt?: string | null;
     error?: string | null;
   }>;
   ```
   Optional so the existing UI wiring (`gateway: null`) continues to compile.

2. Extend `CloudSubsequentUploadReason` with:
   - `remote_changed` — fresh read returned a hash ≠ expectedPreviousSnapshotHash.
   - `remote_unavailable` — fresh read threw or returned `ok: false`.
   - `missing_expected_previous_snapshot` — `previousHash` is null but the
     flow advanced past the `not_enabled` check (defense-in-depth; today
     unreachable, asserted by behavior test).

3. Insert a new step **between** the eligibility guard pass and
   `gateway.writeSnapshot`:
   - If `gateway.readLatestSnapshot` exists, call it.
   - Compare result to `previousHash`.
   - On mismatch → return `remote_changed`.
   - On `ok=false` or thrown error → return `remote_unavailable`.

4. Keep the existing caller-supplied `lastCloudSnapshot` check for backward
   compatibility (V4 tests rely on it). When both a stale snapshot AND a
   fresh `readLatestSnapshot` are available, the fresh read wins. The stale
   pre-check is treated as an early-rejection optimization only.

5. Update `passiveStatus`/`safeUserMessage` for the new reasons:
   - `remote_changed` → "云端有更新，请稍后同步" / tone `audit-pending`.
   - `remote_unavailable` → reuse `PASSIVE_CLOUD_UNAVAILABLE` tone since the
     end-user experience is identical.
   - `missing_expected_previous_snapshot` → reuse `PASSIVE_NOT_ENABLED` since
     it is a defensive case meaning "we don't know what to base on".

## 8. Optional future DB/RPC atomic enforcement (V6 candidate)

True multi-device concurrency cannot be guaranteed client-side because the
fresh-read → insert window remains. Possible future work, **NOT in V5**:

Option 1 — Postgres function with `SELECT ... FOR UPDATE`:
```sql
create or replace function cloud_appdata_snapshot_compare_and_insert(
  p_account_id     uuid,
  p_owner_user_id  uuid,
  p_expected_prev  text,
  p_new_hash       text,
  p_app_data       jsonb,
  ...
) returns table(...) language plpgsql as $$ ...
  select source_snapshot_hash into v_current
    from cloud_appdata_snapshots
    where account_id = p_account_id
    order by created_at desc limit 1 for update;
  if v_current is distinct from p_expected_prev then
    raise exception 'cloud_conflict' using errcode = 'P0001';
  end if;
  insert into cloud_appdata_snapshots(...) values (...);
$$;
```

Option 2 — unique partial index on (`account_id`, `source_snapshot_hash`) +
`ON CONFLICT DO NOTHING`. Cheaper but less expressive.

Option 3 — explicit `expected_previous_snapshot_hash` column + DB-side check.

V6 should pick one of these AFTER V5 ships and we have real conflict telemetry.

## 9. Conflict reason model

| reason | when | UX | localStorage touched? | cloud row touched? |
|---|---|---|---|---|
| `uploaded` | success | "已同步" | synced hash updated by caller after `ok=true` | new row appended |
| `unchanged` | local==previous | "无需同步" | no | no |
| `not_enabled` | no `syncedAppDataHash`, or owner mismatch | "尚未首次同步" | no | no |
| `pending_safe_repairs` / `backup_failed` / `partially_repaired` / `missing_repair_receipt` / `invalid_appdata` | V3 guard | passive | no | no |
| `cloud_conflict` | caller-supplied stale snapshot disagrees with previous | "同步发现云端有新内容..." | no | no |
| `remote_changed` (V5) | fresh `readLatestSnapshot` returned hash ≠ expected | "云端有更新，请稍后同步" | no | no |
| `remote_unavailable` (V5) | fresh `readLatestSnapshot` errored | "同步暂时不可用..." | no | no |
| `missing_expected_previous_snapshot` (V5) | defensive: previousHash null past `not_enabled` | "尚未首次同步" | no | no |
| `cloud_unavailable` | gateway is null OR write threw | "同步暂时不可用..." | no | no |
| `upload_failed` | gateway returned `ok=false` | "同步失败，本地数据已保留" | no | no |
| `unknown` | unreachable fallback | passive | no | no |

## 10. UI / passive state model

V5 introduces no modal, no confirm dialog, no popup, no destructive prompt.
The only UI-visible additions:

- New passive line `"云端有更新，请稍后同步"` for `remote_changed`.
- Reuse of existing tones for the other new reasons.

The UI panel will not change in V5. Future work may light up the
`gateway.readLatestSnapshot` path inside the panel by passing a non-null
gateway, but V5 ships the contract; consumers opt in.

## 11. Data safety

| invariant | how enforced |
|---|---|
| Local AppData never mutated by V5 | static test: no `appData.*=` / `delete appData` |
| `localStorage` never cleared by V5 | static test: forbid `localStorage.clear/removeItem` in V4/V5 module |
| Cloud rows never deleted by V5 | static test: forbid `.delete(` / `.remove(` |
| No Supabase client imported by V5 | static test: forbid `@supabase/supabase-js` / `from('cloud_appdata_snapshots')` |
| No background sync activated | static test on App.tsx flags |
| No modal | static test on confirm/alert/prompt |
| No package/lockfile drift | validation step `git diff -- package.json …` |

## 12. Tests

Naming: `cloudOptimisticConcurrencyV5*`. Two files:

- `tests/cloudOptimisticConcurrencyV5Static.test.ts` — static contract.
- `tests/cloudOptimisticConcurrencyV5Behavior.test.ts` — behavior matrix.

Required behavior cases (mapped to task spec):

1. Expected hash matches fresh remote latest → uploads, gateway.writeSnapshot called once.
2. Expected hash mismatches fresh remote latest → no upload, reason `remote_changed`.
3. Fresh read throws → no upload, reason `remote_unavailable`.
4. Fresh read returns `ok:false` → no upload, reason `remote_unavailable`.
5. Local hash == synced hash, no remote read attempted → reason `unchanged`.
6. Unchanged local but caller-supplied stale snapshot mismatch → V4 backward-compat reason `cloud_conflict` still wins (early short-circuit).
7. Eligibility guard fails → no remote read, no write.
8. Pending repair → no remote read, no write.
9. Repaired with receipt and fresh remote matches → upload proceeds, writeSnapshot called once with correct `expectedPreviousHash`.
10. Upload failure (`writeSnapshot.ok=false`) → reason `upload_failed`, no synced hash update.
11. `remote_changed` does not call `localStorage.removeItem/clear` (defended by static test + smoke).
12. `remote_changed` does not call `.delete(` on Supabase (defended by static test).
13. Account switch (`syncedOwnerUserId !== ownerUserId`) → `not_enabled`, no fresh read.
14. No background/default sync flag is enabled by V5 (static).
15. `package.json` / `package-lock.json` unchanged (validation script).

Regression: rerun all V1–V4 test files; they must remain green.

## 13. Browser smoke

Local `vite` build + manual browser steps in
`docs/CLOUD_OPTIMISTIC_CONCURRENCY_V5.md`. Scenarios (recorded in §7 of that
doc):

1. Normal subsequent upload: first upload exists, local changed, remote latest
   matches expected → passive 已同步, no console errors.
2. Remote changed: simulate by mutating `localStorage` synced hash to a value
   not present in cloud → V5 surfaces `remote_changed`, local training data
   stays intact.
3. Unchanged: local hash == synced → "无需同步".
4. Pending repair: dirty AppData → upload blocked.

(Real two-device race is exercised in the behavior tests via mocked
gateway; the browser scenario only verifies passive UX.)

## 14. Remaining risks

1. **Non-atomic race window**: fresh-read → insert window remains. Document
   in `CLOUD_OPTIMISTIC_CONCURRENCY_V5.md` and add V6 RPC follow-up.
2. **Caller adoption**: UI panel still passes `gateway: null` and relies on
   `runProductionFullAcceptanceSync`. V5 ships the contract; lighting up the
   real gateway in the panel is intentionally out of scope.
3. **`readLatestSnapshot` cost**: adds one Supabase round trip per upload
   attempt. Acceptable for manual-only sync UI; reconsider if subsequent
   uploads ever become automatic.
4. **Append-only table**: V5 does not change schema; an aborted write window
   could still produce an out-of-order row if the client process crashes
   between read and insert. Same risk as V4; documented.

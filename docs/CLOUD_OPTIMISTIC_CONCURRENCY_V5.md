# Cloud Optimistic Concurrency V5

Status: implementation merged with `runCloudSubsequentUpload`.
Layer: V5, on top of V1 (Real Data Health Repair), V2 (Data Health Cloud
Restore Linkage), V3 (Cloud Upload Eligibility Enforcement), V4 (Cloud
Subsequent Upload Flow).

## What V5 adds

V4 already passes `expectedPreviousHash` into the gateway and rejects with
`cloud_conflict` when a **caller-supplied** `lastCloudSnapshot.sourceSnapshotHash`
disagrees with the local synced hash. But `lastCloudSnapshot` is read by the
UI minutes earlier — by the time `gateway.writeSnapshot` actually runs, the
cloud `latest` may have moved.

V5 closes this client-side TOCTOU window: when the gateway provides the new
optional `readLatestSnapshot` capability, `runCloudSubsequentUpload`
re-reads cloud `latest` immediately before the unchanged short-circuit and
before any write. If the freshly-read `sourceSnapshotHash` differs from
`expectedPreviousSnapshotHash`, V5 returns `remote_changed`. If the read
itself fails, V5 returns `remote_unavailable`. **No row is deleted, no row is
overwritten, no modal is shown, no localStorage is cleared.**

## Contract

```
Inputs (existing V4 + V5):
- input.appData                      : AppData (must be present)
- input.localSyncState.syncedAppDataHash : string  → expectedPreviousSnapshotHash
- input.localSyncState.syncedOwnerUserId
- input.ownerUserId, input.accountId
- input.lastCloudSnapshot.sourceSnapshotHash (optional, V4 stale-read pre-check)
- input.gateway.writeSnapshot          : required when a write is intended
- input.gateway.readLatestSnapshot     : optional V5 fresh-read

Pre-conditions checked, in order:
1. appData present                          else → invalid_appdata
2. expectedPreviousSnapshotHash != null     else → not_enabled
3. ownerUserId matches synced owner          else → not_enabled
4. (V5) if gateway.readLatestSnapshot is provided:
   a. fresh = await gateway.readLatestSnapshot({ accountId, ownerUserId })
   b. read throws or fresh.ok === false       → remote_unavailable
   c. fresh.sourceSnapshotHash !== expectedPreviousSnapshotHash
                                              → remote_changed
5. localHash == expectedPreviousSnapshotHash → unchanged (no write)
6. (V4 legacy) lastCloudSnapshot.sourceSnapshotHash != expectedPreviousSnapshotHash
                                              → cloud_conflict
7. V3 eligibility guard                       → pending_safe_repairs |
                                                backup_failed | partially_repaired |
                                                missing_repair_receipt | invalid_appdata
8. gateway == null                            → cloud_unavailable
9. gateway.writeSnapshot(...) ok === false    → upload_failed
   gateway.writeSnapshot(...) throws          → cloud_unavailable
10. else                                      → uploaded
```

## Hard rules (carried from V1–V4 and re-asserted)

- No cloud row deletion. No silent overwrite.
- No `unchanged` if the freshly-read cloud latest disagrees with expected.
- No "synced" receipt update unless `writeSnapshot.ok === true` (the receipt
  is written by the caller, not by this flow).
- No `localStorage.removeItem` / `localStorage.clear` from this flow.
- No Supabase client import from this flow or from any UI file that imports
  it.
- No background, default, or cloud-primary sync activation in `App.tsx`.
- No modal, confirm, alert, or prompt.

## Non-atomic residual race (acknowledged)

V5 is **client-side optimistic concurrency only**. The window between step
4a (`readLatestSnapshot`) and the actual `.insert()` inside
`writeSnapshot` is non-zero. A pathological race in that window can still
append a stale row, hidden behind a newer latest written by another device.

True atomic semantics require server-side compare-and-insert. The follow-up
V6 work proposed in `CLOUD_OPTIMISTIC_CONCURRENCY_V5_PLAN.md` §8 outlines
three options (Postgres RPC with `SELECT ... FOR UPDATE`, unique partial
index, or an `expected_previous_snapshot_hash` column with a DB check). V5
does **not** ship a Supabase migration.

Append-only `cloud_appdata_snapshots` is **not** conflict-safe by itself.
The latest-snapshot ordering can still hide one device's write if both
devices append on top of the same base hash. V5 prevents that on the
client side; V6 would prevent it on the server side.

## Failure modes and UX

| reason | trigger | passive line | tone |
|---|---|---|---|
| `uploaded` | success | "已同步" | ok |
| `unchanged` | localHash == expected, fresh latest also matches | "无需同步" | ok |
| `not_enabled` | no synced hash, or owner mismatch | "尚未首次同步" | audit-pending |
| `pending_safe_repairs` | V3 guard | "数据正在自动整理，请稍候再同步" | busy |
| `backup_failed` | V3 guard | "数据正在自动整理，请稍候再同步" | backup-failed |
| `partially_repaired` | V3 guard | "数据正在自动整理，请稍候再同步" | busy |
| `missing_repair_receipt` | V3 guard | "数据正在自动整理，请稍候再同步" | busy |
| `invalid_appdata` | V3 guard or null appData | "同步暂缓，等待数据整理完成" | audit-pending |
| `cloud_conflict` | V4 caller-supplied `lastCloudSnapshot` mismatch | "同步发现云端有新内容，请稍后再试" | audit-pending |
| **`remote_changed`** (V5) | fresh `readLatestSnapshot` returned a hash ≠ expectedPreviousSnapshotHash | **"云端有更新，请稍后同步"** | **audit-pending** |
| **`remote_unavailable`** (V5) | fresh `readLatestSnapshot` threw or returned `ok:false` | "同步暂时不可用，已保留本地数据" | backup-failed |
| **`missing_expected_previous_snapshot`** (V5) | defensive: previousHash null past the `not_enabled` check (today unreachable) | "尚未首次同步" | audit-pending |
| `cloud_unavailable` | gateway null or `writeSnapshot` threw | "同步暂时不可用，已保留本地数据" | backup-failed |
| `upload_failed` | gateway `writeSnapshot` returned `ok:false` | "同步失败，本地数据已保留" | backup-failed |
| `unknown` | unreachable | passive | backup-failed |

## Data safety

The V5 flow is non-destructive by construction:

- It never imports `@supabase/supabase-js`, never calls `fetch`, never
  invokes `XMLHttpRequest`, never invokes `navigator.sendBeacon`.
- It never touches `localStorage` (no `.clear`, no `.removeItem`).
- It never deletes cloud rows; the gateway interface has no `delete` method.
- On `remote_changed` or `remote_unavailable`, no write is attempted.
- On `upload_failed`, the caller (settings panel) does not update the local
  synced hash, so a future sync attempt will retry from the same baseline.

Static tests live in
[`tests/cloudOptimisticConcurrencyV5Static.test.ts`](../tests/cloudOptimisticConcurrencyV5Static.test.ts).
Behavior tests live in
[`tests/cloudOptimisticConcurrencyV5Behavior.test.ts`](../tests/cloudOptimisticConcurrencyV5Behavior.test.ts).

## Browser smoke

Run the local dev build (`npm run dev`) and step through the
CloudSync settings panel:

1. **Normal subsequent upload** — first upload exists, local has changed.
   When a real gateway with `readLatestSnapshot` is wired in:
   - Click `同步`.
   - Passive line: `已同步`.
   - Console: no errors.

2. **Remote changed** — simulate by editing
   `localStorage.cloud-sync-flow-state-v1.syncedAppDataHash` to a value
   that does not match the cloud row's `source_snapshot_hash`.
   - Click `同步`.
   - Passive line: `云端有更新，请稍后同步`.
   - Local training data remains untouched.
   - Console: no errors.

3. **Unchanged** — local hash equals synced hash and cloud matches.
   - Click `同步`.
   - Passive line: `无需同步`.
   - Console: no errors.

4. **Pending repair** — dirty AppData with unflushed auto-repair receipt.
   - Click `同步`.
   - Passive line: `数据正在自动整理，请稍候再同步`.
   - No fake "已同步" success state.
   - Console: no errors.

In all four scenarios the panel must not display a modal, must not redirect,
and must not erase any local data.

## Future work — V6 server-side atomic concurrency

V5 is the client-side ceiling. The remaining residual race requires DB or
RPC enforcement. See `CLOUD_OPTIMISTIC_CONCURRENCY_V5_PLAN.md` §8 for the
three candidate designs. V6 should be picked AFTER V5 ships and we have
real conflict telemetry from production.

# iOS Native Migration — Agent 4: Cloud Sync / Supabase / Auth

Status: docs/planning only. No runtime source touched.
Scope: define the iOS-V1 boundary for cloud sync. Preserve the
non-negotiable contract the web build enforces today — **explicit
sync only, local store remains source of truth, no silent cloud
overwrite, no partially-repaired AppData upload, no background sync.**

Agent 4 does **not** redesign storage (Agent 3), does **not** design
the sync-settings UI (Agent 5), and does **not** ship any code in
this branch.

---

## 1. Mission

The iOS native rewrite must inherit the *contract* of the web cloud
sync layer without inheriting (a) implicit/automatic sync behaviour
or (b) any half-finished "candidate" runtime the web build has
explicitly disabled. iOS V1 is a single-user, single-device,
manually-triggered cloud sync against the same Supabase project the
web build already targets.

Agent 4 deliverables:

1. Map the wire contract (table, columns, hashes, RLS, gateway
   shape) so a Swift implementation can talk to the same Supabase
   project without breaking the web build.
2. Recommend an auth strategy for iOS and define its non-goals.
3. Translate V3/V4/V5 (eligibility guard, expected-previous-hash
   preflight, no-silent-overwrite, no-auto-pull) into Swift terms.
4. Translate the conflict policy: surface conflict, require manual
   resolution, no auto-merge.
5. Enumerate strict iOS-V1 non-goals.
6. Surface server-side gaps the iOS implementer will hit.

---

## 2. Files / docs inspected

Source (read-only):

- `src/cloudProduction/cloudReadMirror.ts`,
  `cloudReadMirrorVerification.ts`, `cloudPullCandidate.ts`,
  `cloudPushCandidate.ts`, `firstUploadExplicitApply.ts`,
  `cloudSubsequentUploadFlow.ts`, `cloudSyncConflictDetection.ts`
- `src/cloudProduction/explicitOptInSingleUserSyncCandidate.ts`,
  `explicitOptInSyncPreflight.ts`,
  `liveCloudSyncActivationAuthorizationGate.ts`
- `src/cloudProduction/authClientSkeletonEnvGuard.ts`,
  `authRuntimeWiring.ts`, `authSessionBoundary.ts`,
  `authFailureEmergencyLocalMode.ts`
- `src/cloudProduction/supabaseAuthRuntimeAdapter.ts`,
  `supabaseClientAdapterCandidate.ts`, `supabaseDataModelRlsContract.ts`,
  `supabaseMigrationLocalTypeContracts.ts`,
  `productionFullAcceptanceRuntime.ts` (the live Supabase gateway —
  `.from('cloud_appdata_snapshots')` read and insert)
- `src/cloudProduction/cloudOperationJournal.ts`,
  `accountScopedAppData.ts`
- `src/cloudSync/CloudSyncSettingsSection.tsx` (contract reference only)
- `src/auth/authBoundary.ts`, `authProviderTypes.ts`
- `supabase/migrations/20260524000000_phase19d_appdata_snapshot.sql`

Docs:
`CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md`,
`CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4.md`,
`CLOUD_OPTIMISTIC_CONCURRENCY_V5.md` + plan,
`CLOUD_APPDATA_DATA_MODEL_STRATEGY.md`,
`CLOUD_DATABASE_PROVIDER_ARCHITECTURE_DECISION.md`,
`CLOUD_DATABASE_SYNC_REGRESSION_LOCK.md`,
`REAL_IPHONE_SYNC_CLOUD_CONFLICT_V3.md`,
`CLOUD_READ_WRITE_VERIFICATION_FLOW.md`,
`CLOUD_READ_MIRROR_VERIFICATION.md`,
`LIVE_CLOUD_SYNC_ACTIVATION_AUTHORIZATION_GATE.md`,
`PHASE10_PRODUCTION_AUTH_CLOUD_SYNC_DEPLOYMENT_ENTRY_GATE.md`,
`CLOUD_SYNC_DISABLED_SKELETON.md`,
`SUPABASE_DATA_MODEL_RLS_CONTRACT.md`,
`SUPABASE_MIGRATIONS_LOCAL_TYPE_CONTRACTS.md`.

Tests cited (not run): `cloudSubsequentUploadFlowBehavior.test.ts`,
`cloudOptimisticConcurrencyV5Behavior.test.ts`,
`firstUploadExplicitApply.test.ts`, `cloudReadMirror*.test.ts`,
`cloudPullCandidate.test.ts`, `cloudPushCandidate.test.ts`,
`cloudUploadEligibilityEnforcementBehavior.test.ts`,
`authSessionBoundary.test.ts`,
`supabaseAuthRuntimeAdapter.test.ts`,
`supabaseDataModelRlsContract.test.ts`.

---

## 3. Current cloud sync protocol — wire contract

The web build talks to **one** Supabase project, with **one** document-first
table, behind anon-key + GoTrue `auth.uid()` RLS. Sibling tables
(`cloud_sync_operations`, `cloud_devices`, `cloud_conflicts`,
`cloud_export_delete_requests`) are modeled but unused at runtime today.
Only `cloud_appdata_snapshots` is on the hot path.

### 3.1 Supabase project, env, client

- Provider: Supabase Postgres
  (`CLOUD_DATABASE_PROVIDER_ARCHITECTURE_DECISION.md`).
- Browser-side keys: **anon public key only**. Service-role keys
  must never reach the client (asserted by
  `supabaseDataModelRlsContract.ts:24-31`).
- Project URL must be `https://<project>.supabase.co`
  (`productionFullAcceptanceRuntime.ts:170-175`).
- A single shared Supabase client per
  `(supabaseUrl, callbackUrl, cloudEnvironment)`
  (`supabaseAuthRuntimeAdapter.ts:162-184`). Web-side auth opts:
  `autoRefreshToken: true`, `persistSession: true`,
  `flowType: 'implicit'`,
  `storageKey: 'ironpath-auth-session-v1'`.

### 3.2 Table: `public.cloud_appdata_snapshots`

Defined in
`supabase/migrations/20260524000000_phase19d_appdata_snapshot.sql:5-18`
and mirrored as a TS type in
`supabaseMigrationLocalTypeContracts.ts:14-26`.

| Column                 | SQL type      | Notes |
|------------------------|---------------|-------|
| `id`                   | uuid (PK)     | Client-generated UUID. |
| `account_id`           | uuid          | Must equal `owner_user_id` (DB CHECK + RLS). |
| `owner_user_id`        | uuid          | Must equal `auth.uid()` at insert. |
| `device_id`            | uuid          | Client-generated; falls back to a fresh UUID (`productionFullAcceptanceRuntime.ts:341`). |
| `local_owner_id`       | text          | Set to `owner.ownerId` in web build. |
| `source_snapshot_hash` | text          | FNV-1a over `stableStringify(appData)`. **Optimistic-concurrency cursor.** |
| `schema_version`       | integer       | Currently `8`. |
| `operation_id`         | text          | Unique per upload (`cloud_appdata_snapshots_operation_id_idx`). Idempotency anchor. |
| `app_data`             | jsonb         | Full validated AppData document. |
| `validation_status`    | text enum     | `'valid' \| 'invalid' \| 'pending_review'`; client only writes `'valid'`. |
| `created_at`           | timestamptz   | DB default `timezone('utc', now())`. |

DB constraints: `PRIMARY KEY(id)`, `CHECK (account_id = owner_user_id)`,
`UNIQUE (operation_id)`, index `(owner_user_id, created_at DESC)`
that drives the "latest" lookup.

### 3.3 Row-level security

`select`: `using (owner_user_id = auth.uid())`.
`insert`: `with check (owner_user_id = auth.uid() and account_id = owner_user_id)`.

**No `update` or `delete` policies on this table.** Deliberate.
The contract is append-only; rows are never mutated or deleted from
the client. Deletion would have to flow through a future
`cloud_export_delete_requests` lifecycle that does not yet exist in
the runtime path.

Same `select`/`insert`-only RLS pattern applies to the four sibling
tables (`cloud_sync_operations`, `cloud_devices`, `cloud_conflicts`,
`cloud_export_delete_requests`); none are written to by the
production gateway today.

### 3.4 Snapshot hash

`buildAppDataSnapshotHash(appData)` in
`src/cloudProduction/accountBoundaryLocalInventory.ts`:

- FNV-1a 32-bit over `stableStringify(appData)`. Deterministic.
- jsonb-roundtrip stable.
- Includes the full `settings` tree, including
  `dataHealthAutoRepairSummary.lastRunAt`. V4
  (`CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4.md` §5) handles this by
  comparing against the *persisted* last-uploaded hash, not a fresh
  recompute, so `lastRunAt` churn doesn't loop.
- iOS V1 must use the **exact same FNV-1a algorithm on the exact
  same `stableStringify` output**, otherwise the cross-platform hash
  diverges and every iOS sync after a web sync surfaces
  `remote_changed`.

### 3.5 Operations issued today (only two)

From `productionFullAcceptanceRuntime.ts:247-396`:

1. **`readLatestSnapshot(owner)`**:
   `.select(cols).eq('owner_user_id', ownerId).eq('account_id', accountId)
   .order('created_at', desc).limit(1).maybeSingle()`.
   Returns the latest valid row or "not found"/"rejected".
2. **`writeSnapshot(input)`**:
   `.insert(row).select(cols).single()`. Refuses unless
   `manualConfirmation: true`, live auth session matches owner,
   and `localStorage` signature unchanged during the call.

No `update`, no `delete`, no `upsert`, no RPC. Concurrency is
inferred client-side from
`(latest source_snapshot_hash) vs (local syncedAppDataHash)`.

### 3.6 Companion local receipt (web stores in localStorage)

`CloudSyncFlowPersistedState` envelope:

- `syncedAppDataHash` — hash of last successful upload. The
  V4/V5 `expectedPreviousHash` cursor.
- `syncedOwnerUserId` — guards against account-switch reuse.
- `syncedAt` — diagnostic.

iOS needs an equivalent (Agent 3 owns the store). From this agent's
standpoint these three fields are part of the wire-adjacent contract
because the upload flow refuses to run without them.

---

## 4. iOS auth strategy

### 4.1 Recommendation

**Use the official Supabase Swift SDK (`supabase-swift`).** Do not
hand-roll a REST/GoTrue client.

### 4.2 Rationale

- The web flow already relies on GoTrue session management
  (PKCE/implicit OAuth, token refresh, sign-out `scope: 'local'`).
  Re-implementing in Swift is a per-bug security risk for no win.
- The only two operations against the table are PostgREST
  `select.maybeSingle` and `insert.single`; the Swift SDK exposes
  both with the same semantics.
- RLS uses `auth.uid()`. The Swift SDK forwards the GoTrue access
  token automatically; a custom client would have to track refresh
  and rotation manually.
- Token storage: the Swift SDK supports a Keychain-backed
  `SupabaseLocalStorage`. iOS V1 must opt into that explicitly.
  `UserDefaults` is unacceptable.
- The web emergency-local-mode contract
  (`authFailureEmergencyLocalMode.ts:43-61`) translates 1:1 to
  Swift: any auth failure routes to "stay local, do not delete
  data, never accept fake success".

If the Supabase Swift SDK is later judged unsuitable (build pipeline
constraints, version-pin pain), we can defer the SDK choice. The
wire contract in §3 does **not** depend on the SDK; it depends on
PostgREST + GoTrue.

### 4.3 Non-goals for iOS V1 auth

- **No Sign in with Apple yet.** Web uses email/password against
  GoTrue. iOS V1 ships the same. SIWA can be added later as a
  second provider on the same project without changing the
  snapshot contract.
- **No Magic Link / OTP** (web doesn't have it).
- **No anonymous auth.** The whole contract is gated on
  `owner_user_id = auth.uid()`. Anonymous = unreadable after
  reinstall.
- **No background session refresh that pulls data.** Token
  refresh via the SDK is fine. Using a refreshed token to *sync*
  in `applicationDidEnterBackground` / `BGTaskScheduler` / silent
  push is forbidden (§9).
- **No service-role key in the iOS bundle.** Static check must
  fail the build on any literal that looks like a service-role JWT.

### 4.4 Auth state contract (mirror of `authSessionBoundary.ts`)

`disabled`, `unauthenticated`, `authenticated-candidate`, `expired`,
`provider-unavailable`. The local AppData store **must remain
intact** in all five states.

---

## 5. iOS first-upload contract

The web first-upload sequence (Phase 21A → 21F) is over-engineered
for what iOS needs. The behaviour that *must* be preserved:

### 5.1 Preconditions (before the "上传到云端" button is enabled)

Mirror of `explicitOptInSyncPreflight.ts` + V3 eligibility guard:

1. Auth: `authenticated-candidate` session with `user.id`.
2. Local integrity (Agent 3):
   `ensureCloudUploadEligible({ appData, source: 'explicit-first-upload',
   snapshotKind: 'first-upload' })` returns `ok: true`. On any
   `pending_safe_repairs` / `backup_failed` / `partially_repaired` /
   `missing_repair_receipt` / `invalid_appdata`, surface the safe
   passive line and **do not enable the button**.
3. Runtime boundary: `liveCloudSyncActivated`, `cloudPrimaryEnabled`,
   `defaultSyncEnabled`, `backgroundWorkEnabled`,
   `sourceOfTruthChanged`, `localStorageDeleted` all `false`
   (`liveCloudSyncActivationAuthorizationGate.ts:87-96`). The
   activation gate must refuse if any flips to `true`.
4. Local backup exists (Agent 3 owns the backup contract; for the
   sync flow, `backupAvailable === true` is required).

### 5.2 On explicit tap of "上传到云端"

1. **Read latest** via the gateway. `null` → first upload is safe.
   Existing row → not actually a first upload; route through the
   subsequent-upload flow (§6). Read failure → surface
   `cloud_unavailable`; do not write.
2. **Build the row**:
   - `id = newUUID()`.
   - `account_id = owner_user_id = auth.uid()`. They must agree.
   - `device_id = stableInstallationUUID()`; fall back to fresh UUID.
   - `local_owner_id = auth.uid().uuidString`.
   - `source_snapshot_hash = buildAppDataSnapshotHash(appData)` —
     same algorithm as web.
   - `schema_version = AppData.schemaVersion`.
   - `operation_id = newUUID()` (unique per attempt).
   - `app_data = validated AppData document`.
   - `validation_status = 'valid'`. Never write the other two values
     from the client.
3. **Insert** with `.insert(row).select(cols).single()`.
   - On success: persist receipt
     `{ syncedAppDataHash = source_snapshot_hash,
        syncedOwnerUserId = auth.uid(),
        syncedAt = response.created_at }`.
   - On failure: receipt unchanged. Surface the real Supabase error
     code in a diagnostic panel (`productionFullAcceptanceRuntime.ts:371-377`).
4. **No download, no apply, no local mutation.**
   `firstUploadExplicitApply.ts:105-115` sets
   `downloadPerformed: false`, `localDataChanged: false`,
   `autoApplied: false`. iOS contract identical.

### 5.3 First-upload must NOT

- Call `update` or `delete` on `cloud_appdata_snapshots`.
- Write any other table.
- Run a parity check that can override the local receipt on failure.
- Touch Keychain / UserDefaults outside the session + receipt slots.
- Log AppData payloads anywhere (OSLog, Crashlytics, telemetry).
  Hash and operation_id only.

---

## 6. iOS subsequent-upload contract

Mirror of `cloudSubsequentUploadFlow.ts:269-494`.

### 6.1 Inputs

```
appData            : validated, non-nil
accountId/ownerId  : both == auth.uid()
localSyncState     : { syncedAppDataHash, syncedOwnerUserId, syncedAt }
lastCloudSnapshot? : optional V4 legacy pre-read
gateway            : { readLatestSnapshot, writeSnapshot }   (mandatory)
allowAuditOnly     : default true
```

`readLatestSnapshot` is **mandatory** on iOS V1. The web build's
`gateway: null` no-op code path is not supported here.

### 6.2 Decision order (matches V5 doc step-by-step)

1. `appData == nil` → `invalid_appdata`. No I/O.
2. `syncedAppDataHash == nil` → `not_enabled`. Route to first-upload
   (§5).
3. `syncedOwnerUserId != nil && != ownerUserId` → `not_enabled`
   (account switch on this device). Refuse, prompt for explicit
   "重新首次同步".
4. **V5 fresh-read preflight (mandatory)**:
   `gateway.readLatestSnapshot({ accountId, ownerUserId })`.
   - Throw / `ok=false` → `remote_unavailable`. Do not write.
   - Returned hash ≠ `syncedAppDataHash` → `remote_changed`. Do
     not write. Route to conflict-resolution (§7).
5. `localHash == syncedAppDataHash` → `unchanged`. No write.
6. V4 legacy pre-read: if `lastCloudSnapshot` supplied and
   `sourceSnapshotHash != syncedAppDataHash` → `cloud_conflict`.
7. **V3 eligibility guard**:
   `ensureCloudUploadEligible({ ..., snapshotKind: 'subsequent-upload' })`.
   `!ok` → translate to matching V4 reason. No write.
8. Build the row exactly as §5.2 step 2 with fresh `operation_id`
   and `source_snapshot_hash = localHash`.
9. `gateway.writeSnapshot(...)`:
   - `ok: true` → update receipt; UI "已同步".
   - `ok: false` → `upload_failed`. Receipt unchanged.
   - throw → `cloud_unavailable`. Receipt unchanged.

### 6.3 Hard invariants

- **No `update`, no `delete`** in the gateway interface.
- **No silent retry-with-overwrite**: a failed upload must not
  retry with `expectedPreviousHash = null` to force-replace.
- **No receipt update on failure**: the local receipt only advances
  on successful write. Otherwise the next sync retries from the
  same baseline.
- **No Keychain/UserDefaults deletion as a sync side-effect.**
  Mirror of V5 "no `localStorage.removeItem`/`clear`".

### 6.4 Allowed passive UX (semantics — final copy is Agent 5's call)

From `cloudSubsequentUploadFlow.ts:106-159`. iOS may render these or
substitute iOS-appropriate copy; the *tone* (one of
`ok / busy / audit-pending / backup-failed`) must match.

| reason                  | passive line                              | tone           |
|-------------------------|-------------------------------------------|----------------|
| `uploaded`              | 已同步                                    | ok             |
| `unchanged`             | 无需同步                                  | ok             |
| `not_enabled`           | 尚未首次同步                              | audit-pending  |
| `pending_safe_repairs`  | 数据正在自动整理，请稍候再同步            | busy           |
| `backup_failed`         | 数据正在自动整理，请稍候再同步            | backup-failed  |
| `partially_repaired`    | 数据正在自动整理，请稍候再同步            | busy           |
| `missing_repair_receipt`| 数据正在自动整理，请稍候再同步            | busy           |
| `invalid_appdata`       | 同步暂缓，等待数据整理完成                | audit-pending  |
| `cloud_conflict`        | 同步发现云端有新内容，请稍后再试          | audit-pending  |
| `remote_changed`        | 云端有更新，请稍后同步                    | audit-pending  |
| `remote_unavailable`    | 同步暂时不可用，已保留本地数据            | backup-failed  |
| `cloud_unavailable`     | 同步暂时不可用，已保留本地数据            | backup-failed  |
| `upload_failed`         | 同步失败，本地数据已保留                  | backup-failed  |

No modal / alert / confirm allowed. Banner or inline row only.

---

## 7. iOS optimistic concurrency contract (V5 mirror)

Web V5 contract: `CLOUD_OPTIMISTIC_CONCURRENCY_V5.md`. iOS contract
is identical with one stricter rule: **fresh-read preflight is not
optional on iOS V1**.

### 7.1 Why V5 exists

`cloud_appdata_snapshots` is append-only. "Latest" =
`ORDER BY created_at DESC LIMIT 1` for a given owner. Concurrency
safety = "client guarantees the latest cloud hash equals its
expected-previous hash before appending". Two devices on the same
baseline: only one wins; the loser sees `remote_changed` on its
next fresh-read.

The window between V5's fresh-read and the `.insert` remains
non-atomic — see V5 §"Non-atomic residual race" and §10.1 below.

### 7.2 iOS contract

```
preconditions:
  expectedPreviousHash := localReceipt.syncedAppDataHash
  nextHash             := buildAppDataSnapshotHash(appData)
  REQUIRE expectedPreviousHash != nil
  REQUIRE nextHash != expectedPreviousHash      // else "unchanged"

fresh-read preflight (MANDATORY):
  fresh := gateway.readLatestSnapshot({ accountId, ownerUserId })
  REQUIRE fresh.ok == true                      // else "remote_unavailable"
  REQUIRE fresh.source_snapshot_hash == expectedPreviousHash
                                                // else "remote_changed"

V3 eligibility guard:
  REQUIRE ensureCloudUploadEligible(...).ok    // else translate

write:
  result := gateway.writeSnapshot({
    appData, expectedPreviousHash, nextSnapshotHash: nextHash,
    accountId, ownerUserId, nowIso, operationId, deviceId
  })
  result.ok      → update local receipt
  !result.ok     → "upload_failed", receipt unchanged
  throw          → "cloud_unavailable", receipt unchanged
```

### 7.3 V5 invariants that carry to iOS

- Does not delete cloud rows.
- Does not overwrite the local store on `remote_changed`.
- Does not mutate Supabase schema (append-only stays).
- Does not show modals.
- Does not retry the write with a different hash.
- Does not delete any session / receipt / AppData entry.

### 7.4 V6 escalation path

The Swift `writeSnapshot` signature should accept
`expectedPreviousHash` from day one (web V5 already does). When V6
ships as a Postgres RPC or Edge Function, the gateway swaps its
`.insert(...)` for a single RPC call without changing the calling
code (§10.1).

---

## 8. iOS conflict-handling contract (no silent overwrite)

Lives in `cloudSyncConflictDetection.ts:31-49` and re-asserted in
`REAL_IPHONE_SYNC_CLOUD_CONFLICT_V3.md`. Hard rule:
**`canAutoApply: false, manualResolutionRequired: true` — always.**

### 8.1 Conflict types

`detectCloudSyncConflict` returns one of 10:
`local_newer | cloud_newer | both_changed | owner_mismatch |
schema_mismatch | cloud_missing | local_missing |
backend_primary_mismatch | session_account_mismatch |
device_identity_mismatch`. iOS must preserve all 10.

### 8.2 Severities

| Severity   | When                                                                  | iOS V1 behaviour |
|------------|-----------------------------------------------------------------------|------------------|
| `blocking` | owner/schema/session/device mismatch, `local_missing`, `both_changed` | Refuse the write. Dedicated banner with explicit "用本地覆盖云端" button **OR** "查看后再决定" no-op. Default is no-op. |
| `warning`  | `local_newer` / `cloud_newer` / `cloud_missing`                       | Inline status; user must explicitly choose. |
| `info`     | `both_changed` with no other evidence                                 | Same as warning. |

### 8.3 Override semantics (V3 web fix carries over)

1. **Single "用本地覆盖云端" button**, runs subsequent-upload with
   `overrideExistingCloudSnapshot: true` that bypasses the
   read-mirror review **only** for soft `cloud_data_invalid`. Hard
   blockers (`owner_mismatch`, `schema_invalid`) are not
   overridable; the button must not appear in those states.
2. **The toggle never silently flips during a conflict.** Mirror of
   V3 web pattern — the "云同步" affordance stays at "未开启"
   until the conflict is resolved. Never auto-flip on override
   success.

### 8.4 What conflict handling must NOT do

- No automatic last-write-wins reconciliation.
- No three-way jsonb merge.
- No background-thread conflict resolver.
- No silent retry on `cloud_unavailable` / `remote_unavailable`.
- No `UIAlertController` modal. The V3 banner pattern is the right
  primitive.

---

## 9. Strict non-goals for iOS V1

Each item below is the user's explicit forbiddance, also asserted by
at least one static test or invariant flag on the web side. iOS must
inherit the same invariants.

### 9.1 No background sync

- No `BGTaskScheduler` / `BGAppRefreshTask` / `BGProcessingTask`
  registration for cloud sync.
- No silent push (`content-available: 1`) triggering a sync.
- No `URLSession` background config for snapshot uploads.
- No `applicationDidEnterBackground` / `applicationDidBecomeActive`
  hook that schedules an upload or pulls.
- No `Combine` / `AsyncSequence` timer polling cloud state.

Web-side anchor: every result type carries
`backgroundWorkEnabled: false` as a literal;
`liveCloudSyncActivationAuthorizationGate.ts:201-205` blocks on
`background_work_enabled`.

### 9.2 No cloud-primary / default sync

- Local AppData store (Agent 3) remains source of truth at all
  times. Cloud is a **write target**; reads exist for diagnostics
  and conflict detection only — never to overwrite local.
- No "cloud-first" boot mode that fetches and applies before the
  user can train.
- No "default-on" sync toggle. Toggle defaults OFF on a fresh
  install and stays OFF until explicit user opt-in.

Web anchor: `cloudPrimaryEnabled: false`, `defaultSyncEnabled:
false` literals on every result.

### 9.3 No silent overwrite

- No cloud write without an explicit user tap.
- No local rewrite because cloud says so. The "用本地覆盖云端"
  override writes *to* cloud only. Pull-and-apply does not ship
  in V1.
- No auto-resolve of a conflict by picking newer/older.

Web anchor: `cloudPushCandidate.ts:35-43` has `noFakeSuccess: true`,
refuses on `cloudConflictDetected: true` without manual
confirmation. `cloudPullCandidate.ts:42-51` returns `applied: false`
on every code path.

### 9.4 No partially-repaired AppData upload

- Every upload (first or subsequent) must call the V3 eligibility
  guard. `ok === false` → safe passive line, do not invoke gateway.
- Rule is independent of UI state. Second tap re-runs the guard.

Web anchor:
`cloudUploadEligibilityEnforcementStatic.test.ts` fails CI if a new
production caller imports the orchestrator without also importing
`ensureCloudUploadEligible`. iOS V1 needs an equivalent static
check before first release.

### 9.5 No multi-device live mirror

- Schema supports multiple `device_id`s on the same `account_id`,
  but iOS V1 ships **no** live-mirror:
  - No real-time Postgres subscription.
  - No periodic poll.
  - No conflict-merge UI for simultaneous writes — only the V5
    fresh-read + manual override path.
- Two-device users will detect each other via `remote_changed` at
  the next manual sync. Acceptable for V1; **not** "live
  multi-device".

### 9.6 No service-role keys in the bundle

- iOS bundle contains at most the project URL and the anon key.
- Build-phase script should fail on any literal that looks like a
  service-role JWT.

### 9.7 No local-data deletion as a sync side-effect

- The iOS local AppData store (Agent 3) must never be deleted as a
  result of a sync operation. Not on auth failure, not on conflict,
  not on `remote_changed`, not on `upload_failed`, not on sign-out.
- Sign-out only clears the GoTrue session (Keychain entry for the
  Supabase session, equivalent of `signOut({ scope: 'local' })`).

Web anchor: every result type has `localStorageDeleted: false` and
`sourceOfTruthChanged: false` literals;
`authFailureEmergencyLocalMode.ts:34-41` carries
`localDataDeleted: false`, `cloudDataOverwritten: false`.

### 9.8 No modal alerts on sync failure

- Inline / banner / passive UX only. No `UIAlertController.alert`
  with "同步失败".
- Web V5 §"Data safety": "No modal, confirm, alert, or prompt."
  Carries to iOS.

---

## 10. Server-side / RPC work still required before iOS sync ships

These gaps exist today on Supabase. None block single-device iOS V1.
All block "two devices stay in sync" honestly.

### 10.1 V6 server-side compare-and-insert (OPEN)

**Status: design exists, no SQL written.**
**Source:** `CLOUD_OPTIMISTIC_CONCURRENCY_V5_PLAN.md` §8.

Three candidate designs:
1. Postgres function `cloud_appdata_snapshot_compare_and_insert`
   using `SELECT ... FOR UPDATE` + expected-previous-hash check.
   Most expressive; one extra RPC round trip.
2. Unique partial index `(account_id, source_snapshot_hash)` +
   `ON CONFLICT DO NOTHING`. Cheaper, less informative.
3. Explicit `expected_previous_snapshot_hash` column + RPC
   `INSERT ... WHERE current_latest_hash = expected`. Adds schema;
   cleanest.

**iOS impact:** without V6, V5's fresh-read leaves a non-atomic
window between read and `.insert`. A pathological two-device race
can still produce a stale append. Single-device iOS V1 never fires
this. Multi-device support must wait on V6.

**Recommendation:** do not block iOS V1 on V6. Do not advertise
multi-device sync until V6 lands. The Swift `writeSnapshot` should
already accept `expectedPreviousHash` so the switch is a one-line
gateway swap.

### 10.2 RLS `update` + `delete` policies (deliberately missing)

**Status: deliberately absent.**
**Source:** `supabaseDataModelRlsContract.ts:30` —
`delete_policy_not_blocked` is a *blocking* error.

Migration only creates `select` + `insert` policies. Append-only,
never delete. Consequences:
- `cloud_export_delete_requests` lifecycle is reserved but unused.
  "Delete my cloud data" (GDPR / user request) needs a lifecycle
  design before iOS can ship the button.
- No way to mark a snapshot superseded from the client. Changing
  `validation_status` from `valid` to `invalid` after the fact is
  a manual Supabase Studio operation today.

**iOS impact:** iOS V1 cannot ship a "delete my cloud data"
button. "用本地覆盖云端" stays append-only — writes a new
superseding row; old rows accumulate forever. Acceptable for V1;
needs a delete-lifecycle task before scale.

### 10.3 `cloud_devices`, `cloud_conflicts`, `cloud_sync_operations` tables (modeled, not wired)

**Status: schema present, runtime path not wired.**

All three tables exist in the migration with full RLS but no client
code writes them. The web build manages conflicts entirely in UI
state and the `cloudOperationJournal` (`cloudOperationJournal.ts:20-32`)
is in-memory only.

**iOS impact:** iOS-side conflict log can be local-only. A
"audit log" / "this snapshot was written by 'iPhone 15 Pro' on
2026-05-20" feature can wait for the server-side journal to ship.
For V1, iOS writes `device_id = <stable installation UUID>` into
`cloud_appdata_snapshots` and ignores the other three tables.

### 10.4 Other deployment / runbook items (not code)

- **Project URL + anon key distribution.** Web validates via
  `supabaseEnvironmentProjectGuard.ts` (https://-only, .supabase.co
  suffix, anon key non-empty, `cloudEnvironment === 'production'`).
  iOS needs the equivalent validation at startup (Info.plist or
  compiled constants).
- **Auth redirect URL allowlist.** iOS V1 email/password sign-in
  needs no redirect URL. Password-reset / email-confirm will need
  Universal Link or custom scheme registered in the Supabase Auth
  dashboard. Coordinate with web — they share the allowlist.
- **Rate limiting.** No per-account insert rate limit exists.
  Acceptable for manual iOS V1; mandatory before any auto-sync.
- **Schema version drift.** `schema_version` has no DB CHECK on
  accepted values. iOS must refuse a row with
  `schema_version > local_schema_version` (mirror of
  `cloudPullCandidate.ts:124-129` returning `schema_mismatch` with
  `requiresManualConfirmation: true`). AppData schema migrations
  must be coordinated across iOS + web releases.

---

## 11. Risks

1. **Hash algorithm parity.** FNV-1a 32-bit over `stableStringify`.
   Any divergence (key ordering, number formatting, optional
   field omission) means iOS and web see *different* hashes for
   *identical* AppData; every iOS upload after a web upload
   surfaces `remote_changed`. **Mitigation:** golden test vectors
   (JSON input → expected hex hash) checked into the repo and
   runnable on both runtimes.
2. **GoTrue token storage choice.** `UserDefaults` would leak tokens
   to backups and other processes. **Mitigation:** Keychain via
   `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`; verified on
   first launch.
3. **Auth redirect URL drift between iOS and web** (shared Supabase
   allowlist). **Mitigation:** deployment runbook step.
4. **V5 fresh-read race window.** Even with mandatory fresh-read,
   the read→insert window is non-atomic. **Mitigation:** ship V6
   before publicly supporting multi-device; advertise single-device
   only until then.
5. **RLS regression risk.** `account_id = owner_user_id = auth.uid()`
   is enforced by RLS, DB CHECK, and the client gateway. A future
   schema change (team accounts) needs a careful migration.
   **Mitigation:** Swift exposes a single `userId: UUID`; the
   gateway sets `account_id = owner_user_id = userId` internally.
   Never plumb them as separate parameters that could differ.
6. **Diagnostic leak risk.** V3 sanitised `lastSyncStatus` /
   `overrideButtonShown` via a whitelist
   (`tests/cloudSyncDiagnostic.test.ts`). The Swift diagnostic
   surface must apply the same whitelist; never echo a free-form
   Supabase error string. **Mitigation:** lift whitelist constants
   + sanitiser into a shared spec consumed by both runtimes.
7. **Per-account local data segregation.** The local receipt is
   per-`auth.uid()`. Sign-out / sign-in as a different account
   must present a different local-data namespace, not inherit the
   previous account's training data. Agent 3 owns the store
   contract; from Agent 4's standpoint the sync flow already
   refuses to upload when `syncedOwnerUserId != ownerUserId`
   (§6.2 step 3).

---

## 12. Open questions

1. **Universal Link vs custom URL scheme for password reset?**
   Universal Links preferred (no "open in app?" prompt). Confirm
   Supabase dashboard allowlist + Apple App-Site-Association
   workflow. Defer to Agent 5 / deployment.

2. **Supabase Swift SDK version pin?** SDK has had breaking changes
   between minor versions. Choice must align with the iOS SDK
   build pipeline. Not Agent 4's scope.

3. **Multi-device support, when?** Schema supports it; contract
   refuses live mirror; user has forbidden background sync. V1
   experience = "both devices manually sync, one wins, other sees
   `remote_changed` and resolves manually." Confirm with user this
   is the V1 experience they want.

4. **iOS conflict-resolution UI shape?** Agent 5 owns. From this
   agent: a banner with explicit override button (V3 web pattern),
   no-op "稍后再决定" is also valid, toggle stays off during the
   conflict.

5. **Surface real Supabase error code on `upload_failed`?**
   `productionFullAcceptanceRuntime.ts:371-377` plumbs the
   Supabase error code through to the diagnostic panel
   intentionally. iOS users have even less debugging surface.
   Recommend keeping the same plumbing into a collapsible
   diagnostic panel. UI choice — Agent 5.

6. **Operation-ID generation on retry?** DB enforces uniqueness on
   `operation_id`. A retry must use a fresh UUID — reusing the same
   id on a row that actually landed silently would 409 against the
   unique index.

7. **Sign-out semantics?** Web uses `signOut({ scope: 'local' })`.
   iOS must do the same. **Do not** pass `scope: 'global'` from
   iOS V1 — that would log out other devices the user is signed in
   on.

8. **Receipt migration from web → iOS for the same account.** A
   user syncing from web then installing iOS has no local receipt.
   The contract correctly says "fall through to first-upload" — but
   first-upload then sees the cloud row already exists and routes
   through the subsequent-upload conflict path. Right behaviour;
   needs a UX walkthrough with Agent 5 so users don't see "尚未
   首次同步" while a cloud row exists.

9. **Edge function escape hatch for V6?** If V6 ships as a Supabase
   Edge Function (Deno) rather than a Postgres RPC, the iOS
   `writeSnapshot` becomes `POST /functions/v1/<name>` against a
   different bearer. Current Swift API should accept that as a
   strategy swap; flagging now.

---

## Appendix A — Cross-references

| Web doc                                                      | iOS section |
|--------------------------------------------------------------|-------------|
| `CLOUD_APPDATA_DATA_MODEL_STRATEGY.md`                       | §3          |
| `SUPABASE_DATA_MODEL_RLS_CONTRACT.md`                        | §3.3        |
| `SUPABASE_MIGRATIONS_LOCAL_TYPE_CONTRACTS.md`                | §3.2        |
| `CLOUD_UPLOAD_ELIGIBILITY_ENFORCEMENT_V3.md`                 | §6.2 step 7 |
| `CLOUD_SUBSEQUENT_UPLOAD_FLOW_V4.md`                         | §6          |
| `CLOUD_OPTIMISTIC_CONCURRENCY_V5.md` + plan                  | §7          |
| `CLOUD_SYNC_CONFLICT_RESOLUTION_ARCHITECTURE_GATE.md`        | §8          |
| `CLOUD_READ_WRITE_VERIFICATION_FLOW.md`                      | §5          |
| `LIVE_CLOUD_SYNC_ACTIVATION_AUTHORIZATION_GATE.md`           | §5.1, §9    |
| `REAL_IPHONE_SYNC_CLOUD_CONFLICT_V3.md`                      | §8.3        |
| `CLOUD_SYNC_DISABLED_SKELETON.md`                            | §9          |
| `PHASE10_PRODUCTION_AUTH_CLOUD_SYNC_DEPLOYMENT_ENTRY_GATE.md`| §9          |

## Appendix B — Swift-side gateway signature (illustrative)

iOS Agent 7 owns the actual Swift API. Provided so §3, §6, §7 are
concrete.

```swift
public struct CloudSnapshotMetadata {
    public let sourceSnapshotHash: String
    public let cloudAppDataHash: String?
    public let createdAt: Date?
}

public struct LocalSyncReceipt {
    public let syncedAppDataHash: String
    public let syncedOwnerUserId: UUID
    public let syncedAt: Date?
}

public enum SubsequentUploadReason {
    case uploaded, unchanged, notEnabled, pendingSafeRepairs
    case backupFailed, partiallyRepaired, missingRepairReceipt
    case invalidAppData, cloudConflict, remoteChanged, remoteUnavailable
    case missingExpectedPreviousSnapshot, cloudUnavailable, uploadFailed, unknown
}

public protocol CloudSyncGateway {
    // V5: MANDATORY on iOS. Contract refuses to write without it.
    func readLatestSnapshot(
        accountId: UUID,
        ownerUserId: UUID
    ) async throws -> CloudSnapshotMetadata?

    // expectedPreviousHash plumbed through for a future V6 swap.
    func writeSnapshot(
        appData: AppData,
        expectedPreviousHash: String?,
        nextSnapshotHash: String,
        accountId: UUID,
        ownerUserId: UUID,
        deviceId: UUID,
        operationId: UUID,
        nowIso: String
    ) async throws -> CloudSnapshotMetadata
}
```

No `update`, no `delete`, no `upsert`, no batch — by design.

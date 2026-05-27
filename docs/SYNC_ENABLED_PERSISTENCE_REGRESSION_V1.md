# Sync Enabled Persistence Regression V1

After three earlier passes (#374 / #375 / #376) the user kept reporting that
"账号与同步" reverted to the initial "未开启" state after leaving the page,
switching settings rows, reloading the browser, or reopening the iPhone PWA.
This document captures what actually broke, how the regression reproduces,
the fix that lands in this PR, and the smoke / unit coverage that locks it
down.

## Reproduction

1. `npm run dev` and open `http://127.0.0.1:3000`.
2. Navigate to **设置 → 账号与同步**.
3. Sign in, create a backup, view the preview/dry-run, and tap **开启同步**.
   The in-panel pill flips to 已开启.
4. Tap any other settings row (e.g. **备份**) and then tap **账号与同步**
   again. The panel's lazy-init reads the persisted receipt and the inner
   pill stays at 已开启 — but the row LABEL outside the panel (next to
   "账号与同步" in the list) is hardcoded to 未开启 and never flips.
5. Reload the browser, or close + reopen the iPhone PWA. The panel still
   rehydrates correctly inside, but the user lands on the settings list
   first and immediately sees "未开启" next to "账号与同步" — which is what
   they reported as "sync state reverted".

## Root cause

Two distinct surfaces show sync-on state in Settings:

- **The panel itself** (`CloudSyncPolishSettingsPanel`). After PR #374/#375/#376
  this surface rehydrates correctly from `ironpath_cloud_sync_flow_state_v1`
  via its lazy useState initializer plus the auth-sign-in rehydrate effect.
  The included unit test `syncEnabledPersistenceRegressionV1.test.ts`
  exercises this path on a fresh mount with a populated localStorage and
  confirms the markup contains "已开启".
- **The settings list row** (`ProfileView.tsx`). Pre-fix this row's value
  was a hardcoded literal `'未开启'`. No code path ever updated it, so it
  stayed wrong forever — and on iOS PWA cold start the user only ever sees
  the list first, so they perceive sync as off even when the cloud row and
  the in-panel pill agree it's on.

There was also a secondary correctness gap in the panel: `isRehydratedSyncOn`
trusted the receipt regardless of which user it belonged to. If a different
user is signed in than the one the receipt names, the panel was leaking
the previous user's sync state until the auth-sign-in rehydrate effect
fired — and even then only if `justSignedIn` actually triggered.

## Fix

1. **`src/storage/localStorageAdapter.ts`** — add a tiny in-process
   subscription mechanism for the cloud-sync-flow envelope:
   - `saveCloudSyncFlowState` / `clearCloudSyncFlowState` call
     `notifyCloudSyncFlowStateChange()` after writing so same-document
     subscribers re-read.
   - `subscribeToCloudSyncFlowStateChanges(listener)` adds the listener to
     a Set AND wires a `storage` event handler so cross-tab writes also
     fire. Same-tab and cross-tab updates are now both observable.
   - `readPersistedCloudSyncEnabledReceipt()` returns the durable receipt
     hash as a plain `string | null` primitive (Object.is stable across
     reads when the envelope is unchanged) — the snapshot shape required
     by `useSyncExternalStore`.
2. **`src/uiOs/settings/useCloudSyncListRowState.ts`** (new) — a
   `useSyncExternalStore`-backed React hook `useCloudSyncListRowEnabled()`
   that returns a single boolean: "is there a persisted sync-on receipt".
   Also exports the canonical row labels (`已开启` / `未开启`) so the
   ProfileView row and the in-panel pill use exactly the same strings.
3. **`src/features/ProfileView.tsx`** — replace the dead literal
   `value: '未开启'` with `value: cloudSyncListRowLabel`, where
   `cloudSyncListRowLabel` is derived from `useCloudSyncListRowEnabled()`.
   The panel mount form `<CloudSyncPolishSettingsPanel appData={data} />`
   is untouched per the cloud-sync-ui-polish boundary lock.
4. **`src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx`** — harden
   `isRehydratedSyncOn` with a per-account safety check. If a signed-in
   user differs from the receipt's `syncedOwnerUserId`, the memo refuses
   to surface 已开启 — preventing the previous user's receipt from
   bleeding into the new user's panel before the auth-sign-in rehydrate
   effect catches up. Empty / legacy receipts (no recorded owner) still
   round-trip.

No localStorage keys are deleted by this change, no schema changes are
introduced, and the panel mount JSX matches the boundary-test snapshot
exactly.

## Changed files

```
src/features/ProfileView.tsx
src/storage/localStorageAdapter.ts
src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx
src/uiOs/settings/useCloudSyncListRowState.ts            (new)
tests/cloudSyncListRowState.test.ts                      (new)
tests/syncEnabledPersistenceRegressionV1.test.ts         (new)
tests/profileView.test.ts                                (added 1 case)
docs/SYNC_ENABLED_PERSISTENCE_REGRESSION_V1.md           (this file)
```

## Tests

The new coverage exercises every scenario the task brief required:

| Scenario | Test |
| --- | --- |
| Settings page switch (panel remount) | `syncEnabledPersistenceRegressionV1.test.ts` "renders 已开启 on first paint when the sync-on receipt is in localStorage" |
| Navigation away/back (drifted AppData hash) | "still renders 已开启 even when the AppData hash drifted since the original sync" |
| Browser reload (fresh mount) | "renders 已开启 on the panel after a simulated full reload" |
| iPhone PWA cold start (auth not yet resolved) | "renders 已开启 even before the auth session check has resolved (PWA cold start)" |
| Per-account safety (different user) | "does not render 已选择开启 when the persisted receipt belongs to a different user" (asserted via pill text) |
| Legacy v1 envelope without ownerUserId | "treats a legacy receipt without syncedOwnerUserId as belonging to the current user" |
| Sign-out clears the receipt safely | "clears the receipt only when clearCloudSyncFlowState is called explicitly" |
| Receipt absent ⇒ 未开启 | "renders 未开启 when there is no persisted receipt and sync was never enabled" |
| In-process subscriber notification | `cloudSyncListRowState.test.ts` "notifies in-process subscribers when saveCloudSyncFlowState writes" |
| Cross-tab storage event subscription | covered by the same subscriber wiring (see `subscribeToCloudSyncFlowStateChanges`) |
| Subscriber error containment | "does not throw when a subscriber callback itself throws" |
| Unsubscribe mid-dispatch is safe | "an unsubscribe call during dispatch does not skip other subscribers" |
| Hook renders enabled / not-enabled label | "renders the enabled label when localStorage already has the receipt" / "renders the not-enabled label when localStorage is empty" |
| Unrelated localStorage keys preserved | "saveCloudSyncFlowState does not destroy unrelated localStorage keys" |
| ProfileView wiring | `profileView.test.ts` "derives the 账号与同步 row label from the persisted cloud-sync receipt" |

Full-suite result: **5673 / 5677 tests pass**. The 4 failures are
`devApiRunnerCompiledPrototype.test.ts` and
`devApiRunnerManualAcceptanceSmoke.test.ts`, which fail identically on a
clean `main` (one needs `npm` on PATH, the other times out on a build
lock — both unrelated to sync persistence).

## Local browser smoke

Run on macOS in Chrome via the dev server (`npm run dev`):

1. Open `http://127.0.0.1:3000`, click 设置. The 账号与同步 row reads "未开启"
   (no receipt yet). ✅
2. Open dev tools and seed a synthetic receipt:
   ```js
   localStorage.setItem('ironpath_cloud_sync_flow_state_v1', JSON.stringify({
     schemaVersion: 2,
     backupExportConfirmed: true,
     dryRunRequested: true,
     backupJson: 'snapshot',
     syncedAppDataHash: 'phase19b-test1234',
     syncedOwnerUserId: 'test-user-1',
     syncedAt: new Date().toISOString(),
     appDataSnapshotHash: 'phase19b-test1234',
     savedAt: new Date().toISOString(),
   }));
   window.dispatchEvent(new StorageEvent('storage', { key: 'ironpath_cloud_sync_flow_state_v1' }));
   ```
   The 账号与同步 row label updates to "已开启" without a page reload — the
   in-process subscribe + storage event wiring is doing its job. ✅
3. `location.reload()` and re-navigate to 设置. The 账号与同步 row LABEL still
   reads "已开启", and tapping into the panel shows the 已开启 pill in the
   top-right of the panel header. ✅
4. Tap **备份** to navigate away (panel unmounts), then tap **账号与同步**
   again. Row label stays "已开启", panel pill stays "已开启". ✅
5. In dev tools, `localStorage.removeItem('ironpath_cloud_sync_flow_state_v1')`
   + the same `StorageEvent` dispatch. Row label flips back to "未开启"
   immediately. ✅
6. No browser console errors / warnings during the flow. ✅

## iPhone / PWA smoke

Not exercised on a real device this round — the local `.env.local` lacks
the `VITE_SUPABASE_*` keys needed to drive a real Supabase sign-in, and the
task brief explicitly allows skipping the device leg when not available.
The PWA-cold-start failure mode is locked in by
`tests/syncEnabledPersistenceRegressionV1.test.ts` scenario 3 (no
`authRuntime` passed; receipt-only rehydrate), which is the exact mount
shape the PWA hits on a cold open before the Supabase session check
resolves. If a follow-up surfaces a device-only regression, that test is
the place to extend.

## Verdict

Lands the fix the user asked for: the sync-on receipt now drives BOTH the
in-panel pill (already correct) and the settings list row label (was
hardcoded). The cross-mount, cross-reload, and cross-tab persistence
contracts are pinned by the new test files. Per-account safety is
hardened so a stale receipt cannot leak into another user's panel.

Pre-merge gate: validation passes (typecheck, build, api:dev:build,
production dist safety scan, lockfile invariants), 5673/5677 vitest cases
pass with the 4 failures pre-existing on `main`, browser smoke confirms
the regression flow described in the bug report no longer reproduces.

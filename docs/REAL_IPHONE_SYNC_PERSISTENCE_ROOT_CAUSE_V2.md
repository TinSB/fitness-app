# Real iPhone Sync Persistence Root Cause V2

PR #378 (V1) fixed the hardcoded `'未开启'` row label in `ProfileView.tsx`,
which solved the Chrome desktop reproduction. The user then reported that
**the bug reproduces identically on real iPhone PWA** — neither the panel
nor the row stays at 已开启 across a PWA close+reopen. V1's panel-side
rehydrate logic was already proven correct by unit tests and Chrome smoke,
so the V2 working theory is that one of the following is happening
**on the actual iPhone** but not in any of the local repro environments:

| Hypothesis | What we'd see | Where the diagnostic distinguishes it |
| --- | --- | --- |
| **H1. Stale service-worker bundle.** iPhone is still running pre-#378 / pre-#376 code because the v3 SW cache pinned the old chunk. | `build=` short-sha matches an OLD commit, not the deploy the user just pushed. | `data-cloud-sync-diagnostic-build-sha` attribute + the "构建 SHA" row. |
| **H2. iOS purged localStorage.** ITP / 7-day inactivity / quota eviction wiped the cloud-sync-flow envelope. | `receipt?=否` after PWA reopen even though the user enabled sync minutes earlier. | "本地凭据" row + the formatted snapshot's `receipt?=` field. |
| **H3. Per-account gate mis-rejects.** Supabase returns a different `userId` on iPhone than on the desktop where the receipt was written; the V1 per-account check then refuses to surface 已开启. | `ownerMatch=否`, with the two short hashes visible side-by-side. | "凭据账号 hash" vs "当前账号 hash" rows; `ownerMatch` field. |
| **H4. Auth-loading misclassified as "not enabled".** Cold-start renders 未开启 momentarily while `check_session` is still in flight, even though the receipt is present. | `authReady=否` + `receipt?=是` + `ui=checking` (after V2) instead of `ui=not-enabled` (before V2). | "UI 状态" row + `ui=` field; new `checking` classification in `cloudSyncDiagnostic.ts`. |
| **H5. Cloud read-back unreachable.** Supabase responds with a transient 5xx or RLS-denied read, so even though localStorage has the receipt, the runtime won't show enabled. | `cloudReadOk=否`. | "云端读检 OK" row. |

## What V2 ships

This branch lands **diagnostics + likely-cause hardening**, not a guaranteed
fix — the only thing that can confirm the actual root cause is a readback
from a real iPhone PWA. The changes are intentionally small so the next
iteration (if H2/H3/H4/H5 turns out to be the culprit) only has to add the
specific repair, not rewrite the surface.

1. **Diagnostic surface (`src/diagnostics/cloudSyncDiagnostic.ts` + `src/uiOs/settings/CloudSyncDiagnosticPanel.tsx`).** Collapsed pane at the bottom of Account & Sync. Always shows the build SHA + `state=` summary in the row; expanding reveals every safe boolean / short-hash the V2 investigation needs. Includes a "复制诊断" button for screenshot-free sharing. All values are safe — short FNV-1a fingerprints, no raw IDs, no tokens, no AppData. Tests in `tests/cloudSyncDiagnostic.test.ts` lock the safety contract end-to-end.
2. **Build SHA injection (`vite.config.ts` + `src/vite-env.d.ts`).** `define` injects `__IRONPATH_BUILD_SHA__` from `VERCEL_GIT_COMMIT_SHA` (production) or `git rev-parse --short HEAD` (local). Surfaces in the diagnostic so a glance at the iPhone proves which deploy it is running — addresses H1.
3. **Service-worker cache version bump (`public/sw.js`).** `ironpath-app-shell-v3` → `ironpath-app-shell-v4`. The `activate` event deletes the v3 cache, forcing iPhones still pinned to the old bundle to install + activate the new SW + reload (the existing main.tsx `controllerchange` hook handles the reload). Also tightened the `fetch` handler to skip caching non-2xx responses so a flaky cellular response can't pin a 5xx to disk and keep replaying it.
4. **"Checking" state in the diagnostic.** When `authReady=false` AND no receipt exists (`receipt?=否`), the diagnostic classifies as `ui=checking` with `reject=auth-loading` instead of `ui=not-enabled`. This is the V2 reading of the rule "Do not show 未开启 while state is unknown/loading". The user-facing panel pill is unchanged in this PR — surfacing checking-state in the live pill requires changes inside `src/cloudSync/SyncStatusCenter.tsx` that should land separately, only if the iPhone readback proves auth-loading is the real failure mode.
5. **Per-account safety hardening preserved from V1.** `isRehydratedSyncOn` still refuses to surface 已开启 when a different user is signed in than the one named in the receipt. The diagnostic exposes both fingerprints so we can verify the gate isn't false-positive rejecting on iPhone.

## Real iPhone reproduction — instructions for the next session

Once the V2 build is on Vercel and the user has opened the iPhone PWA:

1. Force-quit the PWA (swipe up).
2. Reopen the PWA. Settings → 账号与同步.
3. Tap the "同步诊断 · 展开" row.
4. Screenshot the snapshot, OR tap "复制诊断" and paste the line into the V2 PR thread.
5. Compare the `build=` short-sha to the head of the deploy branch (`git log --oneline -1` on the deployer's machine). If they don't match, H1 is confirmed and the next iteration is "force PWA to drop SW cache".
6. Sign in → 创建备份 → 检查 → 开启同步. Confirm `state=enabled` in the row.
7. Close the PWA. Reopen. Settings → 账号与同步.
8. Re-read the diagnostic. The `state=` value here is the root cause.

## Diagnostic values before / after — to be filled by the iPhone session

| Step | build | signedIn | authReady | receipt? | ownerHash | ownerMatch | ui | row | reject |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Right after enable | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |
| After PWA reopen | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |

(These rows are placeholders. Once the iPhone session runs, paste the
copy-to-clipboard line from each step verbatim. That replaces guessing
about the root cause with an actual readback.)

## Actual root cause

_Pending real-iPhone diagnostic readback. Will be filled in after the
mirrored-iPhone session. If the build SHA on the iPhone matches the deploy
and the receipt is present after reopen but `ui=not-enabled`, that
identifies a code bug we have not yet localized; otherwise the table above
tells us which of H1–H5 fired._

## Changed files

```
public/sw.js                                         (cache v3 → v4 + skip caching non-2xx)
src/diagnostics/cloudSyncDiagnostic.ts               (new — safe snapshot builder + fingerprinter)
src/uiOs/settings/CloudSyncDiagnosticPanel.tsx       (new — collapsible diagnostic pane)
src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx   (mount diagnostic + compute inputs)
src/vite-env.d.ts                                    (declare __IRONPATH_BUILD_*__ globals)
vite.config.ts                                       (inject build SHA + ISO via define)
tests/cloudSyncDiagnostic.test.ts                    (new — 12 cases locking snapshot contract)
tests/runtimeBoundaryTestHelpers.ts                  (add new files to dedicated coverage set)
docs/REAL_IPHONE_SYNC_PERSISTENCE_ROOT_CAUSE_V2.md   (this file)
```

## Tests

| Scenario | Test |
| --- | --- |
| Snapshot is "not-enabled" with reason "no-receipt" when storage empty + auth ready | `cloudSyncDiagnostic.test.ts` |
| Snapshot is "checking" with reason "auth-loading" when auth pending + no receipt | same |
| Snapshot is "enabled" with same-user receipt | same |
| Receipt present + auth still loading classifies as "checking" — never flashes 未开启 | same |
| Account mismatch classifies as "recovery" with reason "account-mismatch" | same |
| Last sync attempt failed classifies as "recovery" with reason "last-sync-failed" | same |
| Legacy envelope without ownerUserId is accepted | same |
| `formatCloudSyncDiagnosticSnapshot` produces one line, never leaks raw userId or full hash | same |
| Snapshot JSON contains no AppData / tokens / env values | same |
| `fingerprintUserId` is stable, 8-char hex, never the raw id | same |
| Diagnostic key is the same `CLOUD_SYNC_FLOW_STORAGE_KEY` the panel reads | same |
| Cloud read attempted/OK signals are surfaced separately | same |

Full suite: 5685 / 5689 pass. The 4 failures (`devApiRunnerCompiledPrototype.test.ts`, `devApiRunnerManualAcceptanceSmoke.test.ts`) reproduce identically on a clean `main` — pre-existing environment gaps (`npm` on PATH, build-lock timeout), unrelated to the sync diagnostic.

Validation: `npm run typecheck`, `npm run api:dev:build`, `npm run build`,
`node scripts/scan-production-dist-safety.mjs` (21 files, all safe),
package/lockfile diff empty, `pnpm-lock.yaml` absent.

## Local browser smoke

(macOS Chrome via `npm run dev`)

1. Open `http://127.0.0.1:3000` → 设置 → 账号与同步. The diagnostic row
   reads `build=<dev-sha> · state=not-enabled`. ✅
2. Tap "展开". Every row renders. "本地凭据 否", "鉴权就绪 是" (the dev
   build has no Supabase env so check_session immediately returns
   unauthenticated → authReady=true). "拒绝原因 no-receipt". ✅
3. In dev tools, seed the synthetic v2 envelope (same script as V1's smoke
   doc) + dispatch a `StorageEvent`. The diagnostic re-renders without a
   page reload: `state=enabled` collapsed, `本地凭据 是` + `凭据 hash`
   short value expanded. ✅
4. `localStorage.removeItem('ironpath_cloud_sync_flow_state_v1')` + storage
   event → flips back to `state=not-enabled`. ✅
5. No console errors / warnings. ✅

## iPhone PWA smoke result

_Pending — the user picked mirrored iPhone via QuickTime for verification.
Will be appended below verbatim once the deploy is live and the session
runs._

## Final verdict

_Pending iPhone session. Until then this PR is marked DO-NOT-MERGE: it
ships an investigative surface, not a confirmed fix. The next iteration on
this branch (or its successor) lands the targeted code change for whichever
of H1–H5 the iPhone diagnostic actually identifies._

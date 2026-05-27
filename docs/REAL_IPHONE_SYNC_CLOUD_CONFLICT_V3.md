# Real iPhone Sync Cloud Conflict V3

V2 ([cd63b67](https://github.com/anthropics/ironpath/commit/cd63b67),
[#379](https://github.com/anthropics/ironpath/pull/379)) shipped the
diagnostic surface that finally told us **what was actually going wrong on
the user's real iPhone PWA**. The V2 readback ruled out H1 (stale SW
cache), H2 (iOS storage purge), H3 (per-account gate), H4 (auth-loading
misclassification) and **confirmed H5: the cloud read-back returns a
non-OK status, so `runProductionFullAcceptanceSync` never reaches the
branch that writes the local-storage receipt.**

V2's actual readback:

```
build=cd63b67 · pwa=是 · signedIn=是 · authReady=是
userIdHash=6b8b4e13 · receipt?=否
cloudRead?=是 · cloudReadOk=否 · reject=last-sync-failed
```

The cloud read SUCCEEDED (`cloudRead?=是`); `cloudReadOk=否` is the
panel's "result.ok === false" mirror, not a network failure. The
underlying status — almost certainly `conflict_review_required`, because
the cloud row already exists with a different `source_snapshot_hash`
than the live local AppData — was hidden from the V2 diagnostic, so V2
could not distinguish "cloud has a different snapshot" from "cloud read
failed entirely" or "parity check failed after a successful write".

The user's perception ("sync shows enabled then reverts to 未开启") was
a misread of the existing two-step override copy: the message
"发现冲突，再次点开启同步以用本地覆盖云端" sat in the same warnings pill
as every other status string, attached to the same toggle. A re-tap on
the toggle looked like the toggle reverting itself, not an explicit
opt-in to overwrite. V2 left the override flow intact; the V1/V2 fixes
were correct on their own merits but did not address the user-facing
bug.

## Cloud-side investigation

The deliverable for V3 asked whether the fix is server-side (clear the
stale row in `cloud_appdata_snapshots` for `xuhaochen122@gmail.com` /
userId fingerprint `6b8b4e13`) or client-side (make the override flow
more discoverable).

This session has **no service-role access to Supabase** — `.env.local`
holds only the anon key, no `SUPABASE_SERVICE_ROLE_KEY` exists in the
environment, and no admin script in `scripts/` talks to Supabase
directly. The cloud row can only be cleared by the user themselves from
the Supabase Studio, and that's the wrong default fix anyway: if the
cloud row was written from a real device the user owns (another
browser, an old install), wiping it server-side would lose data
silently. **The legitimate way to resolve a hash-mismatch conflict from
the client is the existing override flow — V3 just makes that flow
visually impossible to miss.**

The most likely explanation for why this user's cloud row's hash does
not match the live local hash is the algorithm change from
[#372](https://github.com/anthropics/ironpath/pull/372) (`Fix iOS
parity_failed by making the hash deterministic`). The cloud row's
`source_snapshot_hash` was written with the pre-#372 sanitizer-roundtrip
algorithm; the local AppData now hashes with the post-#372
deterministic algorithm. Same data, different fingerprint. The
override flow (`overrideExistingCloudSnapshot=true`) is exactly the
right escape hatch for this case — it re-uploads the local AppData with
the current hash and the cloud row's hash converges back to match.

The override path itself has been working since
[#364](https://github.com/anthropics/ironpath/pull/364) (`Fix
second-click override path so '发现冲突' actually writes to cloud`).
What V3 changes is **discoverability**, **diagnostic granularity**, and
**lock-down of the override path's success contract via a test the
suite did not previously have**.

## What V3 ships

1. **Dedicated `用本地覆盖云端` banner with its own button.** The
   conflict_review_required state used to push "发现冲突，再次点开启
   同步以用本地覆盖云端" into `syncStatus.warnings`, where it rendered
   as a passive amber pill alongside other warnings. V3 routes the
   conflict through a new `cloudOverridePrompt` field on
   `SyncStatusCenterProps` instead. `CloudSyncSettingsSection` renders
   it as a distinct bordered banner directly beneath the toggle, with:

   - a title (`云端有不同的同步数据`),
   - body copy that explains both the safe option (do nothing) and the
     destructive option (overwrite cloud),
   - a separate `用本地覆盖云端` action button that runs the override
     when tapped,
   - a `不想覆盖可以放着不动，下次再决定` hint making the no-op
     alternative explicit.

   The toggle stays at "未开启 / 可开启" throughout — it never
   pretends sync is on while the override is pending. The action
   button shows `正在覆盖云端…` and disables itself while the override
   is in flight, so the user can tell the system is doing something.

2. **Override path only surfaces for soft conflicts.** Hard read-mirror
   blockers (`owner_mismatch`, `schema_invalid`,
   `cloud_data_invalid`) keep returning `conflict_review_required` but
   the override cannot help — the runtime safety check at
   `productionFullAcceptanceRuntime.ts:551–556` already enforces this
   server-side, and V3's panel now mirrors the rule client-side so a
   user can never see a button that does nothing.
   `CloudSyncPolishSettingsPanel` computes
   `cloudOverridePromptVisible` as
   `status === 'conflict_review_required' && !pending &&
   blockers.every(b => b === 'cloud_read_manual_review')`.

3. **`lastSyncStatus` and `overrideButtonShown` in the V2 diagnostic.**
   The V2 diagnostic exposed `cloudReadOk` which conflates "cloud read
   itself failed" with "cloud read returned a conflicting snapshot".
   V3 adds two new safe fields:

   - `lastSyncStatus`: the Phase21i status string (`accepted`,
     `conflict_review_required`, `parity_failed`, …). Sanitized to a
     whitelist so the diagnostic snapshot can never echo a free-form
     server-side string.
   - `overrideButtonShown`: whether the panel currently surfaces V3's
     override banner.

   These let the next iPhone readback distinguish "first click,
   waiting for override" from "override attempted, parity still
   failing" from "real cloud-read network failure" — three failure
   modes that all showed `cloudReadOk=否` in V2.

4. **Unit test locks the override happy path.** The runtime suite
   previously locked first-click `conflict_review_required` (no write)
   and `upload_failed` (write attempted, failed) but had no test for
   the override-success path. V3 adds
   `tests/productionFullAcceptanceRuntime.test.ts` cases that lock:

   - `overrideExistingCloudSnapshot=true` + cloud has a stale row with
     a different hash → status `accepted`, write count 1, fresh
     `source_snapshot_hash` matches local AppData.
   - `overrideExistingCloudSnapshot=true` + cloud has an owner mismatch
     → write is still refused (`ok=false`, write count 0). Hard
     blockers stay enforced regardless of the explicit override flag.

5. **Unit tests for the section + adapter.** New
   `tests/cloudSyncCloudOverridePromptV3.test.ts` locks the
   `CloudSyncSettingsSection` rendering contract:

   - banner renders with the right test ids when `cloudOverridePrompt`
     is set,
   - banner is absent when the prompt is null,
   - pending label `正在覆盖云端…` + disabled button when
     `isPending=true`,
   - adapter plumbs `cloudOverridePrompt` through to
     `syncStatus.cloudOverridePrompt` verbatim — visibility policy
     lives in the panel, not the adapter.

6. **Diagnostic test sanitizer.** `tests/cloudSyncDiagnostic.test.ts`
   gains two cases: one locks the
   `lastSyncStatus='conflict_review_required'` round-trip end-to-end;
   the other feeds a free-form string and verifies the snapshot drops
   it to `null` so the diagnostic line cannot leak a server-side
   payload.

What V3 does NOT do:

- **No server-side write.** No service-role access in this
  environment, no admin endpoint added. The fix is entirely
  client-side.
- **No silent override.** The override still requires an explicit tap
  on a button that says `用本地覆盖云端`. There is no "auto-resolve
  conflict" path.
- **No change to AppData / TrainingSession schema.** No
  pnpm-lock.yaml. No branch-protection bypass.

## Files changed

```
src/diagnostics/cloudSyncDiagnostic.ts               (+lastSyncStatus, +overrideButtonShown, +sanitizer)
src/uiOs/settings/CloudSyncDiagnosticPanel.tsx       (+ rows 上次状态 / 覆盖按钮)
src/cloudSync/SyncStatusCenter.tsx                   (+cloudOverridePrompt type, +export)
src/cloudSync/CloudSyncSettingsSection.tsx           (+ banner render before warnings)
src/cloudSync/index.ts                               (+SyncStatusCenterCloudOverridePrompt export)
src/uiOs/settings/cloudSyncRuntimeSettingsAdapter.ts (+pluming for cloudOverridePrompt)
src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx   (+ visibility logic, +diagnostic inputs,
                                                      removed duplicate 再次点开启同步 string)
tests/cloudSyncDiagnostic.test.ts                    (+2 cases: status round-trip + sanitizer)
tests/productionFullAcceptanceRuntime.test.ts        (+2 cases: soft override success + hard
                                                      override refused)
tests/cloudSyncCloudOverridePromptV3.test.ts         (new — 5 cases locking the banner contract)
docs/REAL_IPHONE_SYNC_CLOUD_CONFLICT_V3.md           (this file)
```

## Tests

| Scenario | Test |
| --- | --- |
| `overrideExistingCloudSnapshot=true` + stale-hash cloud row → status `accepted`, write count 1 | `productionFullAcceptanceRuntime.test.ts` |
| `overrideExistingCloudSnapshot=true` + hard blocker (owner mismatch) → ok=false, write count 0 | same |
| diagnostic exposes `lastSyncStatus='conflict_review_required'` and `overrideShown=true` | `cloudSyncDiagnostic.test.ts` |
| diagnostic sanitizer drops a free-form `lastSyncStatus` value to null | same |
| Section renders the override banner with title, body, action button, hint | `cloudSyncCloudOverridePromptV3.test.ts` |
| Section omits the banner when `cloudOverridePrompt=null` | same |
| Section shows `正在覆盖云端…` + disabled button when `isPending=true` | same |
| Adapter plumbs `cloudOverridePrompt` from input to `syncStatus.cloudOverridePrompt` verbatim | same |
| Adapter defaults `cloudOverridePrompt` to null when input does not provide one | same |

Full suite: **5698 / 5698 passing** (V2 baseline 5685 + 9 new V3 cases +
4 previously-flaky devApiRunner tests now green in this environment).

Validation: `npm run typecheck`, `npm run build`,
`node scripts/scan-production-dist-safety.mjs` (21 files scanned,
all safe), package/lockfile diff empty, `pnpm-lock.yaml` absent.

## Local browser smoke

(macOS Chrome via `npm run dev`, build SHA `87be1a9`)

1. Open `http://127.0.0.1:3000` → 设置 → 账号与同步. The diagnostic
   pane reads `build=87be1a9 · state=enabled` (from leftover dev
   localStorage). ✅
2. Tap 展开 on 同步诊断. Every row renders, including the two new V3
   rows:

   ```
   上次状态  —
   覆盖按钮  否
   ```

   Both correctly read as null/false because no sync attempt has been
   made in this dev session. ✅
3. No console errors / warnings. ✅
4. The override banner's render contract is locked by
   `cloudSyncCloudOverridePromptV3.test.ts` — Chrome cannot reach
   `conflict_review_required` in dev because the dev env has no
   Supabase, so the banner cannot be visually exercised locally. The
   real iPhone PWA readback is the only proof of the user-facing flow.

## Real iPhone PWA reproduction — instructions for the verifier

Once the V3 build is on Vercel and the user has opened the iPhone PWA:

1. Force-quit the PWA (swipe up).
2. Reopen the PWA. Settings → 账号与同步.
3. Confirm the diagnostic shows `build=<V3-sha>` (must match the V3
   deploy commit) and `signedIn=是 / receipt?=否` (the V2 reproduction
   state).
4. Look at the screen: there must be an amber bordered banner under
   the 云同步 toggle that says `云端有不同的同步数据` with a
   `用本地覆盖云端` button. The banner is the V3 user-facing change.
   - If the banner is missing, V3 did not deploy correctly — re-check
     the build SHA in the diagnostic.
5. Tap `用本地覆盖云端`. The button changes to `正在覆盖云端…` and
   disables.
6. After the override completes, the toggle should flip to `已开启`,
   the banner should disappear, and the diagnostic should now read
   `lastStatus=accepted`, `receipt?=是`, `receiptHash=phase19b-…` (a
   real fingerprint, not `(none)`).
7. Force-quit the PWA. Reopen.
8. Settings → 账号与同步.
9. Expand the diagnostic. **The single acceptance criterion is**:

   ```
   receipt?=是
   ui=enabled       (or `ui=checking` momentarily, then enabled)
   row=已开启
   lastStatus=accepted   (sticky from the override attempt's React state — may
                          be missing if the panel just mounted with no in-mount
                          attempt; receipt?=是 is the load-bearing field here)
   ```

10. Tap 复制诊断 and paste the line into the V3 PR thread.

## Do NOT merge until

The V3 PR (`Real iPhone Sync Cloud Conflict V3`) must remain **unmerged
until the real iPhone PWA readback after a force-quit + reopen cycle
shows `receipt?=是` AND `ui=enabled` (or `row=已开启`)**. Chrome smoke
and unit tests cannot prove the fix; only the iPhone readback can,
because the V2 root cause was iPhone-only.

If the iPhone readback after V3 still shows `receipt?=否`, the V3
fixes are not sufficient and a V4 iteration is needed — most likely
investigating whether the override write itself is hitting a Supabase
RLS or schema problem on the user's row, which would surface as
`lastStatus=upload_failed` or `lastStatus=parity_failed` in the V3
diagnostic instead of `accepted`. The V3 diagnostic is the channel
that distinguishes those follow-up hypotheses.

## Iphone readback after V3 — to be filled in

Once the verifier completes the steps above, paste the diagnostic line
below.

```
(pending: V3 PR open, awaiting real-iPhone verification)
```

## Final verdict — to be filled in

(pending: V3 PR open, awaiting real-iPhone verification)

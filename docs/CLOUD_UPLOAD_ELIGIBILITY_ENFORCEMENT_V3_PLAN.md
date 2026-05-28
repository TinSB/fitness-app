# Cloud Upload Eligibility Enforcement V3 — Design Plan

Status: draft, implementation in this PR
Branch: `claude/cloud-upload-eligibility-enforcement-v3`
V2 baseline: [DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md](DATA_HEALTH_CLOUD_RESTORE_LINKAGE_V2.md)
V1 baseline: [REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md](REAL_DATA_HEALTH_REPAIR_SYSTEM_V1.md)
Policy: [DATA_REPAIR_POLICY.md](DATA_REPAIR_POLICY.md)

## 1. Executive summary

V2 introduced `evaluateCloudUploadEligibility` and wired the data-health ingress pipeline into every AppData ingress site. V2 did NOT make eligibility a mandatory precondition for cloud upload. The current Supabase write surface still depends on caller discipline.

V3 makes eligibility a hard architectural contract:

- One central guard module exposes `ensureCloudUploadEligible(...)`. Every cloud upload path must call it. Cloud callers branch only on `guard.ok`.
- Static enforcement tests verify that any file importing the production upload entry points also imports the guard.
- The existing production upload candidate (`buildFirstUploadExplicitApply`) gains an optional `dataHealthEligibility` input + a new `data_health_eligibility_not_met` blocker. When callers supply the guard verdict the candidate refuses to write without it.
- The UI upload trigger in `CloudSyncPolishSettingsPanel.tsx` calls the guard before invoking `runProductionFullAcceptanceSync`. Blocked uploads surface a compact passive status — no modal, no fake success.

This is enforcement hardening, not new repair logic and not a UI redesign.

## 2. V2 remaining risk

- `evaluateCloudUploadEligibility` exists but is only consulted inside `processIncomingAppData` for reporting. No production upload path consults it before a write.
- `cloudPushCandidate`, `firstUploadExplicitApply`, and the `productionFullAcceptanceRuntime` orchestrator are boundary-locked. Their internal source cannot be freely edited.
- The actual Supabase write surface (`gateway.writeSnapshot` at `productionFullAcceptanceRuntime.ts:352`) checks manualConfirmation, schema, owner, runtime boundary — but does NOT check data-health eligibility.
- The UI handler (`CloudSyncPolishSettingsPanel.tsx`) hands raw `appData` to the orchestrator without an eligibility pre-check.
- No static test prevents a new code path from importing `runProductionFullAcceptanceSync` or `runCloudPushCandidate` without an eligibility guard.

## 3. Inventoried upload / cloud-write paths

| File | Symbol | Upload kind | Supabase op | V2 eligibility? | Boundary-locked? | V3 action |
|---|---|---|---|---|---|---|
| `src/cloudProduction/productionFullAcceptanceRuntime.ts` | `createSupabaseAppDataProductionGateway.writeSnapshot` | `cloud-snapshot-insert` | `.from('cloud_appdata_snapshots').insert(...)` | NO | YES | wire guard at caller; add static test |
| `src/cloudProduction/productionFullAcceptanceRuntime.ts` | `runProductionFullAcceptanceSync` | `production-acceptance-orchestrator` | (calls writeSnapshot) | NO | YES | accept `dataHealthEligibility` input via blocker pipeline; static test |
| `src/cloudProduction/firstUploadExplicitApply.ts` | `buildFirstUploadExplicitApply` | `explicit-first-upload` | (calls `writeRepository.writeCloudAppDataCandidate`) | NO | YES | add optional `dataHealthEligibility` input + `data_health_eligibility_not_met` blocker (additive, non-breaking) |
| `src/cloudProduction/cloudPushCandidate.ts` | `runCloudPushCandidate` | `cloud-push-candidate` | none (verdict only) | NO | YES | additive: accept optional `dataHealthEligibility` precondition |
| `src/cloudProduction/cloudWriteShadowMode.ts` | `buildPhase19hCloudWriteShadowMode` | `shadow-write` | none (verdict only) | NO | YES | static test only |
| `src/cloudProduction/cloudAppDataRepositoryCandidate.ts` | `createCloudAppDataRepositoryCandidate.writeCloudAppDataCandidate` | `cloud-snapshot-insert` (adapter) | `.from('cloud_appdata_snapshots').insert(...)` | NO | YES | static test: any non-test caller must consult guard |
| `src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx` | upload handler invoking `runProductionFullAcceptanceSync` | UI trigger | none directly | NO | YES | gate the trigger on guard; static test |
| `src/cloudProduction/cloudParityCheck.ts` | `buildCloudParityCheck` | `cloud-parity` (read) | none | n/a | YES | no upload; static test ensures parity callers don't double as uploaders |
| `src/cloudProduction/cloudReadMirror.ts` | `buildPhase19gCloudReadMirror` | `read-mirror` (read) | none | n/a | YES | no upload |
| `src/cloudProduction/cloudOperationJournal.ts` | `createCloudOperationJournalEntry` | `journal` (metadata) | none | n/a | (not in locked list) | static test: journal entry creation cannot infer upload success without guard verdict |

Other `cloudProduction/*` files (sync conflict detection, auth gates, offline rollback, etc.) do not write AppData snapshots and are not in scope.

## 4. Current upload dataflow (V2)

```
[UI button] → CloudSyncPolishSettingsPanel handler
   ↓ raw appData
runProductionFullAcceptanceSync(appData, ...)
   ↓
buildCloudWriteShadowCandidate → buildCloudReadMirrorVerification → buildFirstUploadExplicitApply
   ↓ (no eligibility check)
gateway.writeSnapshot(appData)  →  Supabase .from('cloud_appdata_snapshots').insert(row)
   ↓
buildCloudParityCheck (post-write read)
```

Gap: at every arrow above, raw `appData` could be partially repaired, mid-orchestrator-cycle, backup-failed, or otherwise dirty. None of the gates reject on data-health grounds.

## 5. New enforced upload dataflow

```
[UI button] → CloudSyncPolishSettingsPanel handler
   ↓
ensureCloudUploadEligible({ appData, source: 'explicit-first-upload', accountId, snapshotKind: 'first-upload' })
   ↓
   guard.ok === false  →  passive status row, no upload call
   ↓
   guard.ok === true   →  runProductionFullAcceptanceSync({ ..., dataHealthEligibility: guard.eligibility })
                              ↓
                              buildFirstUploadExplicitApply consults dataHealthEligibility → blocker `data_health_eligibility_not_met` if missing/false
                              ↓ (only when ok)
                              gateway.writeSnapshot(appData)
                              ↓
                              buildCloudParityCheck
```

Hard rules enforced in this PR:

- No production callable that invokes `runProductionFullAcceptanceSync`, `runCloudPushCandidate`, or `buildFirstUploadExplicitApply` may exist in `src/` without also importing `ensureCloudUploadEligible`.
- `ensureCloudUploadEligible` always calls `evaluateCloudUploadEligibility`. Callers must not duplicate eligibility logic.
- Blocked upload returns `{ ok: false, reason: ... }` and surfaces a passive Chinese status. No fake `syncRuntimeEnabled: true`. No silent overwrite. No localStorage clear.

## 6. Central guard architecture

`src/dataHealth/uploadEligibilityGuard.ts`:

```ts
export type UploadEligibilityGuardSource =
  | 'explicit-first-upload'
  | 'cloud-push-candidate'
  | 'production-acceptance-orchestrator'
  | 'manual-upload'
  | 'background-future-sync';

export type UploadEligibilitySnapshotKind =
  | 'first-upload'
  | 'subsequent-upload'
  | 'shadow-preflight'
  | 'parity-write'
  | 'metadata-only';

export type UploadEligibilityGuardReason =
  | 'eligible'
  | 'pending_safe_repairs'
  | 'backup_failed'
  | 'partially_repaired'
  | 'missing_repair_receipt'
  | 'stale_runtime_guard_only'
  | 'audit_only_blocked'
  | 'invalid_appdata'
  | 'unknown';

export interface UploadEligibilityGuardInput {
  appData: AppData | null | undefined;
  source: UploadEligibilityGuardSource;
  accountId?: string;
  snapshotKind: UploadEligibilitySnapshotKind;
  allowAuditOnly?: boolean;
  now?: () => Date;
}

export interface UploadEligibilityGuardResult {
  ok: boolean;
  reason: UploadEligibilityGuardReason;
  eligibility?: CloudUploadEligibility;
  repairSummary?: {
    pendingRepairs: number;
    pendingRepairIds: string[];
    auditOnly: number;
    backupFailed: boolean;
  };
  receiptSummary?: {
    ledgerHashMatches: boolean;
    appDataHash: string;
  };
  passiveStatus: { line: string; tone: 'ok' | 'busy' | 'audit-pending' | 'backup-failed' };
  safeUserMessage: string;
  hiddenDebugDetails?: Record<string, unknown>;
}

export const ensureCloudUploadEligible: (input: UploadEligibilityGuardInput) => UploadEligibilityGuardResult;
```

Behavior:

- `appData == null` → `{ ok: false, reason: 'invalid_appdata' }`.
- Call `evaluateCloudUploadEligibility(appData, { now })`.
- If `eligibility.backupFailed === true` → `{ ok: false, reason: 'backup_failed' }`.
- If `eligibility.pendingRepairs > 0` → `{ ok: false, reason: 'pending_safe_repairs' }`.
- If `eligibility.eligible === false` (any other reason) → `{ ok: false, reason: 'partially_repaired' }`.
- If `eligibility.auditOnly > 0` AND `allowAuditOnly === false` → `{ ok: false, reason: 'audit_only_blocked' }`. Default `allowAuditOnly = true` (audit-only never blocks unless caller opts in).
- If `snapshotKind` requires a receipt and `ledgerHashMatches === false` → `{ ok: false, reason: 'missing_repair_receipt' }`. (Reserved for future subsequent-upload paths.)
- Otherwise `{ ok: true, reason: 'eligible', eligibility }`.

`safeUserMessage` is one of the allowed compact strings (§Failure semantics).

## 7. Explicit first upload (CloudSyncPolishSettingsPanel) wiring

If the boundary test for `CloudSyncPolishSettingsPanel.tsx` permits the addition: import `ensureCloudUploadEligible` and call it before `runProductionFullAcceptanceSync`. Branch on `guard.ok`. When `guard.ok === false` surface `guard.safeUserMessage` and skip the orchestrator call.

If the boundary test rejects the panel edit: ship a small wrapper `src/dataHealth/explicitFirstUploadGate.ts` that the panel can import (`/dataHealth/` is allowed by the boundary, `/cloud` substring is forbidden). The wrapper composes `ensureCloudUploadEligible` + `runProductionFullAcceptanceSync` so the panel imports a single function whose contract guarantees the guard call.

## 8. Future cloudPushCandidate handling

`cloudPushCandidate.ts` is boundary-locked. Additive change: accept an optional `dataHealthEligibility?: CloudUploadEligibility` input field. When present and `eligibility.eligible === false`, return a new status `'data_health_eligibility_not_met'`. When absent, behavior is unchanged (current callers — all tests — pass).

Static enforcement: any non-test file that imports `runCloudPushCandidate` must also import `ensureCloudUploadEligible`. The static test fails CI if a future production caller forgets.

## 9. First upload candidate handling

Same pattern for `firstUploadExplicitApply.ts`: additive optional input + new blocker. The orchestrator (`productionFullAcceptanceRuntime`) plumbs through a `dataHealthEligibility` argument the panel supplies. The candidate's existing 21E checks remain intact.

## 10. Background / future sync

Boundary helper already forbids `cloudPrimaryEnabled`, `defaultSyncEnabled`, `backgroundWorkEnabled` flag changes in App diffs. V3 adds a STATIC test that any file mentioning `backgroundSync` / `default sync activation` / `cloud-primary activation` in non-test paths must also import the guard. Currently zero matches; the test prevents drift.

## 11. Cloud parity / repaired snapshot handling

`cloudParityCheck.ts` is read-only and unchanged. The guard exposes `receiptSummary.ledgerHashMatches` so parity callers can recognize expected repair drift (V2 already plumbed this).

## 12. Repair receipt / ledger requirements

When `snapshotKind === 'subsequent-upload'` the guard requires `ledgerHashMatches === true` to confirm a recorded repair. V3 ships this branch but no caller uses it yet — reserved for V4 if subsequent-upload paths become production.

For V3 default `'first-upload'`: receipt requirement is OFF (the first upload is by definition the first time anything reaches cloud).

## 13. Failure semantics

When `guard.ok === false`:

- The upload candidate / orchestrator MUST NOT call `gateway.writeSnapshot`.
- No success flags set: `cloudWriteAttempted=false`, `uploadPerformed=false`, `cloudDataChanged=false`, `syncRuntimeEnabled=false`.
- `guard.passiveStatus.line` is one of:
  - `数据正在自动整理，稍后同步` (busy / pending repairs)
  - `数据已整理完成，可同步` (clean, eligible)
  - `同步暂缓，等待数据整理完成` (audit blocked when caller opts in)
- No modal. No raw debug. No localStorage clear. No cloud overwrite.
- Local training continues using `CleanAppDataView` (V1+V2 invariants).

## 14. Static enforcement strategy

Tests in `tests/cloudUploadEligibilityEnforcementStatic*.test.ts`:

1. **Guard surface exists** — `ensureCloudUploadEligible`, the reason enum, the input/output types are exported.
2. **Guard calls eligibility** — source includes `evaluateCloudUploadEligibility(`.
3. **No duplicate eligibility logic** — only `src/dataHealth/uploadEligibility.ts` may export `evaluateCloudUploadEligibility`. No other file may define its own version.
4. **Production callers import the guard** — for each of `runProductionFullAcceptanceSync`, `buildFirstUploadExplicitApply`, `runCloudPushCandidate`, any non-test file in `src/` outside `cloudProduction/` that imports the symbol must also import `ensureCloudUploadEligible` OR import `explicitFirstUploadGate` (which itself imports the guard).
5. **No modal/popup import in guard** — guard module must not import `confirm`/`prompt`/`alert`/`useConfirmDialog`.
6. **Background/default sync still off** — App.tsx / src/ does not enable `backgroundWorkEnabled`/`defaultSyncEnabled`/`cloudPrimaryEnabled`.

Tests in `tests/cloudUploadEligibilityEnforcementBehavior*.test.ts`:

1. clean AppData → `guard.ok === true`.
2. dirty AppData with pending repair → `guard.ok === false` with `reason: 'pending_safe_repairs'`.
3. backup-failed ledger entry → `guard.ok === false`, `reason: 'backup_failed'`.
4. repaired AppData with receipt → `guard.ok === true`.
5. blocked upload result does NOT mark sync as completed.
6. blocked upload exposes compact passive status string (matches one of the allowed Chinese fragments).
7. invalid AppData (null) → `guard.ok === false`, `reason: 'invalid_appdata'`.
8. audit-only finding with `allowAuditOnly: true` (default) → `guard.ok === true`.
9. audit-only finding with `allowAuditOnly: false` → `guard.ok === false`, `reason: 'audit_only_blocked'`.
10. local training continues — TrainingDecision still receives CleanAppDataView when upload blocked.
11. localStorage not cleared.
12. cloud snapshot is not overwritten when eligibility fails.
13. AppData schema unchanged.
14. package/lockfile unchanged.
15. existing V1/V2 tests still pass (regression).
16. ingress pipeline returns the same guard result for matching inputs (cross-check with V2 pipeline).

## 15. Tests

Prefix: `cloudUploadEligibilityEnforcement*`.

Files:
- `tests/cloudUploadEligibilityEnforcementBehavior.test.ts` — 16 behavior tests.
- `tests/cloudUploadEligibilityEnforcementStatic.test.ts` — 6 static tests.

## 16. Browser smoke

Scenarios (subsumed by behavior tests + the actual `npm run build`):

1. Clean AppData + click upload → eligibility passes → upload proceeds.
2. Dirty AppData with pending repair + click upload → blocked → passive status shown → no fake sync success.
3. Backup failure simulated → mutation skipped → upload blocked → Today/Training still loads.
4. Repaired AppData with receipt → eligible → upload proceeds.
5. No new default/background sync; no upload on page load.

`npm run build` + `scripts/scan-production-dist-safety.mjs` confirm the bundle has no forbidden visible copy or secrets.

## 17. Data safety

- No deletes / overwrites / localStorage clears.
- Guard never imports cloud-side write helpers — it only computes a verdict.
- Guard never returns success when eligibility is false.
- AppData schema unchanged.

## 18. Remaining risks

- Subsequent-upload (post-first) flow is not in production yet; when it lands, V3 already supports `snapshotKind: 'subsequent-upload'` plus the receipt check. A V4 may extend.
- Tests with mocked `writeRepository` can still pass for unit-test purposes. Production parity is enforced by the static contracts — review must enforce that production code paths import the guard.

## 19. Implementation phasing

| Step | Output |
|---|---|
| 4a | `src/dataHealth/uploadEligibilityGuard.ts` central guard module |
| 4b | `src/dataHealth/explicitFirstUploadGate.ts` (only if panel-side wiring is needed and boundary forbids the panel edit) |
| 5a | Static tests: production callers must import the guard, no duplicate eligibility, no modal import, background sync off |
| 5b | Behavior tests: guard verdicts cover every reason |
| 5c | Wire `runProductionFullAcceptanceSync` to accept `dataHealthEligibility` and refuse upload on failure — additive only |
| 5d | Wire `buildFirstUploadExplicitApply` to accept the same input + new blocker — additive only |
| 5e | If boundary allows, wire `CloudSyncPolishSettingsPanel` to call the guard before invoking the orchestrator. Otherwise ship `explicitFirstUploadGate` as the only documented entry point and add a static test that the panel uses it. |
| 6 | Validation: typecheck / build / test / dist scan / api dev build / no lockfile drift |
| 7 | Docs: this plan + delivery doc + amend V1/V2/policy |
| 8 | PR + merge + Vercel deploy |

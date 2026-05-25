# Frontend Full Flow Audit Fix Pack V1

## Scope

This fix pack locks the two runtime blockers found during the full-flow audit:

- Dev API recovery accepts safe macOS temp artifacts after resolving both the artifact and allowed directory real paths.
- The full Training page `完成这组` button completes the visible edited row without requiring Focus-mode draft state.

It also adds a production `dist/` safety scan and a disposable account fixture for future auth/cloud-sync audits.

## Validation Commands

- `npm run api:dev:build`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `node scripts/scan-production-dist-safety.mjs`
- Package drift check: `git diff -- package.json package-lock.json`
- Lockfile absence check: `test ! -e pnpm-lock.yaml`

## Disposable Auth And Sync Audit Fixture

Use a throwaway email/password account created only for the audit run. Do not commit the email, password, provider URL, browser session values, or environment values.

Required setup:

- Start from a clean local profile or a clearly labeled browser profile.
- Export a local JSON backup before any sync candidate action.
- Confirm dry run output before enabling any upload candidate.
- Enable sync only through explicit user action after backup and dry run pass.
- Confirm first upload/read-back evidence is visible before reload.
- Reload and verify the local fallback data remains visible.
- Sign out at the end of the run.

Expected evidence fields:

- `disposableAccountCreated: true`
- `signedInStateVisible: true`
- `backupDownloadedBeforeSync: true`
- `dryRunPassedBeforeSync: true`
- `manualEnableOnly: true`
- `firstUploadExplicitlyApplied: true`
- `readBackOrParityVisible: true`
- `reloadLocalFallbackVisible: true`
- `signOutCompleted: true`

Stop conditions:

- Any automatic sync behavior before explicit enablement.
- Any silent overwrite or local data deletion.
- Any browser-visible credential, secret, raw environment value, or token-like value.
- Any package or lockfile drift.
- Any schema change to `AppData` or `TrainingSession`.

## Regression Coverage

- `tests/trainingViewCompletionEngine.test.ts`
- `tests/productionDistSafetyScan.test.ts`
- `tests/frontendFullFlowAuditFixPackDocs.test.ts`

## Final Fix-Pack Verdict

Mostly runs with issues addressed by this pack. Browser smoke must still pass on the final branch before merge.

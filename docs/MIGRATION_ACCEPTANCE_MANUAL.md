# Migration Acceptance / Manual Acceptance

## Scope / Non-goals

Task 5.34 is acceptance and manual acceptance coverage for the Task 5.32 dry-run helper and Task 5.33 apply prototype.

This task does not add runtime behavior, does not modify App.tsx, does not delete localStorage, does not write localStorage, does not auto-switch source of truth, does not add an HTTP migration endpoint, does not add a browser mutation route, does not add production backend, auth, sync, cloud, deployment, monitoring, package dependency, package script, normalized table, DataHealth repair, backup/import/export over HTTP, reset/recovery over HTTP, or an eighth browser mutation route.

## Safety Requirements

- [ ] Use a dedicated test browser profile.
- [ ] Use a dedicated dev DB.
- [ ] Do not use real personal training data.
- [ ] Create a localStorage backup before apply.
- [ ] Keep localStorage after apply.
- [ ] Do not auto-switch source after apply.
- [ ] Keep API primary explicit dev/local only.
- [ ] Treat this as dev/local acceptance only, not production migration.

## Valid LocalStorage Acceptance

- [ ] Dry-run validates localStorage AppData.
- [ ] Dry-run reports schema version.
- [ ] Dry-run reports history count.
- [ ] Dry-run reports template count.
- [ ] Dry-run reports active session presence.
- [ ] Apply is allowed only after backup-first and explicit confirmation.
- [ ] Apply writes SQLite snapshot only through injected writer.

## Invalid LocalStorage Acceptance

- [ ] localStorage read failures block apply.
- [ ] sanitize failures block apply.
- [ ] schema-invalid sanitized data blocks apply.
- [ ] invalid raw schema can be reported as warning.
- [ ] no fake apply success is returned.
- [ ] localStorage is not deleted.
- [ ] source of truth is not switched.

## Legacy Data Acceptance

- [ ] monolith localStorage payloads can be dry-run validated.
- [ ] split-key localStorage payloads can be dry-run validated.
- [ ] sanitizer may normalize legacy payloads before schema validation.
- [ ] warnings remain visible and non-mutating.
- [ ] no automatic repair or source switch occurs.

## Backup Restore Acceptance

- [ ] backup id is recorded.
- [ ] backup timestamp is recorded.
- [ ] localStorage snapshot payload is recorded.
- [ ] apply is blocked without backup.
- [ ] manual rollback can restore the backup to the dedicated test profile.
- [ ] backup restore does not require production services.

## SQLite Snapshot Read Acceptance

- [ ] apply returns SQLite snapshot metadata.
- [ ] snapshot id is non-empty.
- [ ] snapshot timestamp is non-empty.
- [ ] snapshot schema version matches the dry-run summary.
- [ ] manual verification can read the dedicated dev DB snapshot.
- [ ] malformed snapshot metadata fails visibly.

## Rollback Acceptance

- [ ] failed apply keeps localStorage intact.
- [ ] successful apply keeps localStorage intact.
- [ ] rollback source remains the backup snapshot.
- [ ] source is not auto-switched.
- [ ] no reset/recovery HTTP route is introduced.
- [ ] cleanup removes only dedicated dev DB artifacts.

## Accepted Browser Mutation Routes

Accepted browser mutation routes remain exactly:

- `POST /data-health/issues/:issueId/dismiss`
- `POST /history/:id/data-flag`
- `POST /history/:id/edit`
- `POST /sessions/start`
- `POST /sessions/active/patches`
- `POST /sessions/active/complete`
- `POST /sessions/active/discard`

No migration browser mutation route is added.

## Manual Runbook

1. Start from a clean git worktree.
2. Use a dedicated browser profile.
3. Use a dedicated dev DB, for example `.ironpath/manual-migration-acceptance.sqlite`.
4. Confirm no real personal training data is present.
5. Snapshot localStorage from the dedicated profile.
6. Run dry-run and record warnings.
7. Confirm backup metadata exists.
8. Run apply only with explicit confirmation.
9. Verify SQLite snapshot metadata.
10. Verify localStorage still exists and was not deleted.
11. Verify source was not switched automatically.
12. Simulate rollback by restoring the backup in the dedicated profile.
13. Remove only dedicated dev DB artifacts.
14. Record pass/fail.

## Manual Pass / Fail Template

- [ ] Date:
- [ ] Branch:
- [ ] Commit:
- [ ] Dedicated browser profile:
- [ ] Dedicated dev DB:
- [ ] Real data absent:
- [ ] Dry-run valid localStorage result:
- [ ] Dry-run invalid localStorage result:
- [ ] Legacy payload result:
- [ ] Backup metadata result:
- [ ] SQLite snapshot metadata result:
- [ ] Rollback restore result:
- [ ] localStorage preserved:
- [ ] Source not auto-switched:
- [ ] Forbidden routes absent:
- [ ] Cleanup result:
- [ ] Pass / Fail:

## Still Blocked

Still blocked:

- localStorage deletion
- automatic source switch
- production migration
- DataHealth repair
- backup/import/export over HTTP
- reset/recovery over HTTP
- broad mutation client
- normalized tables
- production backend/auth/sync/cloud/deployment
- eighth browser mutation route

## Decision

Task 5.34 accepts the migration dry-run and apply prototype for dev/local manual acceptance only.

Next recommended task: `Task 5.35 Migration Rollback & Recovery Hardening V1`.

## Final Recommendation

Task 5.34 result: migration acceptance and manual acceptance only.
No localStorage deletion, localStorage write, automatic source switch, production backend, auth, sync, cloud, deployment, package change, normalized table, DataHealth repair, backup/import/export HTTP, reset/recovery HTTP, or eighth browser mutation route is added.
localStorage remains available as fallback and migration source.
Next task should be Task 5.35 Migration Rollback & Recovery Hardening V1.

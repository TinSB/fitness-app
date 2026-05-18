# First Week Personal Production Usage Runbook

## Task Identity

- Task 15A.
- First Week Personal Production Usage Runbook.
- Phase 15 start.
- Docs/static tests only.

## Phase 14 Baseline Evidence

- Phase 14 complete.
- Final Phase 14 PR: #251.
- Final Phase 14 merge commit: `c03bf8c56dff6192dae33c155ec004c751dec2b0`.
- `npm test` passed: 1048 files / 4184 tests.
- dist token scan clean.
- Personal production candidate release path exists.
- Phase 15 was not started before this task.

## Non-Goals

Task 15A does not:

- launch public SaaS.
- enable default cloud sync.
- enable background sync.
- enable automatic multi-device sync.
- enable production deployment auto-start.
- enable external monitoring upload.
- add normalized training tables.
- perform destructive migration.
- use real personal training data in automated tests.
- remove localStorage fallback / migration / emergency role.
- add package/dependency/script/lockfile changes.

## Current Safety Baseline

- localStorage remains default/fallback/migration/emergency.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- conflict resolution remains manual.
- rollback / kill switch remains available.
- emergency local mode remains available.
- api-primary-dev remains dev/local only and not production-ready.
- accepted browser mutation routes remain exactly seven.
- blocked repair/reset/import/export HTTP routes remain blocked.
- service role key must not enter browser.
- `.env` files must not be committed.

## First-Week Operating Principle

- Use localStorage-primary as the safe default.
- Do not upload real training data automatically.
- Do not rely on cloud as the only copy.
- Do not treat manual Supabase verification as public production launch.
- Do not use cloud pull/push unless the manual checklist is satisfied.
- Stop immediately if data ownership, schema validation, or rollback status is unclear.

## Day 0 Preparation Checklist

- [ ] Confirm latest main / release build.
- [ ] Confirm localStorage baseline is working.
- [ ] Confirm backup / emergency local mode is available.
- [ ] Confirm rollback / kill switch rehearsal exists.
- [ ] Confirm Supabase project manual verification exists.
- [ ] Confirm auth callback manual verification exists.
- [ ] Confirm RLS / ownership manual verification exists.
- [ ] Confirm no service role key is in browser config.
- [ ] Confirm no `.env` file is committed.
- [ ] Confirm cloud pull/push are manual only.
- [ ] Confirm no default/background sync.

## Daily Before-Workout Checklist

- [ ] App opens successfully.
- [ ] Current runtime source is understood.
- [ ] localStorage is available.
- [ ] Emergency local mode is available.
- [ ] No forced cloud operation is pending.
- [ ] No unresolved conflict blocks local usage.
- [ ] Training session can be started locally.

## Daily After-Workout Checklist

- [ ] Session appears in local history.
- [ ] No data-health issue is unexpected.
- [ ] localStorage still has latest data.
- [ ] Optional diagnostic snapshot excludes full AppData / secrets / tokens.
- [ ] Cloud operation is not required.
- [ ] If cloud push rehearsal is attempted, dry run and manual confirmation are required.

## Cloud Pull Rehearsal Rules

- Cloud pull is optional.
- Cloud pull must be explicit.
- Cloud pull must never auto-apply.
- Owner check required.
- Schema validation required.
- Manual confirmation required before any future apply.
- localStorage must remain unchanged unless a later explicit task authorizes otherwise.

## Cloud Push Rehearsal Rules

- Cloud push is optional.
- Cloud push must be explicit.
- Dry run required.
- Owner check required.
- Backup check required.
- Manual confirmation required.
- No fake success.
- Rollback available.
- Source-of-truth unchanged unless later explicitly authorized.

## Stop Conditions

Stop and switch to emergency local mode if any of these occur:

- Unexpected data loss.
- Source-of-truth unclear.
- Owner mismatch.
- Schema validation failure.
- Cloud pull wants to auto-apply.
- Cloud push wants to skip confirmation.
- Rollback unavailable.
- Emergency local unavailable.
- Service role key appears in browser context.
- Default/background sync appears.
- Accepted mutation route inventory changes.
- Any route adds repair/reset/import/export over HTTP.

## Emergency Local Mode Procedure

- Stop cloud operations.
- Disable cloud pull.
- Disable cloud push.
- Disable Supabase adapter candidate.
- Return to localStorage-primary.
- Confirm latest local training data.
- Record incident notes.
- Do not delete localStorage backup.

## First-Week Daily Log Template

| Date | Workout completed? | Runtime source | localStorage status | Cloud pull attempted? | Cloud push attempted? | Conflict detected? | Rollback needed? | Emergency local mode used? | Issue summary | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | yes/no | localStorage-primary / candidate | ok / issue | no / manual rehearsal | no / manual rehearsal | no / yes | no / yes | no / yes | short note | next manual step |

## Success Criteria For The First Week

- App usable locally every training day.
- No local data loss.
- No unconfirmed cloud overwrite.
- No default/background sync.
- Rollback / kill switch remains available.
- Emergency local restore remains available.
- Cloud pull/push only used manually and safely.
- No secret leakage.
- No route/package boundary drift.

## Escalation Into Task 15B

Recommended next task: Task 15B — Real-World Failure / Recovery Hardening.

Task 15B should be triggered if:

- First-week logs show repeated fallback.
- Rollback was needed.
- Emergency local mode was used.
- Owner mismatch occurred.
- Schema validation failed.
- Cloud pull/push rehearsal was confusing.
- User-facing status copy was unclear.
- Diagnostics were insufficient.
- Manual steps were too hard to follow.

## Final Statement

- Task 15A does not start Task 15B.
- Phase 15 continues only after explicit instruction.
- This runbook supports personal production candidate usage only, not public SaaS launch.

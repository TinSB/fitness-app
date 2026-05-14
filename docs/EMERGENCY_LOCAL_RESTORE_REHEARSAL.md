# Emergency Local Restore Rehearsal

This runbook rehearses emergency local restore for the personal production candidate path.

## Preconditions

- `localStorage` remains default, fallback, migration source, and emergency backup.
- Emergency local mode remains available.
- Backend/cloud candidate remains explicit opt-in and reversible.
- Cloud pull does not auto-apply.
- Cloud push requires manual confirmation.

## Rehearsal Steps

- [ ] Verify emergency local mode available before any cloud rehearsal.
- [ ] Verify emergency backup available.
- [ ] Simulate cloud unavailable as a manual rehearsal condition.
- [ ] Confirm cloud failure does not block local app.
- [ ] Confirm no local data deletion.
- [ ] Confirm source-of-truth remains local unless a later explicit phase authorizes otherwise.
- [ ] Confirm rollback / kill switch remains available after emergency local restore.
- [ ] Confirm accepted browser mutation routes remain exactly seven.
- [ ] Confirm repair/reset/import/export HTTP routes remain blocked.

## Expected Result

- Emergency local mode remains available.
- Local app remains available.
- Local data deleted remains false.
- Cloud candidate can stay disabled.
- Source-of-truth changed is false.

## Blocked

- No destructive migration.
- No normalized training tables.
- No real personal training data in automated tests.
- No production deployment auto-start.
- No external monitoring upload.
- No package or lockfile change.

Recommended next pack after merge: Pack 14D - Release Candidate Acceptance + Phase 14 Archive.

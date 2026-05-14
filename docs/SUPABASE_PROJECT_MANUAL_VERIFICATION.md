# Supabase Project Manual Verification

This runbook is for manually verifying a real Supabase project outside the repo before any personal production-candidate rehearsal. It does not connect to Supabase, read env files, apply SQL, or use real Supabase project data in automated tests.

## Project Checklist

- [ ] Confirm the project is for personal production-candidate use only.
- [ ] Confirm the project URL is manually classified as production-candidate.
- [ ] Confirm the anon key is manually classified as browser-safe.
- [ ] Confirm service role is isolated outside browser-safe config.
- [ ] Confirm service role never enters browser.
- [ ] Confirm no `.env` file is committed.
- [ ] Confirm no real secrets are copied into docs, tests, fixtures, or source.
- [ ] Confirm the first manual test uses a synthetic/manual test account.
- [ ] Confirm real personal training data is not used until acceptance passes.
- [ ] Confirm rollback / kill switch and emergency local mode are available before any rehearsal.

## Browser-Safe Key Rules

- Supabase anon key may be browser-safe only after manual classification.
- Service role is never browser-safe.
- Service role must not appear in browser bundle, docs examples, tests, or committed files.
- Automated tests must use synthetic placeholders only.

## Blocked In This Pack

- No real Supabase connection.
- No SQL application.
- No table creation.
- No cloud sync implementation.
- No production deployment config.
- No package or lockfile change.
- No real project URL or real key in tests.

Recommended next pack after merge: Pack 14C — Personal Cloud Pull / Push + Rollback Rehearsal.

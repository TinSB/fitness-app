# RLS / Ownership Manual Verification

This checklist covers manual RLS and ownership review for personal production-candidate readiness. It is a review runbook only; it does not apply SQL, create tables, connect to Supabase, or modify schema.

## Ownership Fields To Review

- owner user id
- account id
- device owner id
- local owner id
- cloud account owner

## RLS Readiness Checklist

- [ ] Confirm read policy allows the user to read own data only.
- [ ] Confirm write policy allows the user to write own data only.
- [ ] Confirm owner mismatch rejection is documented.
- [ ] Confirm anonymous local data is not auto-uploaded.
- [ ] Confirm account id is included in manual ownership review.
- [ ] Confirm owner user id is included in manual ownership review.
- [ ] Confirm service role never enters browser.
- [ ] Confirm delete policy remains blocked until a later explicit phase.
- [ ] Confirm emergency restore remains local and does not require cloud.
- [ ] Confirm synthetic/manual test account is used first.

## Manual Test Account Policy

- Use a synthetic/manual test account first.
- Do not use real personal training data until acceptance passes.
- Do not seed tests with real Supabase project data.
- Do not commit project URL, anon key, service role, or `.env` files.

## Blocked In This Pack

- No SQL application.
- No table creation.
- No normalized training tables.
- No destructive migration.
- No cloud sync implementation.
- No package or lockfile change.
- No production deployment config.

Recommended next pack after merge: Pack 14C — Personal Cloud Pull / Push + Rollback Rehearsal.

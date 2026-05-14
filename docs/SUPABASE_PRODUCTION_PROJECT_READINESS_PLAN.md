# Supabase Production Project Readiness Plan V1

Task 13.3 defines readiness requirements for treating a Supabase project as production-candidate. It does not execute SQL, create tables, connect to Supabase, read real environment files, or use real project data.

## Readiness Areas

- Project URL classification must distinguish local, preview/test, production-candidate, and production.
- Anon key classification must identify public anon candidate keys without treating them as service role secrets.
- Service role key isolation is mandatory.
- Service role never in browser.
- RLS policy readiness must be reviewed before any production-candidate write.
- Backup / restore readiness must be documented before cloud data writes are accepted.
- Schema migration policy must remain draft-only until a later explicit database phase.
- Auth callback URL compatibility must match the approved release channel.
- Owner scope policy must reject mismatched account/user/device owners.
- Manual test account policy must use synthetic non-personal data only.
- No real personal training data in tests.
- Environment separation must distinguish preview, production-candidate, production, and emergency-local.
- Production-candidate vs production distinction must remain explicit.
- Rollback/emergency local mode readiness must be confirmed before production-candidate use.

## Blocked Actions

- No SQL is applied.
- No tables are created.
- No Supabase connection is made.
- No real environment files are read.
- No `.env` files are committed.
- No package changes are made.

Recommended next task: Task 13.4 Backend Hosting Target Decision V1.

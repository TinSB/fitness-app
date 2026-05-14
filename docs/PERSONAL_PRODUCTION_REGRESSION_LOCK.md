# Personal Production Regression Lock

This lock records Phase 14 personal production candidate boundaries. It is documentation and static-test coverage only.

## Runtime And Data Source Lock

- localStorage remains default/fallback/migration/emergency.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- conflict resolution remains manual.
- rollback / kill switch exists.
- emergency local mode exists.
- service role not in browser.
- `api-primary-dev` remains dev/local only and not production-ready.
- devApiRunner is not production backend.

## Blocked Release Behavior

- no default cloud sync.
- no background sync.
- no polling/timer/automatic worker.
- no production deployment auto-start.
- no external monitoring upload.
- no SaaS/multi-user runtime.
- no public SaaS launch.
- no billing/payment/subscription runtime.

## Route Lock

- accepted browser mutation routes remain exactly seven.
- no eighth browser mutation route.
- `POST /data-health/repair/apply` remains blocked.
- backup/import/export over HTTP remains blocked.
- reset/recovery over HTTP remains blocked.

## Data And Schema Lock

- no normalized training tables.
- no destructive migration.
- no real personal training data in automated tests.
- no real Supabase project data in automated tests.
- no secrets in automated tests.
- no `.env` files committed.

## Package Lock

- `@supabase/supabase-js` remains the only authorized dependency drift from Phase 12.
- no new Phase 14 dependency drift.
- no new package scripts.
- no lockfile drift.
- no generated dist committed.

Recommended next document: Phase 14 Completion Archive.

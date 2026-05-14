# Task 13.15 Production Release Regression Lock V1

This lock records Phase 13 production release hardening boundaries. It adds tests and documentation only; it does not add runtime features, routes, package scripts, deployment config, or monitoring upload.

## Locked Runtime Boundaries

- localStorage default/fallback/migration/emergency remains.
- backend/cloud candidate remains explicit opt-in.
- backend/cloud candidate remains reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- conflict resolution remains manual.
- Supabase client remains disabled unless explicitly configured.
- service role not in browser.
- no default cloud sync.
- no background sync.
- no polling/timer/automatic worker.
- no external monitoring upload.
- no production deployment runtime auto-start.
- no SaaS/multi-user runtime.

## Route Lock

- accepted browser mutation routes remain exactly seven.
- no eighth browser mutation route.
- POST /data-health/repair/apply remains blocked.
- backup/import/export over HTTP remains blocked.
- reset/recovery over HTTP remains blocked.

## Data And Schema Lock

- no normalized training tables.
- no destructive migration.
- real personal data excluded.
- diagnostics do not include full AppData, full localStorage, secrets, tokens, service role, or personal notes.
- emergency backup remains preserved.

## Package And Runtime Lock

- @supabase/supabase-js remains the only authorized dependency drift from Phase 12.
- no new Phase 13 dependency drift.
- no new package scripts.
- no lockfile drift.
- api-primary-dev remains dev/local only and not production-ready.
- devApiRunner is not production backend.
- node:sqlite snapshot repository is not cloud multi-user DB.

Recommended next task: Task 13.16 Phase 13 Completion Archive V1.

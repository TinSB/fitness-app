# Cloud Database / Sync Regression Lock V1

This lock preserves the Phase 12 cloud database and manual sync candidate boundaries.

## Locked Assertions

- localStorage default/fallback/migration/emergency remains.
- Backend-primary candidate explicit opt-in remains.
- Supabase client adapter is disabled by default.
- Cloud sync is not default.
- Cloud pull does not overwrite local by default.
- Cloud push requires manual confirmation.
- Conflict resolution is manual.
- No service role in browser.
- No direct browser AppData write unless explicitly allowed by a later task.
- No background sync.
- No automatic worker.
- No polling/timer.
- No normalized training tables.
- No destructive migration.
- Accepted browser mutation routes remain exactly seven.
- Blocked routes remain blocked:
  - POST /data-health/repair/apply
  - backup/import/export over HTTP
  - reset/recovery over HTTP
- Real personal data excluded.
- `@supabase/supabase-js` is the only authorized dependency drift.
- No other package drift.
- api-primary-dev remains dev/local only and not production-ready.
- devApiRunner is not production backend.
- node:sqlite snapshot repository is not cloud multi-user DB.

## Current Package Status

Task 12.7 authorized and added `@supabase/supabase-js`. No package scripts were added, and no other direct dependency was authorized in Phase 12.

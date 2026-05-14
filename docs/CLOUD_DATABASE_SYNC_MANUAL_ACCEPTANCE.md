# Cloud Database / Sync Manual Acceptance V1

Use this runbook before any future task treats cloud database or sync candidate behavior as accepted. All checks use synthetic data only.

## Scope / Non-Goals

- [ ] Confirm Phase 12 remains cloud database and manual sync candidate work only.
- [ ] Confirm no default sync is enabled.
- [ ] Confirm no background sync is implemented.
- [ ] Confirm no automatic worker is implemented.
- [ ] Confirm no polling/timer behavior is implemented.
- [ ] Confirm no SaaS or multi-user runtime is implemented.
- [ ] Confirm no production deployment runtime is implemented.
- [ ] Confirm no external monitoring upload is implemented.

## Supabase Guard And Adapter

- [ ] Supabase env/project guard rejects unsafe production config.
- [ ] Supabase client adapter is disabled by default.
- [ ] Service role not in browser.
- [ ] Browser-safe config contains no secrets.
- [ ] Package dependency authorization evidence confirms Task 12.7 was the only authorized dependency exception for `@supabase/supabase-js`.

## Data Ownership And RLS

- [ ] Account owner scope is required for cloud AppData candidates.
- [ ] RLS policy draft only; no SQL was applied.
- [ ] Owner mismatch rejects cloud AppData read/write candidates.
- [ ] Anonymous local data cannot auto-upload.

## Candidate Operations

- [ ] Local-to-cloud dry run reports readiness without upload.
- [ ] Cloud pull candidate does not auto-apply.
- [ ] Cloud pull candidate leaves localStorage unchanged.
- [ ] Cloud push candidate requires dry run, owner check, backup check, schema validation, and manual confirmation.
- [ ] Conflict detection requires manual resolution.
- [ ] Manual conflict resolution requires confirmation and backup where needed.
- [ ] Operation journal / idempotency prevents duplicate manual apply candidates.
- [ ] Rollback remains available.
- [ ] Emergency local mode remains available.

## Safety Locks

- [ ] localStorage fallback/emergency documented and available.
- [ ] No default sync.
- [ ] No background sync.
- [ ] No automatic worker.
- [ ] No polling/timer.
- [ ] No real personal data; real personal training data remains excluded from tests and fixtures.
- [ ] Dist token scan passes.
- [ ] Seven-route lock remains exactly seven accepted browser mutation routes.
- [ ] Blocked routes remain blocked: POST /data-health/repair/apply.
- [ ] Blocked backup/import/export HTTP routes remain blocked.
- [ ] Blocked reset/recovery HTTP routes remain blocked.

## Pass / Fail Template

- [ ] PASS: all checks above are complete, validation passed, and no prohibited runtime was introduced.
- [ ] FAIL: stop if any check fails, if real data or secrets are present, or if any cloud/default/background sync behavior is introduced.

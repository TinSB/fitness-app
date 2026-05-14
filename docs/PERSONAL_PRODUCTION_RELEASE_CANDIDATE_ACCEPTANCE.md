# Personal Production Release Candidate Acceptance

This runbook is the manual acceptance checklist for the Phase 14 personal production candidate release path. It is for a single-user / owner-only environment and does not launch public production.

## Scope / Non-Goals

- [ ] Confirm this is a personal production candidate only.
- [ ] Confirm this is not public SaaS.
- [ ] Confirm no default cloud sync.
- [ ] Confirm no background sync.
- [ ] Confirm no production deployment auto-start.
- [ ] Confirm no external monitoring upload.
- [ ] Confirm no billing, payment, or subscription runtime.
- [ ] Confirm no normalized training tables or destructive migration.

## Baseline And Environment

- [ ] localStorage baseline verified.
- [ ] localStorage remains default, fallback, migration source, and emergency backup.
- [ ] Emergency local mode verified.
- [ ] Backend/cloud candidate remains explicit opt-in and reversible.
- [ ] `api-primary-dev` remains dev/local only and not production-ready.

## Supabase And Auth Verification

- [ ] Supabase project manual verification passed.
- [ ] Auth callback manual verification passed.
- [ ] Supabase anon key classified as browser-safe.
- [ ] Service role not in browser.
- [ ] No `.env` file committed.
- [ ] RLS/ownership manual review passed.
- [ ] Owner mismatch rejection reviewed.
- [ ] Anonymous local data not auto-uploaded.

## Cloud Rehearsals

- [ ] Cloud pull rehearsal passed.
- [ ] Cloud pull does not auto-apply.
- [ ] Cloud push rehearsal passed.
- [ ] Cloud push requires manual confirmation.
- [ ] Conflict manual resolution verified.
- [ ] Rollback / kill switch rehearsal passed.
- [ ] Emergency local restore rehearsal passed.
- [ ] No real personal training data in automated tests.

## Release Locks

- [ ] Accepted browser mutation routes remain exactly seven.
- [ ] `POST /data-health/repair/apply` remains blocked.
- [ ] Backup/import/export over HTTP remains blocked.
- [ ] Reset/recovery over HTTP remains blocked.
- [ ] Package drift check passed.
- [ ] No new dependency, script, or lockfile drift beyond Phase 12 authorized `@supabase/supabase-js`.
- [ ] Dist token scan clean.

## Final Go / No-Go

- [ ] GO only if every checklist item above is complete.
- [ ] NO-GO if service role appears in browser-safe config.
- [ ] NO-GO if any cloud pull would overwrite local data without manual confirmation.
- [ ] NO-GO if any cloud push can run without dry run, owner check, backup check, schema validation, and manual confirmation.
- [ ] NO-GO if localStorage fallback or emergency local mode is unavailable.

Recommended next document: Personal Production Regression Lock.

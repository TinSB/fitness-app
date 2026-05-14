# Phase 14 Personal Production Candidate Entry

Phase 14 opens the personal production candidate release path for IronPath. It is a single-user / owner-only, manually verified candidate path and is not a public SaaS launch.

## Phase 13 Evidence

- Final Phase 13 PR: #247.
- Final Phase 13 merge commit: `e50729ac4e6a844c6d874c936acc66b80199ee6d`.
- Final Phase 13 validation included `npm test`: 1034 files / 4135 tests passed.
- Final Phase 13 validation included `npm run api:dev:build`, `npm run typecheck`, `npm run build`, and dist token scan clean.

## Definition

Personal production candidate means:

- single-user / owner-only
- manual verification
- not public SaaS
- not commercial production launch
- not default cloud sync
- not background sync
- not production auto-deployment
- not automatic cloud upload
- not unguarded source-of-truth switch

## Allowed Manual Setup

- A real Supabase project may be manually configured by the user outside the repo.
- Auth callback behavior may be manually verified.
- Supabase anon key classification may be manually verified.
- Service role must never enter browser.
- No `.env` file may be committed.
- Manual checks must use synthetic/manual test account data first.

## Preserved Boundaries

- `localStorage` remains default, fallback, migration source, and emergency backup.
- Backend/cloud candidate remains explicit opt-in and reversible.
- Cloud pull does not auto-apply.
- Cloud push requires manual confirmation.
- Conflict resolution remains manual.
- Rollback / kill switch remains available.
- Emergency local mode remains available.
- `api-primary-dev` remains dev/local only and not production-ready.
- Accepted browser mutation routes remain exactly seven.

## Still Blocked

- Public SaaS runtime.
- Default cloud sync.
- Background sync.
- Automatic multi-device sync.
- Production deployment auto-start.
- External monitoring upload.
- Normalized training tables.
- Destructive migration.
- Real personal training data in automated tests.
- Backup/import/export over HTTP.
- Reset/recovery over HTTP.
- `POST /data-health/repair/apply`.

Recommended next pack after merge: Pack 14B — Supabase Project / Auth Callback Manual Verification.

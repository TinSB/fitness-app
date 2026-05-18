# Personal-Only Polish / Backup / Reliability Roadmap V1

## Task Identity

- Task 16B.
- Personal-Only Polish / Backup / Reliability Roadmap V1.
- Docs/static tests only.

## Baseline Evidence

- Task 16A complete.
- Task 16A PR #256.
- Task 16A merge commit: `9dc07d9e804e8d32f41e5cb410cffe273e6ffddd`.
- `npm test` passed: 1058 files / 4256 tests.
- dist token scan clean.
- Task 16A decision: Personal-only path now, SaaS deferred.

## Current Product Status

- IronPath has a personal production candidate path.
- Phase 14 created personal production candidate release path.
- Phase 15 stabilized first-week usage, recovery hardening, and UX control clarity.
- Task 16A chose personal-only over SaaS.
- localStorage remains default/fallback/migration/emergency.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- conflict resolution remains manual.
- rollback / kill switch remains available.
- emergency local mode remains available.

## Product Principle

- IronPath is now an owner-only personal training system.
- The next work should improve real daily use, not expand SaaS scope.
- Reliability beats new features.
- Backup/restore confidence beats automation.
- Local-first safety beats cloud-first convenience.
- Cloud candidate remains optional/manual.
- SaaS remains deferred.

## Roadmap Priority Table

| Priority | Area | Goal | Why it matters | Allowed work | Explicitly not allowed | Suggested next task |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | Backup / restore reliability | Make the owner confident that training data can be backed up, restored, and recovered. | Personal use depends on trusting the local data and recovery path before adding more cloud complexity. | backup status clarity; restore rehearsal; export/import manual checks; emergency local restore confidence; backup freshness indicators; recovery checklist UX | destructive migration; default cloud sync; background sync; HTTP backup/import/export route expansion | Task 16C — Personal-Only Backup & Recovery Implementation Pack V1 |
| P1 | Daily training logging polish | Make everyday workout logging smoother and less error-prone. | The app must work well during real workouts before productization. | training flow UX cleanup; session start/complete clarity; history review clarity; safer edit/undo messaging; better empty/error states | source-of-truth switch; route expansion; cloud-first logging | Task 16D — Daily Training UX Polish Pack V1 |
| P2 | Data health clarity | Make data-health issues understandable and actionable. | Owner-only recovery depends on knowing what is wrong without unsafe automatic repair. | clearer data-health labels; owner-friendly explanation; safer recovery recommendations; diagnostics copy cleanup | automatic repair apply; POST /data-health/repair/apply; destructive repair | Task 16E — Data Health & Diagnostics Clarity Pack V1 |
| P3 | Personal production controls polish | Make cloud candidate, rollback, emergency local, and data source status easy to understand. | Manual candidate controls are only safe if the owner can read them quickly. | presentational UI copy; status badge clarity; manual dry-run wording; kill switch visibility | auto cloud pull apply; cloud push without manual confirmation; default/background sync | Task 16E — Data Health & Diagnostics Clarity Pack V1 |
| P4 | Mobile / PWA usability | Make the app reliable and comfortable for real phone usage during training. | Training happens on a phone often enough that touch flow and local-first cues matter. | mobile layout review; tap target cleanup; offline/local-first copy; PWA install guidance; safe responsive UI polish | service-worker sync; background sync; automatic upload | Task 16F — Mobile / PWA Personal Use Polish Pack V1 |
| P5 | Optional cloud candidate verification | Keep Supabase/cloud candidate useful but manual and reversible. | Cloud candidate value should remain available without changing the safe default. | manual verification checklist; dry-run clarity; owner-scope checks; conflict explanation | default sync; multi-device auto sync; SaaS runtime | Task 16F — Mobile / PWA Personal Use Polish Pack V1 |
| P6 | Owner-only diagnostics | Help the owner understand incidents without exposing full AppData or secrets. | Diagnostics should support recovery while preserving privacy and local-first safety. | redacted diagnostic summaries; incident log clarity; recovery recommendations | external monitoring upload; full AppData snapshot upload; secrets/tokens/service role exposure | Task 16G — Phase 16 Personal-Only Roadmap Archive V1 |

## Recommended Next Implementation Sequence

1. Task 16C — Personal-Only Backup & Recovery Implementation Pack V1.
2. Task 16D — Daily Training UX Polish Pack V1.
3. Task 16E — Data Health & Diagnostics Clarity Pack V1.
4. Task 16F — Mobile / PWA Personal Use Polish Pack V1.
5. Task 16G — Phase 16 Personal-Only Roadmap Archive V1.

- Task 16C is recommended next.
- Task 16C is not started by Task 16B.
- Later tasks may be implemented as task packs, not many tiny tasks.

## What Stays Deferred

- Public SaaS launch remains deferred.
- Billing/subscription remains deferred.
- Public onboarding remains deferred.
- Multi-user admin remains deferred.
- Customer support workflow remains deferred.
- Production deployment for public users remains deferred.
- External monitoring upload remains deferred.
- Default cloud sync remains deferred.
- Background sync remains deferred.
- Automatic multi-device sync remains deferred.
- Normalized training tables remain deferred.
- Destructive migration remains deferred.

## Preserved Safety Boundaries

- localStorage remains default / fallback / migration / emergency.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- conflict resolution remains manual.
- rollback / kill switch remains available.
- emergency local mode remains available.
- api-primary-dev remains dev/local only and not production-ready.
- devApiRunner is not production backend.
- service role key must never enter browser.
- accepted browser mutation routes remain exactly seven.
- blocked repair/reset/import/export HTTP routes remain blocked.
- no default cloud sync.
- no background sync.
- no automatic worker/timer/polling sync.
- no production deployment auto-start.
- no external monitoring upload.
- no SaaS/multi-user runtime.
- no normalized training tables.
- no destructive migration.
- no real personal training data in automated tests.
- no new package/dependency/script/lockfile drift beyond Phase 12 authorized `@supabase/supabase-js`.

## Accepted Browser Mutation Route Inventory

Accepted browser mutation routes remain exactly:

1. `POST /data-health/issues/:issueId/dismiss`
2. `POST /history/:id/data-flag`
3. `POST /history/:id/edit`
4. `POST /sessions/start`
5. `POST /sessions/active/patches`
6. `POST /sessions/active/complete`
7. `POST /sessions/active/discard`

- No eighth browser mutation route was added.
- `POST /data-health/repair/apply` remains blocked.
- backup/import/export over HTTP remains blocked.
- reset/recovery over HTTP remains blocked.

## Task 16C Scope Preview

Task 16C — Personal-Only Backup & Recovery Implementation Pack V1.

Suggested Task 16C scope:

- Improve backup status readability.
- Add pure backup/restore readiness helper if useful.
- Add recovery rehearsal clarity.
- Improve emergency local restore guidance.
- Add tests.

Task 16C must still not:

- Add HTTP backup/import/export routes.
- Add destructive migration.
- Change source-of-truth behavior.
- Add default cloud sync.
- Add package dependencies.

## Final Statement

- Task 16B does not start Task 16C.
- SaaS remains deferred.
- Phase 17 is not started.
- This roadmap supports personal-only production use.

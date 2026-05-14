# Personal Production Candidate Safety Matrix

This matrix locks Phase 14 personal production candidate behavior. It is policy and static-test coverage only.

| Capability | Personal production candidate status |
| --- | --- |
| Single-user / owner-only use | allowed after manual verification |
| Real Supabase project configured outside repo | allowed manually |
| Supabase anon key classification | manual verification only |
| Service role in browser | blocked |
| `.env` committed | blocked |
| localStorage default/fallback/migration/emergency | preserved |
| Backend/cloud candidate | explicit opt-in and reversible |
| Cloud pull | manual dry run, no auto-apply |
| Cloud push | manual confirmation required |
| Conflict resolution | manual |
| Rollback / kill switch | required |
| Emergency local mode | required |
| Default cloud sync | blocked |
| Background sync | blocked |
| Automatic worker / timer / polling sync | blocked |
| Public SaaS runtime | blocked |
| Production deployment auto-start | blocked |
| External monitoring upload | blocked |
| Normalized training tables | blocked |
| Destructive migration | blocked |
| Real personal training data in automated tests | blocked |
| Accepted browser mutation routes | exactly seven |
| Repair/reset/import/export HTTP routes | blocked |

## Route Lock

Accepted browser mutation routes remain exactly:

1. `POST /data-health/issues/:issueId/dismiss`
2. `POST /history/:id/data-flag`
3. `POST /history/:id/edit`
4. `POST /sessions/start`
5. `POST /sessions/active/patches`
6. `POST /sessions/active/complete`
7. `POST /sessions/active/discard`

Still blocked:

- `POST /data-health/repair/apply`
- backup/import/export over HTTP
- reset/recovery over HTTP

Recommended next pack after merge: Pack 14B — Supabase Project / Auth Callback Manual Verification.

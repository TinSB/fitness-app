# Personal-Only vs SaaS Product Decision

## Task Identity

- Task 16A.
- Personal-Only vs SaaS Product Decision.
- Phase 16 start.
- Docs/static tests only.

## Phase 15 Baseline Evidence

- Phase 15 complete.
- Final Phase 15 task: Task 15D — Phase 15 Stabilization Archive.
- Final Phase 15 PR #255.
- Final Phase 15 merge commit: `8b216f22a63acb11ef05af91c0213fd15d796680`.
- `npm test` passed: 1056 files / 4244 tests.
- dist token scan clean.
- Phase 16 was not started before this task.

## Current IronPath Status

- IronPath has personal production candidate path.
- First-week usage runbook exists.
- Real-world failure / recovery hardening exists.
- UX cleanup for production candidate controls exists.
- localStorage remains default/fallback/migration/emergency.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- conflict resolution remains manual.
- rollback / kill switch remains available.
- emergency local mode remains available.

## Decision Options

### Path A — Personal-only production tool

IronPath remains an owner-only tool. The next phase focuses on reliability, backup, recovery, UX clarity, local-first safety, and personal production usage. This path has no public SaaS obligations.

### Path B — Commercial SaaS product

IronPath becomes a public or semi-public multi-user product. This path requires auth productionization, multi-user data isolation, billing, support, legal/privacy, onboarding, monitoring, abuse prevention, and deployment operations.

## Decision Table

| Dimension | Path A — Personal-only production tool | Path B — Commercial SaaS product |
| --- | --- | --- |
| User scope | Owner-only use | Public or semi-public multi-user use |
| Engineering complexity | Lower and focused on reliability | Much higher across product, platform, ops, and support |
| Data risk | Lower, owner-controlled data path | Higher commercial user-data risk |
| Legal/privacy burden | Lightweight personal-use posture | Privacy policy, terms, deletion/export, and legal review required |
| Support burden | Owner self-support and runbooks | Customer support workflow required |
| Billing requirement | None | Billing/subscription system required |
| Deployment/ops burden | Personal production candidate only | Production deployment operations required |
| Monitoring requirement | Local/internal diagnostics first | External monitoring strategy required |
| Value to current owner | Direct and immediate | Indirect until productized |
| Speed to usable product | Fastest path | Slower due to SaaS prerequisites |
| Risk of overengineering | Low | High risk of premature overengineering |
| Current readiness | Strong personal candidate readiness | Not ready for SaaS launch |

The comparison clearly supports Path A for the next phase.

## Final Decision

Decision: Choose Path A — Personal-only production tool for the next phase.

SaaS is deferred.

- Do not start SaaS now.
- Do not start billing.
- Do not start public onboarding.
- Do not start multi-user admin.
- Do not start legal/commercial launch work.
- Do not start production deployment for public users.

## Why SaaS Is Deferred

- No real public deployment runtime yet.
- No external monitoring upload.
- No billing/subscription system.
- No customer support workflow.
- No privacy policy / legal package.
- No automated account deletion/export workflow.
- No abuse handling.
- No public onboarding.
- No commercial data operations.
- High risk of premature overengineering.

## Why Personal-Only Is The Right Next Direction

- Fastest path to real value.
- Lower data risk.
- Better fit for current owner-only use.
- Existing localStorage/fallback/rollback boundaries are strong.
- Existing cloud candidate remains manual and reversible.
- Lets the user validate real training workflow before productizing.
- Avoids building SaaS before proving daily usage value.

## Personal-Only Next Roadmap Themes

- Backup reliability.
- Recovery UX.
- Training workflow polish.
- Data health clarity.
- Cloud candidate manual verification.
- Emergency local restore confidence.
- Mobile/PWA usability.
- Owner-only diagnostics.
- Reducing friction in daily logging.
- Improving trust in production candidate controls.

## SaaS Later Prerequisites

- Production deployment runtime.
- External monitoring strategy.
- Privacy policy.
- Terms of service.
- Account deletion/export automation.
- Billing/subscription system.
- Multi-user data isolation.
- Customer support workflow.
- Onboarding flow.
- Abuse prevention.
- Incident response.
- Commercial release acceptance.
- Legal review.

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

## Recommended Next Task

Recommended next task: Task 16B — Personal-Only Polish / Backup / Reliability Roadmap V1.

Task 16B should define a practical roadmap for:

- Personal-only polish.
- Backup reliability.
- Recovery confidence.
- Daily training UX cleanup.
- Manual cloud candidate verification.
- Owner-only diagnostics.
- Emergency local restore confidence.

## Final Statement

- Task 16A does not start Task 16B.
- SaaS is not started.
- Phase 17 is not started.
- Task 16A is a product decision only.
- IronPath remains personal-production-candidate focused.

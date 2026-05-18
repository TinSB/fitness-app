# Mobile / PWA Personal Use Polish Pack V1

## Task Identity

- Task 16F.
- Mobile / PWA Personal Use Polish Pack V1.
- personal-only polish/reliability.
- Chinese-first owner-facing copy.

## Baseline Evidence

- Task 16E complete.
- Task 16E PR #260.
- Task 16E merge commit: `dd3da4fe0db698c7b003e63b005b85cee82749f4`.
- `npm test` passed: 1072 files / 4333 tests.
- dist token scan clean.
- Task 16E added data health and diagnostics clarity.
- SaaS remains deferred.

## Non-Goals

Task 16F does not:

- add service-worker sync.
- add background sync.
- add automatic upload.
- add push notification.
- add cloud sync.
- change source-of-truth behavior.
- connect to Supabase.
- perform cloud pull.
- perform cloud push.
- add routes.
- add backup/import/export HTTP routes.
- add reset/recovery HTTP routes.
- add package/dependency/script/lockfile changes.
- add production deployment runtime.
- add external monitoring upload.
- add SaaS/multi-user runtime.

## Safety Baseline

- localStorage remains default / fallback / migration / emergency.
- backend/cloud candidate remains explicit opt-in and reversible.
- cloud pull does not auto-apply.
- cloud push requires manual confirmation.
- conflict resolution remains manual.
- rollback / kill switch remains available.
- emergency local mode remains available.
- accepted browser mutation routes remain exactly seven.
- personal-only direction remains active.
- SaaS remains deferred.

## Mobile / PWA Personal Use Checklist

- [ ] phone training use remains local-first.
- [ ] PWA install guidance does not imply cloud sync.
- [ ] offline/local availability wording says no background sync.
- [ ] emergency local mode on phone remains visible.
- [ ] backup/recovery reminder appears before risky candidate work.
- [ ] cloud candidate remains optional/manual.
- [ ] tap target and mobile readability guidance remains UI-only.
- [ ] history review on small screen confirms local history.
- [ ] diagnostics on small screen remind redaction.

## Guidance Areas

| Area | Safe copy intent |
| --- | --- |
| phone training use | Training on phone uses local-first data. |
| PWA install guidance | Installing PWA is convenience only. |
| local-first mode | localStorage remains the safe default. |
| offline/local availability wording | No background sync or automatic upload. |
| emergency local mode on phone | Return to local data and emergency backup. |
| backup/recovery reminder | Check backup and local history after training. |
| avoid accidental cloud candidate use | Cloud candidate needs dry run and manual confirmation. |
| tap target / mobile readability guidance | UI copy only; no algorithm or source-of-truth changes. |
| history review on small screen | Confirm latest local record. |
| diagnostics on small screen | Redact secrets, tokens, service role, and full AppData. |

## Task 16G Recommendation

Recommended next task: Task 16G — Phase 16 Personal-Only Roadmap Archive V1.

Task 16G should archive Tasks 16A through 16F, record final Phase 16 evidence, keep SaaS deferred, and recommend Task 17A only.

Task 16G is recommended but not started by Task 16F.

## Final Statement

- Task 16F does not start Task 16G.
- SaaS remains deferred.
- This task supports personal-only production use.

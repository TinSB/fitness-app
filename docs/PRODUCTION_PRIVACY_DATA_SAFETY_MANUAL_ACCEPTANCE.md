# Production Privacy / Data Safety Manual Acceptance

## Scope / Non-Goals

Task 10.12 Production Privacy / Data Safety Manual Acceptance V1 defines manual acceptance checks for future production privacy and data safety work.

This runbook does not implement real auth, cloud sync, deployment runtime, monitoring upload, SaaS/multi-user runtime, source-of-truth switch, normalized tables, destructive migration, package changes, or real personal training data usage.

## User Identity And Data Ownership

- [ ] Confirm `anonymous-local`, `device-local`, `backend-primary-candidate`, and `cloud-account-candidate` owner scopes are understood.
- [ ] Confirm owner mismatch fails closed.
- [ ] Confirm future cloud account ownership requires explicit link/confirmation.
- [ ] Confirm no user table or real account runtime is implemented by Phase 10.

## Local Data Vs Cloud Account Data

- [ ] Confirm local AppData remains local until a later explicit account-linking task.
- [ ] Confirm cloud account candidate data is not treated as SaaS/multi-user production data.
- [ ] Confirm backend-primary candidate remains explicit opt-in and reversible.
- [ ] Confirm localStorage emergency backup remains owner-preserving.

## Unauthenticated Local Mode

- [ ] Confirm unauthenticated local mode remains valid.
- [ ] Confirm `localStorage` remains default, fallback, migration source, and emergency backup.
- [ ] Confirm no login/signup UI is required to use local mode.

## Login / Linking Expectations

- [ ] Confirm auth remains disabled by default.
- [ ] Confirm no real auth provider integration is present.
- [ ] Confirm no provider SDK dependency is present.
- [ ] Confirm account linking requires preview, owner check, conflict check, backup readiness, and confirmation before future implementation.

## Logout Expectations

- [ ] Confirm logout behavior remains contract-level only.
- [ ] Confirm future logout must not delete localStorage emergency backup automatically.
- [ ] Confirm pending sync or ownership ambiguity must fail closed.

## Account Deletion Expectations

- [ ] Confirm account deletion remains contract-level only.
- [ ] Confirm future deletion requires explicit confirmation.
- [ ] Confirm future deletion must distinguish cloud account data from local emergency backup.

## Data Export Expectations

- [ ] Confirm export remains local/manual and is not exposed over HTTP.
- [ ] Confirm future cloud export must identify local, backend-primary candidate, and cloud account candidate ownership.

## Emergency Restore

- [ ] Confirm emergency-localStorage remains available.
- [ ] Confirm emergency restore does not require cloud account login.
- [ ] Confirm emergency backup must not be overwritten by future conflict resolution without confirmation.

## Conflict Handling

- [ ] Confirm cloud sync is disabled by default.
- [ ] Confirm future conflict handling is dry-run first.
- [ ] Confirm no silent overwrite is allowed.
- [ ] Confirm no last-write-wins default is allowed.
- [ ] Confirm owner mismatch requires manual confirmation or rejection.

## Disabled Skeletons

- [ ] Confirm auth skeleton is disabled by default.
- [ ] Confirm cloud sync skeleton is disabled by default.
- [ ] Confirm deployment runtime skeleton is disabled by default.
- [ ] Confirm monitoring external upload is absent.

## Secrets And Browser Bundle

- [ ] Confirm secrets are not in browser-safe config.
- [ ] Confirm secrets are not in the browser bundle.
- [ ] Confirm no `.env` files are committed.
- [ ] Confirm no real secret values are used in tests or acceptance evidence.

## Route Lock

- [ ] Confirm accepted browser mutation routes remain exactly seven.
- [ ] Confirm `POST /data-health/repair/apply` remains blocked.
- [ ] Confirm backup/import/export over HTTP remains blocked.
- [ ] Confirm reset/recovery over HTTP remains blocked.
- [ ] Confirm no eighth browser mutation route is added.

## Data Safety

- [ ] Confirm real personal training data remains excluded from tests, docs examples, fixtures, and acceptance evidence.
- [ ] Confirm normalized tables remain absent.
- [ ] Confirm destructive migration remains absent.
- [ ] Confirm package dependency, package script, and lockfile changes remain absent.

## Pass / Fail Template

- [ ] PASS: All checks above are verified with synthetic/non-personal data only.
- [ ] FAIL: Any check above fails, any real auth/cloud/deployment/monitoring runtime appears, any secret appears in browser-safe config, any real personal training data is used, or any blocked route appears.

## Recommendation

Recommended next task: Task 10.13 Cloud Production Regression Lock V1.

Task 10.13 is not part of Task 10.12. Auto-continue mode may begin Task 10.13 only after Task 10.12 is fully merged.

# Task 11.10 Auth Provider Manual Acceptance V1

This runbook verifies Phase 11 auth provider candidate work. It is for candidate boundaries only; it does not authorize real cloud sync, production deployment, monitoring upload, SaaS runtime, or destructive migration.

## Scope / Non-Goals

- [ ] Confirm Supabase Auth is a candidate only and no provider SDK dependency is installed.
- [ ] Confirm no real cloud sync is implemented.
- [ ] Confirm no automatic upload of local training data is implemented.
- [ ] Confirm no source-of-truth switch is performed by auth candidate state.
- [ ] Confirm no production deployment runtime or external monitoring upload is implemented.

## Prerequisites

- [ ] Use synthetic, non-personal test data only.
- [ ] Start from latest `main`.
- [ ] Confirm package dependencies, package scripts, and lockfiles have no unauthorized drift.
- [ ] Confirm `localStorage` remains default, fallback, migration source, and emergency backup.

## Auth Disabled Baseline

- [ ] Verify auth runtime and provider-candidate adapter are disabled by default.
- [ ] Verify local app usage remains available while auth is disabled.
- [ ] Verify backend-primary candidate remains explicit opt-in and reversible.

## Provider Decision

- [ ] Verify Supabase Auth is the preferred provider candidate.
- [ ] Verify Clerk remains backup only.
- [ ] Verify Auth.js/custom auth are not preferred for this phase.
- [ ] Verify no real provider SDK dependency is installed.

## Provider Config Missing

- [ ] Verify missing provider config fails closed.
- [ ] Verify browser-safe config contains no secrets.
- [ ] Verify no provider network call is attempted.

## Unsafe Callback URL

- [ ] Verify unsafe callback URL is rejected.
- [ ] Verify localhost callback is rejected for production.
- [ ] Verify dev/local API callback target is rejected for production auth candidate.

## Preview vs Production Env

- [ ] Verify preview environment is not treated as production unless explicitly classified.
- [ ] Verify production candidate config still requires safe callback and provider candidate.

## Login Candidate UI

- [ ] Verify candidate UI is not in the primary training workflow.
- [ ] Verify UI states this is not cloud sync.
- [ ] Verify UI states this is not multi-device sync.
- [ ] Verify UI states login candidate will not automatically upload local training data.
- [ ] Verify provider-missing controls are disabled or safe no-op.

## Logout Candidate UI

- [ ] Verify UI states logout does not delete emergency backup.
- [ ] Verify logout candidate returns to local mode.
- [ ] Verify local app usage remains available.

## Session Expired

- [ ] Verify expired session does not delete localStorage.
- [ ] Verify expired session does not block local app usage.
- [ ] Verify source-of-truth remains unchanged.

## Session Invalid

- [ ] Verify invalid session does not accept fake success.
- [ ] Verify invalid session keeps emergency local mode available.
- [ ] Verify backend-primary candidate can be disabled.

## Provider Unavailable

- [ ] Verify provider unavailable keeps fallback localStorage available.
- [ ] Verify provider unavailable recommends retry later or continue local.

## Local Account Link Dry-Run

- [ ] Verify linking dry-run reports `safeToLink`.
- [ ] Verify linking dry-run reports `ownerBefore` and `ownerAfterCandidate`.
- [ ] Verify linking dry-run does not mutate local or cloud data.
- [ ] Verify manual confirmation is required before safe link.

## Owner Mismatch

- [ ] Verify owner mismatch returns a stable error.
- [ ] Verify owner mismatch does not overwrite local owner state.
- [ ] Verify owner mismatch does not upload or sync data.

## Backend-Primary Account Scope

- [ ] Verify account-scoped backend-primary auth candidate requires explicit backend-primary opt-in.
- [ ] Verify account-scoped backend-primary auth candidate is not SaaS multi-user runtime.
- [ ] Verify no normalized tables are added.

## Emergency Local Mode

- [ ] Verify emergency local mode remains available on auth failure.
- [ ] Verify fallback, rollback, and emergency restore remain available.
- [ ] Verify logout does not delete emergency backup.

## No Cloud Sync / Upload / Source Switch

- [ ] Verify no cloud sync claim is made.
- [ ] Verify no automatic upload claim is made.
- [ ] Verify no source-of-truth switch is performed by auth candidate state.

## Dependency and Secret Checks

- [ ] Verify no real provider SDK dependency exists.
- [ ] Verify no secrets are in browser-safe config.
- [ ] Verify secret not in browser bundle.
- [ ] Verify dist token scan passes.

## Route Lock

- [ ] Verify accepted browser mutation routes remain exactly seven.
- [ ] Verify blocked repair/reset/import/export HTTP routes remain blocked.
- [ ] Verify `POST /data-health/repair/apply` remains blocked.

## Pass / Fail Template

- [ ] PASS: all checks above pass with synthetic data only.
- [ ] FAIL: any auth candidate state uploads, syncs, deletes, migrates, overwrites, switches source-of-truth, adds a route, adds a dependency, exposes secrets, or blocks local app usage.

Recommended next task: Task 11.11 Phase 11 Completion Archive V1.

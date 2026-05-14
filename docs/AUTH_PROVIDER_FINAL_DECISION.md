# Auth Provider Final Decision

## Task Identity

Task 11.2 Auth Provider Final Decision V1 makes the Phase 11 provider candidate decision.

This task is docs/static tests only. It does not install Supabase SDK, Clerk, Auth.js, provider dependencies, provider config secrets, real login runtime, package changes, lockfile changes, cloud sync, deployment runtime, monitoring upload, or source-of-truth changes.

## Decision

Preferred provider candidate: Supabase Auth.

Backup provider candidate: Clerk.

Not preferred now: Auth.js and custom auth.

The decision is a candidate architecture decision only. Phase 11 must not install provider SDKs or call real provider services.

## Why Supabase Auth Is Preferred

Supabase Auth is the preferred Phase 11 provider candidate because it aligns with future Phase 12 cloud database, row-level security, and user-scoped data planning.

Supabase Auth offers a simpler path toward future cloud database and sync work because account identity can later align with account-scoped AppData, backend-primary candidate ownership, and future user-scoped data policies.

Supabase Auth works well with account-scoped AppData planning because IronPath already models anonymous-local, device-local, backend-primary-candidate, and cloud-account-candidate ownership boundaries.

## Why Clerk Is Backup

Clerk remains a strong backup provider candidate because it has strong login UX.

Clerk is not the first choice now because it still requires separate database integration, data ownership mapping, account-scoped AppData policy, cloud sync policy, and future backend authorization decisions.

## Why Auth.js And Custom Auth Are Not Preferred Now

Auth.js and custom auth are not preferred now because they add maintenance burden, more architecture surface, and more provider/session/security decisions than this project stage needs.

Custom auth is especially unsuitable for AI-assisted solo development at this stage because password handling, session hardening, account recovery, abuse controls, and incident response would exceed the Phase 11 boundary.

## Allowed Phase 11 Work

Phase 11 may add:

- adapter candidate
- config guard
- fake/mock provider behavior
- session boundary
- account linking dry run
- account-scoped backend-primary auth candidate
- auth failure/logout/emergency local mode
- auth provider manual acceptance

All Phase 11 auth behavior must remain candidate, fake, guarded, or disabled unless a later explicit task authorizes real provider integration.

## Blocked Phase 11 Work

Phase 11 must not add:

- real provider SDK dependency
- Supabase SDK dependency
- Clerk dependency
- Auth.js dependency
- provider config secrets
- real login/signup runtime
- real OAuth callback route
- real cloud sync
- production deployment runtime
- external monitoring upload
- SaaS/multi-user runtime
- package dependency, package script, or lockfile changes
- source-of-truth switch
- real personal training data in tests, docs examples, fixtures, or acceptance evidence

## Runtime Boundary

`localStorage` remains default, fallback, migration source, and emergency backup.

Backend-primary candidate remains explicit opt-in and reversible.

Login candidate must not automatically upload local training data.

Logout candidate must not delete local emergency backup.

Session failure must not block local app usage.

## Recommendation

Recommended next task: Task 11.3 Auth Environment & Callback Guard V1.

Task 11.3 is not part of Task 11.2. Auto-continue mode may begin Task 11.3 only after Task 11.2 is fully merged.

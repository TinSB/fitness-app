# Auth Provider Strategy Decision

## Task Identity

Task 10.3 Auth Provider Strategy Decision V1 makes the auth strategy decision for Phase 10.

This task is docs/static tests only. It does not integrate a real auth provider, add login/signup UI, add auth routes, create user accounts, add provider config, add dependencies, modify package files, or change runtime source-of-truth behavior.

## Decision

Do not integrate a real auth provider in Phase 10.

Use an adapter-first auth boundary before selecting or integrating a real provider.

Real provider integration must wait for a later explicit Phase 11 task after data ownership, cloud database, deployment, monitoring, privacy acceptance, and release readiness evidence are complete.

## Strategy Categories Compared

### Custom Auth

Custom auth offers maximum control but creates the highest implementation and security burden. It is rejected for immediate implementation because Phase 10 does not authorize password handling, session storage, account recovery, token rotation, abuse controls, or production incident response.

### Auth.js

Auth.js may be a future candidate if the deployment target and session model are decided later. It is not integrated in Phase 10 because the production backend and account-scoped cloud data model are not final.

### Clerk

Clerk may be a future managed provider candidate. It is not integrated in Phase 10 because adding the SDK, provider configuration, login UI, and hosted account behavior would exceed the current boundary.

### Supabase Auth

Supabase Auth may be a future candidate if the database architecture and account-owned AppData model align with it. It is not integrated in Phase 10 because final cloud persistence and sync behavior are not authorized.

### Firebase/Auth0-like Managed Auth

Firebase/Auth0-like managed auth can provide mature identity features, but it is not integrated in Phase 10 because provider-specific tokens, redirects, account lifecycle behavior, and environment secrets would create real auth runtime.

### Adapter-First Strategy

Adapter-first is the selected Phase 10 strategy.

The adapter-first strategy allows IronPath to define AuthSession, AuthUser, AuthProviderAdapter, disabled adapter behavior, stable error codes, and ownership boundaries before choosing a provider.

Adapter-first keeps provider-specific SDKs, redirects, token storage, secrets, login UI, user accounts, and cloud account linking out of Phase 10 implementation.

## Why Direct Provider Integration Is Blocked

Direct provider integration is blocked because:

- no final cloud database is selected
- no production deployment runtime exists
- no real cloud sync runtime exists
- no external monitoring or incident response runtime exists
- no provider-specific secret handling has been approved
- no account-scoped AppData acceptance run has passed
- no data export/delete/restore acceptance has passed
- no conflict policy has been manually accepted with real provider semantics
- backend-primary candidate remains explicit opt-in and reversible
- `localStorage` remains default, fallback, migration source, and emergency backup

## Minimum Future Provider Requirements

A future provider selection must satisfy:

- stable user identity
- stable account identity
- explicit session model
- safe logout behavior
- safe token and secret handling
- no secrets in browser-safe config
- local profile to cloud account linking model
- owner mismatch detection
- account deletion expectations
- data export expectations
- emergency restore expectations
- conflict handling with no silent overwrite
- rollback/fallback behavior
- production deployment and monitoring readiness
- privacy/data safety manual acceptance

## Phase 10 Provider Boundary

No provider dependency is added.

No provider SDK is added.

No login UI is added.

No signup UI is added.

No auth routes are added.

No provider config is added.

No session token storage is added.

No user table is added.

No package dependency, package script, or lockfile changes are authorized.

## Blocked Implementation

Task 10.3 does not authorize:

- Clerk/Auth.js/Supabase/Auth0/Firebase dependency
- real auth provider integration
- real login/signup UI or runtime
- real user accounts
- auth routes
- account linking runtime
- cloud sync
- deployment runtime
- monitoring runtime
- SaaS/multi-user runtime
- source-of-truth switch
- normalized tables
- destructive migration
- real personal training data in tests, docs examples, fixtures, or acceptance evidence

## Recommendation

Recommended next task: Task 10.4 Auth Runtime Skeleton Boundary V1.

Task 10.4 may add a disabled adapter-first auth runtime skeleton only. Task 10.4 must not integrate a real auth provider.

Task 10.4 is not part of Task 10.3. Auto-continue mode may begin Task 10.4 only after Task 10.3 is fully merged.

# Auth Runtime Skeleton Boundary

## Task Identity

Task 10.4 Auth Runtime Skeleton Boundary V1 adds a disabled adapter-first auth runtime skeleton.

This task adds a pure browser-safe contract boundary only. It does not integrate a real auth provider, does not add login/signup UI, does not add auth routes, does not add network calls, does not store tokens, does not store secrets, and does not replace App runtime behavior.

## Skeleton Surface

The skeleton defines:

- `AuthSession`
- `AuthUser`
- `AuthProviderAdapter`
- `AuthRuntimeResult`
- `createDisabledAuthProviderAdapter`
- `createAuthRuntimeSkeleton`

Stable auth statuses:

- `disabled`
- `unauthenticated`
- `provider_not_configured`
- `unsupported`
- `authenticated_candidate`

Stable auth error codes:

- `auth_disabled`
- `provider_not_configured`
- `auth_not_implemented`
- `unsafe_environment`
- `session_unavailable`

## Disabled Default

Auth is disabled by default.

The default skeleton reports `disabled`, no user, no token, and no exposed secrets.

Login and logout operations are unsupported placeholders unless a later explicit phase authorizes real provider integration.

## Provider Boundary

No provider SDK is imported.

No provider dependency is added.

No provider config is added.

No provider network call is performed.

No provider secret is read or exposed.

The adapter-first shape exists so later work can evaluate providers without committing Phase 10 to Clerk, Auth.js, Supabase Auth, Firebase, Auth0, custom auth, or any other real provider.

## Runtime Boundary

The skeleton is not imported by `App.tsx`.

The skeleton is not exported from a browser-facing app runtime switch.

The skeleton does not change source-of-truth behavior.

`localStorage` remains default, fallback, migration source, and emergency backup.

Backend-primary candidate remains explicit opt-in and reversible.

Cloud sync remains unimplemented.

Deployment runtime remains unimplemented.

Monitoring external upload remains unimplemented.

## Blocked Implementation

Task 10.4 does not authorize:

- real auth provider integration
- real login/signup UI or runtime
- auth routes
- token storage
- account runtime
- cloud sync
- deployment runtime
- monitoring runtime
- SaaS/multi-user runtime
- source-of-truth switch
- package dependency, package script, or lockfile changes
- real personal training data in tests, docs examples, fixtures, or acceptance evidence

## Recommendation

Recommended next task: Task 10.5 Account-Scoped AppData Boundary V1.

Task 10.5 is not part of Task 10.4. Auto-continue mode may begin Task 10.5 only after Task 10.4 is fully merged.

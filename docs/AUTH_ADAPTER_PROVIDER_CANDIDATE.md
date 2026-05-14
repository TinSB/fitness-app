# Task 11.4 Auth Adapter Provider Candidate V1

This task adds an Auth Provider candidate adapter boundary for Phase 11. Supabase Auth is represented as a provider candidate only.

## Scope

- Add a provider-candidate adapter interface.
- Add a Supabase Auth candidate adapter name and shape.
- Add disabled and fake provider candidate behavior for tests.
- Keep all data synthetic and non-personal.
- Preserve `localStorage` as default, fallback, migration source, and emergency backup.
- Preserve backend-primary candidate as explicit opt-in and reversible.

## Stable Candidate States

- `disabled`
- `provider_candidate`
- `provider_not_configured`
- `session_unavailable`
- `user_unavailable`
- `unsupported`

## Stable Error Codes

- `candidate_disabled`
- `provider_config_missing`
- `callback_rejected`
- `session_unavailable`
- `user_unavailable`
- `operation_unsupported`
- `secret_exposed`
- `local_data_mutation_blocked`

## Explicit Non-Goals

- No Supabase SDK is installed or imported.
- No Clerk SDK is installed or imported.
- No real provider network call is performed.
- No real callback route is added.
- No login or signup runtime is implemented.
- No cloud sync is implemented.
- No AppData mutation is performed.
- No source-of-truth switch is performed.
- No package, script, dependency, or lockfile change is made.

## Adapter Behavior

The default adapter is disabled. Enabling the candidate still requires provider-candidate config and an accepted callback guard result. Fake provider candidate sessions are synthetic test-only data. They must not be treated as a real account session.

Unsupported flow methods return explicit failures. They do not claim success, store secrets, mutate local data, upload data, or change the runtime source.

## Boundary Confirmation

`localStorage` remains default, fallback, migration source, and emergency backup. Backend-primary remains candidate-only, explicit opt-in, and reversible. Real cloud sync, production deployment runtime, monitoring upload, SaaS runtime, normalized tables, destructive migration, and real personal training data remain blocked.

Recommended next task: Task 11.5 Auth Session Boundary V1.

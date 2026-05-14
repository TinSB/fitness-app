# Task 11.5 Auth Session Boundary V1

This task defines how auth candidate session state affects IronPath without changing source-of-truth or uploading data.

## Stable Session States

- `disabled`
- `unauthenticated`
- `authenticated-candidate`
- `expired`
- `invalid`
- `provider-unavailable`

## Safety Rules

- Session state must not automatically switch backend-primary.
- Session expired must not delete localStorage.
- Logout must not delete emergency backup.
- Auth error must not block local app usage.
- A candidate session cannot use backend-primary candidate mode until manual account linking is accepted.
- The local app remains available in disabled, unauthenticated, expired, invalid, and provider-unavailable states.

## Result Shape

The boundary reports:

- `state`
- `userCandidate`
- `accountCandidate`
- `canUseBackendPrimaryCandidate`
- `requiresManualLinking`
- `localAppAvailable`
- `emergencyLocalAvailable`
- `sourceOfTruthChanged: false`

It also explicitly reports that localStorage is not deleted, emergency backup is not deleted, and local data is not uploaded.

## Non-Goals

- No provider SDK is installed.
- No real provider callback is added.
- No login or signup runtime is implemented.
- No source-of-truth switch is performed.
- No local data upload is performed.
- No local data deletion is performed.
- No cloud sync, production deployment runtime, monitoring upload, or SaaS runtime is implemented.

## Boundary Confirmation

`localStorage` remains default, fallback, migration source, and emergency backup. Backend-primary candidate remains explicit opt-in and reversible. Fallback, rollback, and emergency restore remain available. Real personal training data remains excluded.

Recommended next task: Task 11.6 Login / Logout Candidate UI V1.

# Cutover Data Migration Dry Run

## Task Identity

Task 9.4 Cutover Data Migration Dry Run V1 adds local AppData-to-backend candidate dry-run logic.

This is diagnostic readiness reporting only. It does not write backend data, overwrite localStorage, or switch source-of-truth.

## Dry-Run Contract

The dry run accepts AppData-like input and backend repository candidate capability:

- validates AppData schema compatibility
- runs existing sanitize/migration repair path when raw input requires it
- reports warnings and blocking errors
- checks backend repository availability
- checks backend write capability
- checks backup readiness
- summarizes history, active session, and DataHealth dismissal state

The result always includes:

- `ok`
- `safeToCutover`
- `warnings`
- `blockingErrors`
- `summary`
- `backupRequired: true`
- `sourceOfTruthChanged: false`
- `localStorageMutated: false`

## Safety Rules

The dry run never mutates input AppData in place.

The dry run never deletes, replaces, repairs, or overwrites localStorage.

The dry run never writes backend data as source-of-truth.

Warning-only results may be safe to cut over later, but blocking errors must stop cutover.

## Blocked Scope

Task 9.4 does not add:

- actual cutover
- backend source-of-truth writes
- localStorage replacement
- route expansion
- auth or user accounts
- cloud sync
- deployment runtime
- monitoring runtime
- package dependency, package script, or lockfile changes
- real personal data artifacts

## Decision

Task 9.4 result: migration dry-run readiness utility only.

Recommended next task: Task 9.5 Backend-Primary Read Candidate V1.

Task 9.5 is not part of Task 9.4. Auto-continue mode may begin Task 9.5 only after Task 9.4 is fully merged.

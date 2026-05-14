# Task 12.10 Cloud Read / Pull Candidate V1

This task adds an explicit opt-in cloud pull candidate. It can inspect a cloud AppData snapshot candidate, but it never applies that data to localStorage by default.

## Behavior

- Disabled by default.
- Explicit opt-in required.
- Read cloud candidate only.
- Do not apply to localStorage.
- Do not overwrite localStorage.
- Manual confirmation is required before any future apply step.
- Cloud unavailable, missing data, invalid data, owner mismatch, schema mismatch, cloud newer, and local newer states are explicit.

## Result Guarantees

- `pullCandidate`
- `applied: false`
- `requiresManualConfirmation`
- `localStorageUnchanged: true`
- `sourceOfTruthChanged: false`

## Preserved Boundaries

The pull candidate does not repair local data, start cloud sync, add background work, add routes, or switch source-of-truth. `localStorage` remains default, fallback, migration source, and emergency backup.

Recommended next task: Task 12.11 Cloud Write / Push Candidate V1.

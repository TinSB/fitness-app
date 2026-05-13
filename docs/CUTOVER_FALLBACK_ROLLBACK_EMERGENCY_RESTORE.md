# Cutover Fallback, Rollback & Emergency Restore

## Task Identity

Task 9.8 Cutover Fallback, Rollback & Emergency Restore V1 adds safety logic for backend-primary candidate mode.

This is local decision logic only. It does not add reset/recovery HTTP routes and does not add backup/import/export over HTTP.

## Safety Behavior

The fallback and rollback evaluator preserves localStorage backup in every outcome.

It returns:

- `fallbackUsed`
- `rollbackAvailable`
- `rollbackPerformed`
- `emergencyRestoreAvailable`
- `localStorageBackupPreserved`
- `sourceOfTruthState`
- `reason`

## Failure Handling

Backend unavailable falls back to localStorage.

Backend invalid or corrupt data falls back to localStorage and does not overwrite local data.

Migration dry-run failure keeps localStorage-primary.

Backend write failure performs rollback when a localStorage backup is available.

Manual disable returns to localStorage-primary.

Emergency restore moves to emergency-localStorage when requested.

## Blocked Scope

Task 9.8 does not add:

- reset/recovery over HTTP
- backup/import/export over HTTP
- localStorage backup deletion
- backend-primary default mode
- auth or user accounts
- cloud sync
- deployment runtime
- monitoring runtime
- package dependency, package script, or lockfile changes
- real personal data artifacts

## Decision

Task 9.8 result: fallback, rollback, and emergency restore safety logic only.

Recommended next task: Task 9.9 Cutover Confirmation UX & Safety Copy V1.

Task 9.9 is not part of Task 9.8. Auto-continue mode may begin Task 9.9 only after Task 9.8 is fully merged.

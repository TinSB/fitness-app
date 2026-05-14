# Task 11.9 Auth Failure / Logout / Emergency Local Mode V1

This task adds safe handling for auth candidate failure, logout, session expiry, owner mismatch, and emergency local mode.

## Covered Reasons

- provider unavailable
- session expired
- session invalid
- user mismatch
- owner mismatch
- logout
- callback error
- token missing
- account unlink rejected

## Result Shape

The helper returns:

- `localAppAvailable`
- `fallbackLocalStorageAvailable`
- `emergencyLocalAvailable`
- `backendPrimaryDisabled`
- `localDataDeleted: false`
- `cloudDataOverwritten: false`
- `reason`
- `recommendedAction`

It also reports `sourceOfTruthChanged: false` and `fakeSuccessAccepted: false`.

## Safety Rules

- No local data deletion is performed.
- No cloud data overwrite is performed.
- No provider logout call is performed.
- No fake success is accepted.
- Backend-primary candidate can be disabled when auth state is unsafe.
- LocalStorage fallback remains available when the local backup exists.
- Emergency local mode remains available when the emergency backup exists.

## Boundary Confirmation

`localStorage` remains default, fallback, migration source, and emergency backup. Backend-primary candidate remains explicit opt-in and reversible. Login candidate does not automatically upload local training data. Logout does not delete emergency backup. Real cloud sync, production deployment runtime, monitoring upload, SaaS runtime, normalized tables, destructive migration, and real personal training data remain blocked.

Recommended next task: Task 11.10 Auth Provider Manual Acceptance V1.

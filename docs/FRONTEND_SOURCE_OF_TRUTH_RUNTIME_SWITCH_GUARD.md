# Frontend Source-of-Truth Runtime Switch Guard

## Task Identity

Task 9.7 Frontend Source-of-Truth Runtime Switch Guard V1 adds a frontend-safe runtime switch guard state machine.

This is guard logic only. It does not replace App runtime persistence and does not make backend-primary the default.

## Guard States

The guard supports:

- `localStorage-primary`
- `backend-read-candidate`
- `backend-primary-candidate`
- `fallback-localStorage`
- `emergency-localStorage`
- `disabled`

Default state is `localStorage-primary`.

## Guard Rules

Backend-primary candidate requires explicit opt-in.

Backend-read candidate requires explicit opt-in.

Unsafe or missing backend availability fails closed to localStorage or fallback-localStorage.

Dev/local API configuration cannot enable production backend-primary candidate mode.

Production build configuration must not accidentally enable api-primary-dev as source-of-truth.

Fallback-localStorage and emergency-localStorage remain reachable.

localStorage fallback, migration source, and emergency backup remain available in every state.

## Blocked Scope

Task 9.7 does not add:

- backend-primary default mode
- App runtime replacement
- localStorage deletion
- auth or user accounts
- cloud sync
- deployment runtime
- monitoring runtime
- package dependency, package script, or lockfile changes
- real personal data artifacts

## Decision

Task 9.7 result: frontend source-of-truth runtime switch guard only.

Recommended next task: Task 9.8 Cutover Fallback, Rollback & Emergency Restore V1.

Task 9.8 is not part of Task 9.7. Auto-continue mode may begin Task 9.8 only after Task 9.7 is fully merged.

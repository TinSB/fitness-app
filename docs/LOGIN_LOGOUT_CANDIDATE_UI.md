# Task 11.6 Login / Logout Candidate UI V1

This task adds conservative candidate UI copy for future login/logout work. Do not place it in the primary training workflow.

## Placement

The component is a standalone cloud-production diagnostic panel. It is not imported by `App.tsx` and is not shown in the primary training flow.

## Required Safety Copy

- This is not cloud sync.
- This is not multi-device sync.
- `localStorage` remains available for normal local app use.
- login will not automatically upload local training data.
- logout will not delete emergency backup.
- Backend-primary remains explicit opt-in and reversible.
- Fake provider state is candidate/test-only.

## Controls

The candidate controls are disabled when provider config is missing or the candidate state is disabled. Even when controls are visually enabled in a test fixture, they require a separate guard before any candidate flow.

## Non-Goals

- No real provider SDK is installed.
- No real provider flow is called.
- No real login or signup runtime is implemented.
- No cloud sync is implemented.
- No automatic data upload is performed.
- No local data deletion is performed.
- No source-of-truth switch is performed.
- No package, script, dependency, or lockfile change is made.

## Boundary Confirmation

`localStorage` remains default, fallback, migration source, and emergency backup. Backend-primary candidate remains explicit opt-in and reversible. Logout does not delete emergency backup. Login does not automatically upload local training data.

Recommended next task: Task 11.7 Local Account Linking Dry Run V1.

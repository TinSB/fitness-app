# Task 11.7 Local Account Linking Dry Run V1

This task adds a dry-run boundary for linking local anonymous or device-local data to a future cloud account owner. It does not perform linking.

## Supported Owner Scopes

- `anonymous-local`
- `device-local`
- `backend-primary-candidate`
- `cloud-account-candidate`

## Result Shape

The dry run returns:

- `ok`
- `safeToLink`
- `warnings`
- `blockingErrors`
- `ownerBefore`
- `ownerAfterCandidate`
- `localDataChanged: false`
- `cloudDataChanged: false`
- `sourceOfTruthChanged: false`

## Safety Rules

- Do not upload local data.
- Do not mutate local data.
- Do not mutate cloud or backend data.
- Do not overwrite local owner state.
- Do not link for real.
- Require manual confirmation before reporting `safeToLink: true`.
- Detect owner mismatch and already-linked candidate states.
- Keep unlink behavior as dry-run only.

## Boundary Confirmation

`localStorage` remains default, fallback, migration source, and emergency backup. Backend-primary candidate remains explicit opt-in and reversible. Login candidate does not automatically upload local training data. Logout candidate does not delete emergency backup. Real cloud sync, deployment runtime, monitoring upload, SaaS runtime, normalized tables, destructive migration, and real personal training data remain blocked.

Recommended next task: Task 11.8 Account-Scoped Backend-Primary Auth Candidate V1.

# Privacy, Export & Delete Readiness V1

Task 13.13 defines future privacy, export, and delete readiness without implementing destructive cloud delete/export runtime.

## Readiness Areas

- user data ownership
- local export readiness
- cloud export candidate readiness
- delete local data readiness
- delete cloud data candidate readiness
- account unlink readiness
- emergency backup retention
- audit log retention
- manual confirmation
- destructive action warning
- data lifecycle blocked until later explicit phase

## Ownership

- User-owned local data remains local by default.
- Backend/cloud candidate ownership remains explicit opt-in and reversible.
- Owner mismatch must block future cloud export/delete candidate behavior.
- Anonymous local data must not be silently uploaded or deleted.

## Export Readiness

- Local export readiness is documentation-only in this task.
- Cloud export candidate readiness requires future owner validation, account scope, dry run, manual confirmation, and redaction review.
- No export HTTP route is added.
- No real personal training data is used in tests or examples.

## Delete Readiness

- Delete local data readiness requires future explicit confirmation, emergency backup decision, and rollback explanation.
- Delete cloud data candidate readiness requires future account owner validation, conflict review, dry run, and manual confirmation.
- Data lifecycle remains blocked until a later explicit phase.
- No cloud delete runtime is implemented.
- No delete API is added.
- No localStorage deletion is implemented.

## Retention Readiness

- Emergency backup retention must be preserved during logout, rollback, kill switch, and emergency-local mode.
- Audit log retention must remain redacted and must not include full AppData, full localStorage, training logs, secrets, tokens, service role, or personal notes.

## Non-Goals

- No cloud delete.
- No delete API.
- No export HTTP route.
- No backup/import/export HTTP route.
- No reset/recovery HTTP route.
- No localStorage deletion.
- No legal policy generator.
- No package or lockfile change.
- No production launch.

Recommended next task: Task 13.14 Production Release Manual Acceptance V1.

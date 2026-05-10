# Dev API Recovery & Reset

This runbook is for safe local recovery and reset of the dev-only SQLite DB used by the local API runner.

## Scope / Non-goals

- [ ] Confirm this is dev-only recovery/reset.
- [ ] Confirm this is not production recovery.
- [ ] Confirm there is no HTTP reset endpoint.
- [ ] Confirm there is no App.tsx integration.
- [ ] Confirm there is no UI integration.
- [ ] Confirm there is no localStorage replacement.
- [ ] Confirm there is no auth.
- [ ] Confirm there is no sync.
- [ ] Confirm there is no deployment.
- [ ] Confirm there is no automatic destructive repair.
- [ ] Confirm reset is programmatic and confirmation-gated.

## When to use

- [ ] Use this when `.ironpath/dev-api.sqlite` appears corrupt during local API testing.
- [ ] Use this when local inspection reports schema mismatch during development.
- [ ] Use this when a clean dev API state is needed.
- [ ] Use this to back up dev DB artifacts before local experiments.
- [ ] Do not use this for real user data recovery.
- [ ] Do not use this as production recovery documentation.

## Dev DB artifacts

The only dev DB reset artifacts are:

- [ ] `.ironpath/dev-api.sqlite`
- [ ] `.ironpath/dev-api.sqlite-wal`
- [ ] `.ironpath/dev-api.sqlite-shm`
- [ ] `.ironpath/dev-api.sqlite-journal`

Safety boundaries:

- [ ] `.ironpath/dev-api-runner` is build output and must not be deleted by DB reset.
- [ ] `.ironpath/backups/` stores backups and must not be treated as a reset target.
- [ ] Main DB paths must end with `.sqlite`.
- [ ] Do not reset `.db`, `.json`, `.backup`, source, fixture, or `dev-api.sqlite.backup` files.
- [ ] Symlink and path-escape artifacts must be rejected.

## Inspect

Inspect behavior:

- [ ] Missing DB files are reported as missing.
- [ ] Inspect must not create a missing DB file.
- [ ] Inspect must not write snapshots.
- [ ] Inspect uses read-only SQLite access for existing DB files.
- [ ] `snapshot_not_found` / no latest snapshot is different from corruption.
- [ ] Corrupt snapshot JSON is reported with a stable error.
- [ ] Repository schema mismatch is reported with a stable error.
- [ ] Inspect closes SQLite handles before returning.

## Backup

Backup behavior:

- [ ] Back up before destructive reset.
- [ ] Default backup location is `.ironpath/backups/dev-api/<timestamp>`.
- [ ] The timestamp is filesystem-safe.
- [ ] Existing main SQLite, WAL, SHM, and journal artifacts are copied.
- [ ] Missing artifacts are skipped without failure.
- [ ] Runner build output is not copied.
- [ ] Unrelated sibling files are not copied.
- [ ] Do not commit backups that may contain real training data.

## Reset

Reset behavior:

- [ ] Reset requires confirmation token `RESET_DEV_API_DB`.
- [ ] `backupFirst` defaults to true.
- [ ] Use dry run first.
- [ ] Reset only deletes `.sqlite`, `.sqlite-wal`, `.sqlite-shm`, and `.sqlite-journal` artifacts for the requested DB file.
- [ ] Reset never deletes directories.
- [ ] Reset never deletes glob matches.
- [ ] Reset never deletes `.ironpath/dev-api-runner`.
- [ ] Reset never deletes backup folders.
- [ ] Reset never deletes JSON backups, source files, fixtures, or unrelated siblings.
- [ ] Reset must not run automatically on DB corruption.
- [ ] Reset must not run automatically during runner startup.

## Manual safe reset checklist

- [ ] Stop the dev API runner.
- [ ] Inspect the DB state.
- [ ] Back up DB artifacts.
- [ ] Run a dry reset first.
- [ ] Confirm the target files are only the SQLite artifacts.
- [ ] Run confirmed reset with `RESET_DEV_API_DB`.
- [ ] Start the runner with `--seed-empty` if a clean state is needed.
- [ ] Verify `GET /health`.
- [ ] Verify `GET /app-data/summary`.
- [ ] Confirm `.ironpath/dev-api.sqlite` and backups are not committed.

## Pass / Fail template

- [ ] Date:
- [ ] Branch / commit:
- [ ] DB path:
- [ ] Inspect result:
- [ ] Backup result:
- [ ] Dry run result:
- [ ] Reset result:
- [ ] Reopen result:
- [ ] Notes:
- [ ] Pass / Fail:

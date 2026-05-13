# Production Auth User Data Boundary Plan

## Task Identity

Task 7.5 defines auth, user identity, data ownership, and privacy boundaries required before production backend, source-of-truth, or cloud sync can be authorized.

This task is docs/static tests only. It adds no auth provider, login UI, user table, account model runtime, production backend, cloud sync, dependency, package script, or lockfile change.

## Auth Boundary

Production backend cannot become source-of-truth without auth/user identity because training data must be tied to the correct user, account, device, retention policy, export/delete responsibility, and rollback path.

No auth provider is selected or implemented in this task.

## User Account Boundary

No production account runtime is implemented. No login/signup flow is implemented. No token/session/OAuth handling is implemented. No user table is created.

Future account lifecycle work must cover creation, linking, unlinking, deletion, export, retention, recovery, and identity mismatch failure.

## Data Ownership Boundary

Future production data must define owner, account identity, local data association, export/delete responsibility, retention, backup, audit record, support access, and recovery path.

Single-user behavior must not be silently promoted to multi-user production behavior without explicit identity and ownership gates.

## Local Data Association Model

Future local data to account data association must preserve localStorage as migration source and emergency backup. Linking must be user-visible, reversible until confirmed, and blocked on identity mismatch.

## Cloud Sync Dependency On Auth

Cloud sync remains blocked without auth/user identity. Sync cannot safely merge, upload, download, or reconcile personal training data without account identity, device identity, and ownership checks.

## Source-of-truth Dependency On Auth

Production source-of-truth switch remains blocked without auth/user identity and user data ownership. A backend cannot become source-of-truth until it can prove whose data is being read, written, exported, deleted, backed up, and restored.

## Privacy and Sensitive Training Data Boundary

Training data is sensitive personal data. Future auth/backend/sync work must preserve least privilege, redaction, retention, export/delete, backup safety, audit minimization, and visible failure behavior.

## Test Data Policy

Automated tests, fixtures, docs examples, and acceptance evidence must use synthetic data only. Real personal training data must not be used.

## Blocked Implementation List

- auth provider selection or integration
- login UI
- signup UI
- token/session/OAuth runtime
- user table
- production account runtime
- production backend runtime
- cloud sync runtime
- production source-of-truth switch
- package dependency/script/lockfile change

## Decision

Task 7.5 result: production auth/user data boundary plan only.

Recommended next task: `Task 7.6 Production Backend Architecture Decision V1`.

Task 7.6 is not started by Task 7.5.

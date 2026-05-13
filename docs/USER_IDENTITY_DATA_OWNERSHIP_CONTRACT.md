# User Identity & Data Ownership Contract

## Task Identity

Task 10.2 User Identity & Data Ownership Contract V1 defines the identity and ownership contract required before real auth, user accounts, cloud sync, deployment, monitoring, or SaaS/multi-user runtime can be implemented.

This task is docs/static tests only. It does not implement login, signup, auth provider integration, account runtime, cloud sync, database tables, deployment runtime, monitoring runtime, or source-of-truth changes.

## Identity Terms

- `userId`: a future stable authenticated user identifier supplied by an auth provider or adapter. It is not created in Phase 10.2.
- `accountId`: a future account container that may own one or more devices and AppData documents. It is not created in Phase 10.2.
- `deviceId`: a local device identifier used only to distinguish local ownership and emergency backup context. It is not a cloud identity.
- `localOwnerId`: a local owner marker for AppData that exists before authentication.
- `anonymousLocalOwner`: the unauthenticated local owner of current localStorage AppData.
- `cloudAccountOwner`: a future authenticated account owner. It is only a contract term in Phase 10.2.

## Ownership Relationship

Local AppData remains owned by `anonymousLocalOwner` until a later explicit auth/account-linking task validates and confirms an account association.

Backend-primary candidate AppData remains candidate data. It may be associated with a `localOwnerId` or backend-primary candidate owner, but it is not a cloud account record and does not create SaaS/multi-user ownership.

Future cloud account AppData must be explicitly linked to a `cloudAccountOwner` after identity, account ownership, export/delete expectations, conflict policy, and manual acceptance are satisfied.

Device-local emergency backup must preserve the owner context it was created from. Emergency backup must not be deleted, rewritten as another owner, or silently converted to cloud account data.

## Unauthenticated State

Unauthenticated local mode remains valid.

In unauthenticated local mode:

- `localStorage` remains the default runtime source.
- `localStorage` remains fallback, migration source, and emergency backup.
- backend-primary candidate remains explicit opt-in and reversible.
- no cloud account owner exists.
- no cloud sync is performed.
- no login or signup UI is available.
- no provider token, session, or secret is stored.

## Login And Linked-Account Preconditions

Future login or linked-account work requires all of the following before implementation:

- auth provider strategy has been approved by a later explicit task
- auth runtime skeleton has been replaced by a real provider integration only after authorization
- account ownership model has manual acceptance coverage
- local AppData to cloud account association has preview and confirmation
- conflict policy exists for local and cloud divergence
- data export and deletion expectations are documented
- localStorage emergency backup remains available
- rollback and fallback behavior remain available
- secrets are not exposed to the browser bundle
- real personal training data remains excluded from tests, docs examples, fixtures, and acceptance evidence

## Logout Expectations

Future logout behavior must preserve data safety:

- logout must not delete localStorage emergency backup automatically
- logout must not silently unlink local AppData from its last known owner context
- logout must not leave pending cloud sync writes pretending to be complete
- logout must surface whether the current runtime is localStorage-primary, backend-primary candidate, fallback-localStorage, or emergency-localStorage
- logout must fail closed if account ownership cannot be verified

## Account Deletion, Export, And Restore Expectations

Future account deletion must require explicit confirmation, must define what happens to cloud account data, and must not delete local emergency backup without a separate confirmed restore/delete flow.

Future data export must be available before production cloud source-of-truth work. Export must identify whether data is local, backend-primary candidate, or cloud account candidate.

Future restore must validate owner scope before applying data. Restore must reject owner mismatch unless a later explicit manual confirmation flow authorizes relinking.

## Local Profile To Cloud Account Linking

A future local profile may link to a cloud account only after:

- owner scopes are compared
- local AppData passes validation
- cloud account candidate data passes validation
- migration dry run reports no blocking errors
- conflict policy reports safe-to-apply or manual confirmation required
- emergency backup is present
- the user confirms the link

The link must be reversible until a later explicit production source-of-truth release authorizes stricter behavior.

## Multi-Device Identity Risks

Multi-device identity is risky without real sync and conflict handling.

Known risks:

- two devices may both edit training history offline
- local newer data may conflict with cloud newer data
- owner mismatch may attach training data to the wrong account
- device clock mismatch may make recency unreliable
- logout during pending sync may leave ambiguous ownership
- account deletion on one device may conflict with local emergency backup on another device

Phase 10.2 documents these risks only. It does not implement sync, conflict resolution, account linking, or multi-device runtime.

## Blocked Implementation

Task 10.2 does not authorize:

- real auth provider integration
- real login/signup UI or runtime
- real user accounts
- auth routes
- cloud sync
- multi-device sync
- deployment runtime
- monitoring runtime
- SaaS/multi-user runtime
- user table
- normalized tables
- destructive migration
- package dependency, package script, or lockfile changes
- source-of-truth switch
- backup/import/export over HTTP
- reset/recovery over HTTP
- eighth browser mutation route
- real personal training data in tests, docs examples, fixtures, or acceptance evidence

## Decision

Task 10.2 result: user identity and data ownership contract only.

Recommended next task: Task 10.3 Auth Provider Strategy Decision V1.

Task 10.3 is not part of Task 10.2. Auto-continue mode may begin Task 10.3 only after Task 10.2 is fully merged.

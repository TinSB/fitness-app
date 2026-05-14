# Task 13.10 Monitoring / Audit Adapter Candidate V1

This task adds an internal monitoring/audit adapter candidate. It is local, in-memory, redacted, and has no external upload.

## Candidate Components

- in-memory monitor adapter
- redacted event adapter
- diagnostic event collector
- release health snapshot
- safe event normalization

## Allowed Event Types

- `release_channel_selected`
- `deployment_config_rejected`
- `cloud_pull_candidate_checked`
- `cloud_push_candidate_checked`
- `manual_conflict_resolution_requested`
- `rollback_requested`
- `emergency_local_mode_enabled`
- `diagnostic_snapshot_created`

## Redaction

The adapter drops sensitive metadata keys and non-primitive metadata. It must not retain:

- secrets
- tokens
- service role values
- full AppData
- full localStorage
- training logs
- personal notes
- raw request payloads with user data

## Non-Goals

- No external upload.
- No analytics SDK.
- No telemetry provider.
- No Sentry SDK.
- No provider config.
- No full AppData payload.
- No full localStorage payload.
- No real personal training data.
- No package or lockfile change.
- No new route.

## Preserved Boundaries

- Monitoring candidate does not externally upload data.
- Diagnostics remain redacted/internal only.
- `localStorage` remains default, fallback, migration source, and emergency backup.
- Backend/cloud candidate remains explicit opt-in and reversible.
- Cloud pull does not auto-apply.
- Cloud push requires manual confirmation.
- Conflict resolution remains manual.
- Accepted browser mutation routes remain exactly seven.

Recommended next task: Task 13.11 Production Diagnostics & Incident Snapshot V1.

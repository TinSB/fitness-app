# Monitoring Provider Strategy Decision V1

Task 13.9 decides the monitoring direction without adding a provider SDK, external transport, or provider config.

## Decision

- Short term: internal audit and redacted diagnostic snapshot.
- Later candidate: Sentry-style error monitoring.
- External upload remains blocked until explicit later authorization.

## Monitoring Categories

- local diagnostic snapshot
- in-memory audit event collector
- redacted release health snapshot
- external provider candidate later

## Redaction Rules

Monitoring candidates must exclude:

- full AppData
- full localStorage
- training logs
- secrets
- tokens
- service role
- personal notes
- raw request payloads with user data
- real personal training data

Allowed candidate content is limited to release channel, environment, candidate status flags, stable error codes, rollback availability, emergency local availability, and redacted diagnostic categories.

## Provider Positioning

Sentry-style error monitoring may be considered later, but Task 13.9 does not install Sentry, analytics SDKs, logging provider SDKs, hosting SDKs, or any telemetry package.

## Preserved Boundaries

- No external monitoring upload.
- No analytics upload.
- No provider SDK.
- No cloud sync enablement.
- No production launch.
- No package or lockfile change.
- `localStorage` remains default, fallback, migration source, and emergency backup.
- Backend/cloud candidate remains explicit opt-in and reversible.
- Accepted browser mutation routes remain exactly seven.

Recommended next task: Task 13.10 Monitoring / Audit Adapter Candidate V1.

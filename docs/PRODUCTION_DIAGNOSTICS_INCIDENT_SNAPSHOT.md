# Task 13.11 Production Diagnostics & Incident Snapshot V1

This task adds a production-candidate diagnostic snapshot helper. It creates redacted local diagnostic objects only; it does not upload, persist, or transmit snapshots.

## Allowed Diagnostic Fields

- environment
- release channel
- runtime source state
- backend-primary candidate status
- Supabase adapter status
- last cloud pull status
- last cloud push status
- last conflict status
- rollback availability
- emergency local mode availability
- redacted error codes
- safe build/version metadata when already available

## Forbidden Diagnostic Fields

- full training data
- full AppData
- full localStorage
- secrets
- tokens
- service role
- personal notes
- raw request payloads with user data
- real personal training data

## Guarantees

- No external upload.
- No network call.
- No provider SDK.
- No full AppData.
- No full localStorage.
- No secrets or tokens.
- No service role values.
- No raw request payloads.
- No source-of-truth switch.
- No local data deletion.

## Preserved Boundaries

- `localStorage` remains default, fallback, migration source, and emergency backup.
- Backend/cloud candidate remains explicit opt-in and reversible.
- Cloud pull does not auto-apply.
- Cloud push requires manual confirmation.
- Conflict resolution remains manual.
- Monitoring candidate remains redacted/internal only.
- Accepted browser mutation routes remain exactly seven.

Recommended next task: Task 13.12 Release Rollback / Kill Switch V1.

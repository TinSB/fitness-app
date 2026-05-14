# Release Capability Matrix V1

Task 13.8 defines release-channel capability policy only. It does not enable runtime capabilities, add routes, add deployment config, or change packages.

| Capability | local | dev | preview | production-candidate | production | emergency-local |
| --- | --- | --- | --- | --- | --- | --- |
| localStorage-primary | allowed | allowed | allowed | allowed | allowed | required |
| backend-primary candidate | experiment only | experiment only | read-only/candidate checks only | explicit opt-in only | blocked until later explicit phase | disabled |
| Supabase adapter candidate | fake/candidate only | fake/candidate only | candidate checks only | explicit opt-in only | blocked until later explicit phase | disabled |
| cloud pull candidate | candidate only | candidate only | read-only candidate only | manual confirmation only | review-only until later explicit phase | disabled |
| cloud push candidate | manual confirmation only | manual confirmation only | blocked | manual confirmation only | blocked until later explicit phase | disabled |
| manual conflict resolution | allowed | allowed | review only | allowed | review only | local review only |
| monitoring candidate | redacted local only | redacted local only | redacted local only | redacted/internal only | redacted/internal only | redacted local only |
| production deployment candidate | blocked | blocked | blocked | candidate only, no auto-start | blocked until later explicit launch phase | blocked |
| source-of-truth switch | blocked | blocked | blocked | blocked | blocked | forced localStorage-primary |
| cloud sync | blocked | blocked | blocked | blocked | blocked | blocked |
| background sync | blocked | blocked | blocked | blocked | blocked | blocked |
| automatic worker | blocked | blocked | blocked | blocked | blocked | blocked |
| external monitoring upload | blocked | blocked | blocked | blocked | blocked | blocked |

## Required Defaults

- Source-of-truth switch: blocked.
- Default cloud sync: blocked.
- Background sync: blocked.
- Automatic worker: blocked.
- Cloud push: manual confirmation only in allowed candidate channels.
- Cloud pull apply: manual confirmation only in allowed candidate channels.
- Monitoring: redacted/internal candidate only.
- Deployment: candidate only, no auto-start.

## Preserved Boundaries

- `localStorage` remains default, fallback, migration source, and emergency backup.
- Backend/cloud candidate remains explicit opt-in and reversible.
- Cloud pull does not auto-apply.
- Cloud push requires manual confirmation.
- Conflict resolution remains manual.
- `api-primary-dev` remains explicit dev/local only and not production-ready.
- Supabase client adapter remains disabled by default unless explicitly configured.
- Accepted browser mutation routes remain exactly seven.
- Blocked routes remain blocked: `POST /data-health/repair/apply`, backup/import/export over HTTP, and reset/recovery over HTTP.

## Non-Goals

- No runtime enablement.
- No new route.
- No production launch.
- No deployment config.
- No external monitoring upload.
- No package or lockfile change.
- No real personal training data.

Recommended next task: Task 13.9 Monitoring Provider Strategy Decision V1.

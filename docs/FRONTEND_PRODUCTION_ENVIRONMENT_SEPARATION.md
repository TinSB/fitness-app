# Task 13.7 Frontend Production Environment Separation V1

This task adds a browser-safe frontend release-channel separator. It classifies frontend environment intent and returns safe capability flags without enabling cloud runtime, deployment runtime, or source-of-truth switching.

## Environments

- local
- dev
- preview
- production-candidate
- production
- emergency-local

## Browser-Safe Release Channel Info

The helper returns:

- environment
- release channel
- production-candidate boolean
- production boolean
- emergency local availability
- `containsSecrets: false`

The release channel info must not include secrets, tokens, service role keys, full AppData, full localStorage, or real personal training data.

## Safety Rules

- Prevent preview from enabling production cloud write.
- Prevent production from using dev API.
- Prevent local env from being treated as production Supabase.
- Prevent test and preview Supabase projects from being treated as production Supabase.
- Prevent cloud candidate auto-enable.
- Prevent cloud pull apply by default.
- Prevent source-of-truth switch from frontend environment classification.

## Capability Defaults

- `localStorage` remains default, fallback, migration source, and emergency backup.
- Backend/cloud candidate behavior requires explicit manual enablement.
- Cloud pull candidate may be checked only in production-candidate mode after manual enablement.
- Cloud pull apply remains blocked.
- Cloud push candidate remains blocked from frontend environment separation.
- Source-of-truth switch remains blocked.
- Default cloud sync remains blocked.
- No automatic worker is available.
- Emergency local mode remains available.

## Non-Goals

- No provider SDK import.
- No network call.
- No environment file read.
- No localStorage write.
- No production launch.
- No deployment config.
- No external monitoring upload.
- No package or lockfile change.
- No new browser mutation route.

Recommended next task: Task 13.8 Release Capability Matrix V1.

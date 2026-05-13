# Frontend Production API Client Skeleton

## Task Identity

Task 8.7 Frontend Production API Client Skeleton V1 adds a browser-safe production API client skeleton.

The client is disabled by default and is not integrated into App runtime by this task.

## Client Boundary

The client lives under `src/productionApi/`.

It may support safe read/capability calls when explicitly enabled:

- `getHealth`
- `getCapabilities`
- `getAppDataSummary`
- `getSessionsSummary`
- `getHistory`
- `getHistoryDetail`
- `getDataHealthSummary`

It does not expose backend primary writes, source-of-truth switching, repair, reset, import, export, auth, or sync methods.

## Config Guard

The client requires explicit opt-in config:

- disabled by default
- HTTPS non-local base URL required when enabled
- localhost and dev API URLs fail closed
- missing config fails closed

## Preserved Boundaries

`localStorage` remains default runtime source, fallback, migration source, and emergency backup.

`api-primary-dev` remains explicit dev/local only and not production-ready.

The client does not replace localStorage, write to a backend, call production mutations, or overwrite AppData.

Accepted browser mutation routes remain exactly seven. No eighth browser mutation route is authorized.

## Blocked Scope

- no Node-only imports
- no `App.tsx` integration
- no automatic API calls
- no backend writes
- no source-of-truth switch
- no repair/reset/import/export
- no auth runtime
- no cloud sync
- no package changes

## Decision

Task 8.7 result: disabled-by-default browser-safe production API client skeleton only.

Recommended next task: Task 8.8 Production Dual-Read Comparison V1.

Task 8.8 may begin only after Task 8.7 is fully merged.

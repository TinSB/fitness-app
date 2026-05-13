# Production Runtime Config Guard

## Task Identity

Task 8.3 Production Runtime Config Guard V1 adds a Node-only production runtime config guard.

This is guard logic only. It does not activate production runtime, add frontend runtime switching, implement backend, auth, sync, deployment, monitoring, persistence, source-of-truth switching, or routes.

## Guard Rules

Production runtime config fails closed unless every required production setting is explicit.

Required safe conditions:

- production runtime must be explicitly enabled
- runtime kind must be `production-runtime`
- backend base URL must be a valid HTTPS production URL
- localhost, loopback, and dev API URLs are rejected as production backend URLs
- `api-primary-dev` is rejected as production runtime
- missing required config does not silently succeed
- secret values are not accepted by the guard
- error codes and messages are stable and do not echo secret values

## Disabled Default

The default result is disabled. Disabled config is not a runtime failure, but it is not an active production runtime.

Future tasks may read this guard to keep production skeleton behavior disabled unless explicitly configured.

## Preserved Boundaries

`localStorage` remains default runtime source, fallback, migration source, and emergency backup.

`api-primary-dev` remains explicit dev/local only and not production-ready.

Production source-of-truth switch remains blocked.

Accepted browser mutation routes remain exactly seven. No eighth browser mutation route is authorized.

## Blocked Scope

- no package dependencies
- no package scripts
- no lockfile changes
- no frontend runtime switch
- no live backend
- no auth runtime
- no cloud sync
- no deployment runtime
- no monitoring runtime
- no source-of-truth switch
- no route additions
- no real personal training data

## Decision

Task 8.3 result: production runtime config guard only.

Recommended next task: Task 8.4 Production Health & Capability Endpoint V1.

Task 8.4 may begin only after Task 8.3 is fully merged.

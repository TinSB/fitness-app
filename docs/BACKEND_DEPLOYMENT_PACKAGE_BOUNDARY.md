# Task 13.6 Backend Deployment Package Boundary V1

This document records a Node-only backend deployment package boundary for future deployability. The boundary reports candidate readiness only; it does not start or deploy a backend.

## Boundary

The boundary exposes:

- backend entry capability
- start mode
- health readiness
- capabilities readiness
- read candidate readiness
- write candidate readiness
- config validation result
- deployment disabled/default state

Stable states:

- `deployment_disabled`
- `not_configured`
- `config_invalid`
- `candidate_ready`
- `deployment_not_started`
- `unsupported`

## Defaults

- Deployment is disabled by default.
- Start mode is `disabled` unless every readiness gate is candidate-ready.
- Candidate-ready still means manual candidate only.
- `deploymentStarted` is always `false`.
- `autoStart` is always `false`.
- `autoListen` is always `false`.
- `bindsNetworkPort` is always `false`.

## Explicit Non-Goals

- No auto-listen.
- No port binding.
- No package script.
- No Docker or hosting config.
- No production source switch.
- No default cloud sync.
- No public launch.
- No external monitoring upload.
- No package or lockfile change.

## Preserved Runtime Boundaries

- `localStorage` remains default, fallback, migration source, and emergency backup.
- Backend/cloud candidate remains explicit opt-in and reversible.
- Cloud pull does not auto-apply.
- Cloud push requires manual confirmation.
- Conflict resolution remains manual.
- `api-primary-dev` remains explicit dev/local only and not production-ready.
- dev API runner is not hosted as production backend.
- node:sqlite snapshot repository is not promoted as production multi-user database.
- Accepted browser mutation routes remain exactly seven.

Recommended next task: Task 13.7 Frontend Production Environment Separation V1.

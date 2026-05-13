# Frontend Runtime Selector Production Guard

## Task Identity

Task 7.8 locks production guard rules for frontend runtime selection so dev/local API runtime cannot accidentally become production runtime.

This task is docs/static tests only. It does not connect the frontend to a production API, change runtime selector behavior, add production environment switching, add source-of-truth switching, add dependencies, modify scripts, or change lockfiles.

## Frontend Runtime Selector Risks

The frontend runtime selector could become unsafe if preview or production builds accidentally enable dev API source-of-truth behavior, promote `api-primary-dev`, or pull Node-only dev API artifacts into the browser bundle.

## Source Boundary

`localStorage` remains default runtime source, fallback, migration source, and emergency backup.

`api-primary-dev` remains explicit dev/local only and not production-ready. It must require explicit dev/local mode.

## Environment Variable Safety Rules

Environment variables must not silently enable production backend, production source-of-truth switching, dev API promotion, auth runtime, sync runtime, deployment runtime, or monitoring runtime.

Any future production runtime selector flag requires separate authorization, explicit failure behavior, manual acceptance, and browser bundle isolation.

## Production Build Safety Rules

Production build must not enable dev API source-of-truth accidentally. Production build must not include Node-only dev API runtime tokens.

Node-only tokens must remain absent from browser dist:

- `node:http`
- `node:sqlite`
- `devLauncher`
- `httpRuntimeAdapter`
- `serverAdapter`
- `sqliteRepository`
- `devApiRunner`
- `devDbRecovery`

## Vercel Preview / Production Boundary

Preview deployment does not equal production backend readiness. Vercel deployment does not authorize production backend. Vercel optional preview failure is not an architecture blocker unless GitHub refuses merge.

## No Accidental Dev API Source-of-truth

Dev/local API and `api-primary-dev` must not become production source-of-truth through preview, production build, environment variables, or default runtime selection.

## Route Boundary

No mutation route expansion is authorized. The accepted browser mutation route list remains exactly seven.

## Decision

Task 7.8 result: frontend runtime selector production guard documentation and static tests only.

Recommended next task: `Task 7.9 Production Release Readiness Checklist V1`.

Task 7.9 is not started by Task 7.8.

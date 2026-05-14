# Task 13.5 Production Runtime Deployment Config Guard V1

This guard defines a production deployment configuration candidate boundary. It is disabled by default and does not deploy, start, bind, or launch production.

## Scope

- Validate caller-provided deployment candidate configuration.
- Classify backend URL candidates as missing, invalid, dev-local, preview, production-candidate, or production.
- Classify Supabase project candidates as missing, invalid, local, preview, test, production-candidate, or production.
- Return browser-safe config with `enabled: false`, `serviceRoleExposed: false`, `containsSecrets: false`, and `deploymentStarted: false`.
- Return stable error codes without echoing secret values.

## Stable Error Codes

- `deployment_disabled`
- `backend_url_missing`
- `backend_url_unsafe`
- `localhost_not_production`
- `preview_not_production`
- `dev_api_not_production`
- `service_role_not_browser_safe`
- `supabase_project_not_production`
- `config_incomplete`

## Rejections

- Rejects missing backend URL without silent success.
- Rejects localhost as production backend.
- Rejects preview environment as production unless explicitly classified.
- Rejects service role key in browser-safe config.
- Rejects dev API base URL in production.
- Rejects `api-primary-dev` and `api-readonly` runtime sources for production.
- Supabase test project is not production.
- Supabase preview project is not production.

## Non-Goals

- No production launch.
- No hosting config.
- No package script.
- No SDK import.
- No external monitoring upload.
- No cloud source-of-truth switch.
- No default cloud sync.
- No route addition.
- No real environment file is read.
- No secrets are exposed to the browser.

## Preserved Boundaries

- `localStorage` remains default, fallback, migration source, and emergency backup.
- Backend/cloud candidate mode remains explicit opt-in and reversible.
- Cloud pull does not auto-apply.
- Cloud push requires manual confirmation.
- Conflict resolution remains manual.
- `api-primary-dev` remains explicit dev/local only and not production-ready.
- Accepted browser mutation routes remain exactly seven.

Recommended next task: Task 13.6 Backend Deployment Package Boundary V1.

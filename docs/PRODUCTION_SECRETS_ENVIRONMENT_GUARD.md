# Production Secrets & Environment Guard

## Task Identity

Task 10.8 Production Secrets & Environment Guard V1 adds a production secrets and environment guard.

This task adds pure config classification and guard logic only. It does not read actual secret values into tests, commit environment files, add provider SDKs, add deployment config, expose secrets to the browser bundle, or implement cloud/auth/deployment runtime.

## Guard Rules

The guard:

- is disabled by default
- fails closed on missing future production settings
- classifies disabled, development, preview, and production environment kinds
- rejects preview environment as production cloud runtime unless a later explicit task authorizes a different rule
- rejects localhost and development backend URLs as production
- rejects dev/local runtime source as production cloud runtime
- rejects browser-safe config containing secret-like keys
- reports stable error codes without echoing secret values
- returns browser-safe config with `containsSecrets: false`

## Stable Error Codes

- `cloud_runtime_disabled`
- `environment_kind_required`
- `preview_not_production`
- `production_backend_required`
- `backend_url_invalid`
- `backend_url_not_production`
- `dev_runtime_not_production`
- `secret_required_for_future_runtime`
- `secret_exposed_to_browser_config`

## Browser-Safe Config Boundary

Browser-safe config must not contain secret-like keys such as token, secret, password, private, or client secret.

The guard only records whether required future secret presence was confirmed. It does not read, store, serialize, or return actual secret values.

## Runtime Boundary

`localStorage` remains default, fallback, migration source, and emergency backup.

Backend-primary candidate remains explicit opt-in and reversible.

Auth skeleton remains disabled by default.

Cloud sync skeleton remains disabled by default.

Deployment runtime skeleton remains unimplemented.

Monitoring external upload remains unimplemented.

## Blocked Implementation

Task 10.8 does not authorize:

- real secret reads in tests
- committed `.env` files
- provider SDK
- provider config
- deployment config
- real auth provider integration
- real cloud sync
- production deployment runtime
- monitoring external upload
- package dependency, package script, or lockfile changes
- source-of-truth switch
- secrets in browser bundle
- real personal training data in tests, docs examples, fixtures, or acceptance evidence

## Recommendation

Recommended next task: Task 10.9 Deployment Target Architecture Decision V1.

Task 10.9 is not part of Task 10.8. Auto-continue mode may begin Task 10.9 only after Task 10.8 is fully merged.

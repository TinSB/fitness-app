# Auth Environment & Callback Guard

## Task Identity

Task 11.3 Auth Environment & Callback Guard V1 adds auth environment and callback guard logic before real provider integration.

This task does not integrate a real provider, install an SDK, add login UI, add auth routes, read real secrets, commit `.env` files, add package changes, or change source-of-truth behavior.

## Guard Behavior

The guard:

- is disabled by default
- validates provider candidate mode
- rejects missing provider config
- rejects missing callback URL
- rejects unsafe callback URL
- rejects localhost as production callback
- rejects preview environment as production unless explicitly classified
- rejects dev/local API URL as production auth callback target
- ensures browser-safe config never includes secrets
- fails closed on incomplete provider config
- returns stable error codes without echoing secret values

## Stable Error Codes

- `auth_env_disabled`
- `provider_config_missing`
- `callback_url_missing`
- `callback_url_unsafe`
- `localhost_not_allowed_for_production`
- `preview_not_production`
- `secret_exposed_to_browser`
- `provider_not_enabled`

## Runtime Boundary

Supabase Auth remains a provider candidate only.

No Supabase SDK is installed.

No Clerk SDK is installed.

No real provider network call is performed.

`localStorage` remains default, fallback, migration source, and emergency backup.

Backend-primary candidate remains explicit opt-in and reversible.

Login candidate must not automatically upload local training data.

Logout candidate must not delete local emergency backup.

## Blocked Implementation

Task 11.3 does not authorize:

- real provider integration
- provider SDK dependency
- login/signup runtime
- auth routes
- real callback route
- real secret reads
- committed environment files
- cloud sync
- production deployment runtime
- monitoring external upload
- package dependency, package script, or lockfile changes
- source-of-truth switch
- real personal training data in tests, docs examples, fixtures, or acceptance evidence

## Recommendation

Recommended next task: Task 11.4 Auth Adapter Provider Candidate V1.

Task 11.4 is not part of Task 11.3. Auto-continue mode may begin Task 11.4 only after Task 11.3 is fully merged.

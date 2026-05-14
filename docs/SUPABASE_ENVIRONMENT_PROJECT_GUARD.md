# Task 12.3 Supabase Environment / Project Guard V1

This task adds Supabase environment and project guard logic before any Supabase client dependency or real project connection exists. The guard is disabled by default.

## Stable Error Codes

- `supabase_disabled`
- `project_url_missing`
- `project_url_invalid`
- `localhost_not_production`
- `preview_not_production`
- `anon_key_missing`
- `service_role_not_browser_safe`
- `secret_exposed_to_browser`
- `config_incomplete`

## Guard Rules

- Project URL must be explicit and valid HTTPS.
- Localhost is rejected as a production Supabase project.
- Preview environment is rejected as production unless explicitly classified.
- Anon key candidate is classified as public anon candidate only.
- service role key must never enter browser-safe config.
- Browser-safe config must not contain secret-like keys.
- Missing or incomplete config fails closed.

## Non-Goals

- No Supabase SDK is installed or imported.
- No real environment file is read in tests.
- No `.env` file is committed.
- No network call is made.
- No database schema is added.
- No cloud read, cloud write, cloud sync, or source-of-truth switch is implemented.

`localStorage` remains default, fallback, migration source, and emergency backup. Backend/cloud candidate work remains explicit opt-in and reversible.

Recommended next task: Task 12.4 Cloud AppData Data Model Strategy V1.

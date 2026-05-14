# Task 12.7 Supabase Client Adapter Candidate V1

This task adds the Supabase client adapter candidate after Task 12.6 authorized the one dependency exception.

## Package Change

`@supabase/supabase-js` is the only package dependency added in this task. `package-lock.json` changes are limited to the dependency and its required transitive packages. No package scripts are added or changed.

## Adapter Behavior

- The adapter is disabled by default.
- Missing config fails closed.
- Unsafe project guard result fails closed.
- Missing anon key candidate fails closed.
- Service role presence is rejected.
- Mocked read candidate is supported for unit tests.
- Mocked write candidate is supported for unit tests.
- Unmocked operations fail explicitly and do not fake success.

## Non-Goals

- No real cloud writes in tests.
- No real Supabase project data is used in tests.
- No service role key in browser-safe config.
- No App.tsx automatic integration.
- No source-of-truth switch.
- No default cloud sync.
- No automatic or background sync.
- No localStorage overwrite.

`localStorage` remains default, fallback, migration source, and emergency backup. Backend/cloud candidate behavior remains explicit opt-in and reversible.

Recommended next task: Task 12.8 Account-Scoped Cloud AppData Repository Candidate V1.

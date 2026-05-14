# Task 12.6 Supabase Client Dependency Authorization V1

This task authorizes Task 12.7 to add `@supabase/supabase-js` only. It does not add the dependency, modify package files, add SDK code, or connect to Supabase.

## Required Decision

- Task 12.7 may add `@supabase/supabase-js` only.
- Task 12.7 is the only Phase 12 task allowed to modify `package.json` dependencies for this dependency.
- Task 12.7 may update `package-lock.json` only as required by installing `@supabase/supabase-js`.
- No other dependencies may be added.
- No package scripts may be added or changed.
- No unrelated lockfile drift is allowed.
- If package install causes unrelated drift, Task 12.7 must stop and report.

## Adapter-Only Constraints For Task 12.7

- Supabase client usage must be adapter-candidate only.
- Supabase client adapter must be disabled by default.
- Tests should mock or fake cloud operations.
- No real cloud writes in tests.
- No real Supabase project data in tests.
- No service role key in browser.
- No direct browser AppData cloud write.
- No App.tsx automatic integration.
- No source-of-truth switch.
- No default cloud sync.

## Phase 12 Package Rule

All other Phase 12 tasks must not change `package.json`, package scripts, or lockfiles. The only authorized dependency drift for Phase 12 is `@supabase/supabase-js` added in Task 12.7 after this authorization.

Recommended next task: Task 12.7 Supabase Client Adapter Candidate V1.

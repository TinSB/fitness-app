# Phase 21I - Production Full Acceptance V1

Phase 21I wires the explicit production acceptance path for one signed-in IronPath user.

The runtime path is still opt-in only. The app stays local-first until the user signs in, creates a local backup, reviews the dry run, and clicks `开启同步`. Only then does the production runner read the user's cloud snapshot, upload the current local AppData if no conflict exists, read the cloud snapshot back, and verify parity against the local data and upload receipt.

## Scope

21I exposes `runProductionFullAcceptanceSync`.

The production runner composes the existing Phase 21 contracts:

- 21B local backup and dry-run UI must be ready.
- 21C creates an in-memory shadow candidate.
- 21D reads the cloud mirror before upload.
- 21E performs the first upload only after explicit apply.
- 21F reads cloud back and verifies local/cloud parity.
- 21G/21H remain the documented conflict and rollback paths.

## Production Behavior

When all gates pass, 21I can report:

- `status: 'accepted'`
- `userMessage: '同步完成'`
- `firstUploadSucceeded: true`
- `cloudReadMirrorMatchesLocal: true`
- `syncRuntimeEnabled: true`
- `localStorageFallbackPreserved: true`
- `cloudPrimaryEnabled: false`
- `defaultSyncEnabled: false`
- `backgroundWorkEnabled: false`
- `sourceOfTruthChanged: false`
- `localStorageDeleted: false`

If the pre-upload read finds a different cloud snapshot, 21I reports `发现冲突` and stops before upload. It does not choose between local and cloud data.

If the cloud read or write is unavailable, 21I reports `恢复本地模式`; local training data remains available and localStorage remains the fallback.

## Browser-Safe Supabase Path

The production gateway uses the existing public Supabase browser configuration:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_IRONPATH_AUTH_CALLBACK_URL`
- `VITE_IRONPATH_CLOUD_ENVIRONMENT=production`

It uses the current in-memory Supabase auth client with `persistSession: false` and `autoRefreshToken: false`. It does not expose a service-role key, print tokens, or write tokens into localStorage.

The gateway writes only to `public.cloud_appdata_snapshots` under RLS, with `account_id = owner_user_id = auth.uid()`.

## Production SQL Prerequisite

Production must grant `authenticated` users usage on schema `public` plus only `select` and `insert` on the five owner-scoped RLS cloud tables before the explicit first upload smoke:

- `public.cloud_appdata_snapshots`
- `public.cloud_sync_operations`
- `public.cloud_devices`
- `public.cloud_conflicts`
- `public.cloud_export_delete_requests`

After the grants are applied, refresh PostgREST with `notify pgrst, 'reload schema'`. The grant step keeps RLS as the owner boundary. It does not grant update/delete and does not expose service-role access.

## Preserved Boundaries

21I does not make cloud data primary.

21I does not start default sync.

21I does not start background sync.

21I does not silently overwrite local data.

21I does not delete localStorage.

21I does not apply cloud data into local state.

21I does not change AppData or TrainingSession schema.

21I does not add SaaS, coach, team, billing, social, or admin UI.

21I keeps `pnpm-lock.yaml` absent.

## Production Acceptance Checklist

After the PR is merged to latest `main`:

- deploy latest `main` to Vercel production
- smoke `https://fitness-app-wheat-phi.vercel.app`
- create or use a disposable test account
- verify Settings loads and signed-in state is visible
- create a backup and run the dry-run preview
- click `开启同步`
- verify `同步完成`
- verify cloud read mirror matches local data
- reload and verify no cloud-primary/default/background sync starts
- verify local fallback still works
- verify conflict and rollback docs/tests exist

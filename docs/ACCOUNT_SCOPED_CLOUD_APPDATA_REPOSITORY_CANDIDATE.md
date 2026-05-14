# Task 12.8 Account-Scoped Cloud AppData Repository Candidate V1

This task adds a browser-safe cloud AppData repository candidate for document-first AppData snapshots. It stays behind explicit opt-in and uses the Supabase client adapter candidate boundary from Task 12.7.

## Repository Behavior

- Explicit opt-in only.
- Not default source-of-truth.
- Reads return cloud AppData candidates only.
- Writes require owner-scope validation.
- Writes require schema validation before candidate write.
- Reads validate schema after candidate read.
- Manual confirmation is required before candidate writes.
- Account or owner mismatch is rejected.
- Missing cloud data returns a not-found candidate result.
- No localStorage overwrite.
- No automatic sync.
- No real personal training data is used.

## Stable Errors

- `cloud_repository_disabled`
- `cloud_adapter_unavailable`
- `owner_scope_missing`
- `owner_scope_mismatch`
- `cloud_appdata_not_found`
- `cloud_appdata_invalid`
- `cloud_write_rejected`
- `cloud_write_failed`
- `manual_confirmation_required`

## Preserved Boundaries

`localStorage` remains the default runtime source, fallback, migration source, and emergency backup. Backend/cloud candidate behavior remains explicit opt-in and reversible. The repository candidate does not add routes, normalized training tables, destructive migration, default cloud sync, or background work.

Recommended next task: Task 12.9 Local-to-Cloud Migration Dry Run V1.

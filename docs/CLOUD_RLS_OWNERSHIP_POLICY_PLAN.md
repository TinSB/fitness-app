# Task 12.5 Cloud RLS / Ownership Policy Plan V1

This task plans cloud RLS and ownership policy. It does not apply SQL, add a migration, create a table, add a Supabase dependency, or connect to a cloud database.

## Ownership Fields

Future cloud AppData snapshots should carry these ownership fields:

- `account_id`
- `owner_user_id`
- `device_owner_id`
- `local_owner_id`
- `cloud_account_owner`

## Policy Intent

- Read policy: a user can read only their own cloud AppData.
- Write policy: a user can write only their own cloud AppData.
- Delete policy: deletion is blocked until a later explicit data lifecycle phase.
- Emergency restore policy: local emergency restore remains local and does not require cloud.
- Service role safety: service role never enters browser.
- Anonymous local data rule: anonymous local data cannot auto-upload.
- Owner mismatch must reject.

## Draft SQL Notes

DRAFT ONLY / NOT APPLIED:

```sql
-- DRAFT ONLY / NOT APPLIED
-- create policy "read own cloud appdata"
-- on cloud_appdata_snapshots
-- for select
-- using (owner_user_id = auth.uid());

-- DRAFT ONLY / NOT APPLIED
-- create policy "write own cloud appdata"
-- on cloud_appdata_snapshots
-- for insert
-- with check (owner_user_id = auth.uid());
```

These notes are intentionally not executable migration files. They are policy planning references only.

## Blocked In Phase 12

- Applying SQL
- Adding database migrations
- Creating cloud tables
- Adding Supabase dependency in this task
- Browser service role usage
- Anonymous local auto-upload
- Delete policy implementation
- Default cloud sync
- Background sync
- Destructive migration

## Boundary Confirmation

`localStorage` remains default, fallback, migration source, and emergency backup. Backend/cloud candidate behavior remains explicit opt-in and reversible. Cloud push remains blocked until owner check, dry run, backup readiness, schema validation, and manual confirmation are in place.

Recommended next task: Task 12.6 Supabase Client Dependency Authorization V1.

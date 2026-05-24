-- Phase 19D candidate migration file.
-- This file is committed for review and future manual application only.
-- The app runtime does not execute SQL, connect to Supabase, or switch source of truth in Phase 19D.

create table if not exists public.cloud_appdata_snapshots (
  id uuid primary key,
  account_id uuid not null,
  owner_user_id uuid not null,
  device_id uuid not null,
  local_owner_id text not null,
  source_snapshot_hash text not null,
  schema_version integer not null,
  operation_id text not null,
  app_data jsonb not null,
  validation_status text not null check (validation_status in ('valid', 'invalid', 'pending_review')),
  created_at timestamptz not null default timezone('utc', now()),
  check (account_id = owner_user_id)
);

create table if not exists public.cloud_sync_operations (
  id uuid primary key,
  account_id uuid not null,
  owner_user_id uuid not null,
  device_id uuid not null,
  local_owner_id text not null,
  operation_id text not null,
  operation_type text not null check (operation_type in ('migration_dry_run', 'read_mirror', 'write_shadow', 'explicit_sync')),
  source_snapshot_hash text not null,
  status text not null check (status in ('candidate', 'accepted_shadow', 'rejected', 'conflict', 'rolled_back')),
  created_at timestamptz not null default timezone('utc', now()),
  check (account_id = owner_user_id)
);

create table if not exists public.cloud_devices (
  id uuid primary key,
  account_id uuid not null,
  owner_user_id uuid not null,
  device_id uuid not null,
  local_owner_id text not null,
  device_label text,
  trusted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  check (account_id = owner_user_id)
);

create table if not exists public.cloud_conflicts (
  id uuid primary key,
  account_id uuid not null,
  owner_user_id uuid not null,
  device_id uuid not null,
  local_owner_id text not null,
  local_snapshot_hash text not null,
  cloud_snapshot_hash text not null,
  conflict_type text not null check (conflict_type in ('owner_mismatch', 'both_changed_offline', 'stale_revision', 'device_clock_mismatch')),
  resolution_status text not null check (resolution_status in ('pending_review', 'keep_local', 'keep_cloud', 'manual_merge', 'dismissed')),
  created_at timestamptz not null default timezone('utc', now()),
  check (account_id = owner_user_id)
);

create table if not exists public.cloud_export_delete_requests (
  id uuid primary key,
  account_id uuid not null,
  owner_user_id uuid not null,
  device_id uuid not null,
  local_owner_id text not null,
  request_type text not null check (request_type in ('export', 'delete_cloud_data')),
  status text not null check (status in ('pending_confirmation', 'confirmed', 'completed', 'cancelled')),
  confirmed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  check (account_id = owner_user_id)
);

create unique index if not exists cloud_appdata_snapshots_operation_id_idx
  on public.cloud_appdata_snapshots (operation_id);

create index if not exists cloud_appdata_snapshots_owner_created_idx
  on public.cloud_appdata_snapshots (owner_user_id, created_at desc);

create unique index if not exists cloud_sync_operations_operation_id_idx
  on public.cloud_sync_operations (operation_id);

create index if not exists cloud_conflicts_owner_status_idx
  on public.cloud_conflicts (owner_user_id, resolution_status, created_at desc);

alter table public.cloud_appdata_snapshots enable row level security;
alter table public.cloud_sync_operations enable row level security;
alter table public.cloud_devices enable row level security;
alter table public.cloud_conflicts enable row level security;
alter table public.cloud_export_delete_requests enable row level security;

create policy cloud_appdata_snapshots_select_own_rows
  on public.cloud_appdata_snapshots
  for select
  using (owner_user_id = auth.uid());

create policy cloud_appdata_snapshots_insert_own_rows
  on public.cloud_appdata_snapshots
  for insert
  with check (owner_user_id = auth.uid() and account_id = owner_user_id);

create policy cloud_sync_operations_select_own_rows
  on public.cloud_sync_operations
  for select
  using (owner_user_id = auth.uid());

create policy cloud_sync_operations_insert_own_rows
  on public.cloud_sync_operations
  for insert
  with check (owner_user_id = auth.uid() and account_id = owner_user_id);

create policy cloud_devices_select_own_rows
  on public.cloud_devices
  for select
  using (owner_user_id = auth.uid());

create policy cloud_devices_insert_own_rows
  on public.cloud_devices
  for insert
  with check (owner_user_id = auth.uid() and account_id = owner_user_id);

create policy cloud_conflicts_select_own_rows
  on public.cloud_conflicts
  for select
  using (owner_user_id = auth.uid());

create policy cloud_conflicts_insert_own_rows
  on public.cloud_conflicts
  for insert
  with check (owner_user_id = auth.uid() and account_id = owner_user_id);

create policy cloud_export_delete_requests_select_own_rows
  on public.cloud_export_delete_requests
  for select
  using (owner_user_id = auth.uid());

create policy cloud_export_delete_requests_insert_own_rows
  on public.cloud_export_delete_requests
  for insert
  with check (owner_user_id = auth.uid() and account_id = owner_user_id);

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PHASE19D_SUPABASE_MIGRATION_FILE,
  buildPhase19dSupabaseMigrationLocalTypeContracts,
  validatePhase19dSupabaseMigrationLocalTypeContracts,
} from '../src/cloudProduction/supabaseMigrationLocalTypeContracts';
import { SUPABASE_DATA_MODEL_RLS_REQUIRED_TABLES } from '../src/cloudProduction/supabaseDataModelRlsContract';
import { repoRoot } from './runtimeBoundaryTestHelpers';

const nowIso = '2026-05-24T20:00:00.000Z';

const readMigration = () => readFileSync(resolve(repoRoot(), PHASE19D_SUPABASE_MIGRATION_FILE), 'utf8');

describe('supabase migration local type contracts', () => {
  it('declares the exact 19D migration file and local table contracts', () => {
    const contract = buildPhase19dSupabaseMigrationLocalTypeContracts({ nowIso });

    expect(contract).toMatchObject({
      id: `phase19d-supabase-migration-types-${nowIso}`,
      ok: true,
      status: 'migration_contract_ready',
      migrationFile: PHASE19D_SUPABASE_MIGRATION_FILE,
      productScope: 'single-user-multi-device',
      sourceOfTruth: 'localStorage',
      createdAt: nowIso,
    });
    expect(contract.tables.map((table) => table.name)).toEqual(SUPABASE_DATA_MODEL_RLS_REQUIRED_TABLES);
    expect(contract.gates).toMatchObject({
      migrationFilesCreated: true,
      sqlApplied: false,
      supabaseClientCreated: false,
      authRuntimeEnabled: false,
      syncRuntimeEnabled: false,
      sourceOfTruthChanged: false,
      localDataChanged: false,
      cloudDataChanged: false,
    });
  });

  it('keeps local row contracts aligned to required ownership and AppData fields', () => {
    const contract = buildPhase19dSupabaseMigrationLocalTypeContracts({ nowIso });
    const snapshot = contract.tables.find((table) => table.name === 'cloud_appdata_snapshots');

    expect(snapshot?.columns.map((column) => column.name)).toEqual(expect.arrayContaining([
      'id',
      'account_id',
      'owner_user_id',
      'device_id',
      'local_owner_id',
      'source_snapshot_hash',
      'schema_version',
      'operation_id',
      'app_data',
      'validation_status',
      'created_at',
    ]));
    expect(snapshot?.columns.find((column) => column.name === 'app_data')).toMatchObject({
      tsType: 'Phase19dSupabaseJson',
      required: true,
    });
  });

  it('adds SQL for candidate tables and RLS policies without destructive operations', () => {
    const sql = readMigration();

    for (const expected of [
      'create table if not exists public.cloud_appdata_snapshots',
      'create table if not exists public.cloud_sync_operations',
      'create table if not exists public.cloud_devices',
      'create table if not exists public.cloud_conflicts',
      'create table if not exists public.cloud_export_delete_requests',
      'alter table public.cloud_appdata_snapshots enable row level security',
      'owner_user_id = auth.uid()',
      'with check (owner_user_id = auth.uid() and account_id = owner_user_id)',
    ]) {
      expect(sql).toContain(expected);
    }

    for (const forbidden of [
      'drop table',
      'truncate table',
      'delete from',
      'training_sessions',
      'training_sets',
      'training_exercises',
      'service_role',
    ]) {
      expect(sql.toLowerCase()).not.toContain(forbidden);
    }
  });

  it('validates complete migration/type contracts and fails closed when required pieces are missing', () => {
    const contract = buildPhase19dSupabaseMigrationLocalTypeContracts({ nowIso });

    expect(validatePhase19dSupabaseMigrationLocalTypeContracts(contract)).toEqual({
      ok: true,
      status: 'migration_contract_ready',
      blockingErrors: [],
    });

    expect(validatePhase19dSupabaseMigrationLocalTypeContracts({
      ...contract,
      migrationFile: 'supabase/migrations/other.sql',
    })).toMatchObject({
      ok: false,
      status: 'migration_contract_blocked',
      blockingErrors: ['migration_file_mismatch'],
    });

    expect(validatePhase19dSupabaseMigrationLocalTypeContracts({
      ...contract,
      tables: contract.tables.filter((table) => table.name !== 'cloud_conflicts'),
    })).toMatchObject({
      ok: false,
      status: 'migration_contract_blocked',
      blockingErrors: ['required_table_missing'],
    });
  });
});

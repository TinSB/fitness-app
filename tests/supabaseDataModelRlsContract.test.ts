import { describe, expect, it } from 'vitest';
import {
  buildSupabaseDataModelRlsContract,
  SUPABASE_DATA_MODEL_RLS_REQUIRED_TABLES,
  validateSupabaseDataModelRlsContract,
} from '../src/cloudProduction/supabaseDataModelRlsContract';

const nowIso = '2026-05-24T16:00:00.000Z';

describe('supabase data model rls contract', () => {
  it('defines the required document-first cloud tables', () => {
    const contract = buildSupabaseDataModelRlsContract({ nowIso });

    expect(contract).toMatchObject({
      id: `phase19c-supabase-data-model-rls-${nowIso}`,
      ok: true,
      status: 'contract_ready',
      productScope: 'single-user-multi-device',
      sourceOfTruth: 'localStorage',
      createdAt: nowIso,
    });
    expect(contract.tables.map((table) => table.name)).toEqual(SUPABASE_DATA_MODEL_RLS_REQUIRED_TABLES);
    expect(contract.blockedModelingPaths).toEqual(expect.arrayContaining([
      'normalized_training_tables',
      'partial_training_table_migration',
      'last_write_wins',
    ]));
  });

  it('keeps cloud_appdata_snapshots document-first with ownership and snapshot metadata', () => {
    const contract = buildSupabaseDataModelRlsContract({ nowIso });
    const snapshot = contract.tables.find((table) => table.name === 'cloud_appdata_snapshots');

    expect(snapshot).toBeDefined();
    expect(snapshot).toMatchObject({
      purpose: 'validated AppData document snapshots for one owner account',
      documentFirst: true,
      normalizedTrainingTable: false,
      deletePolicy: 'blocked_until_explicit_data_lifecycle',
    });
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
      kind: 'jsonb',
      required: true,
      containsAppData: true,
    });
  });

  it('requires owner-scoped RLS policies on every future table', () => {
    const contract = buildSupabaseDataModelRlsContract({ nowIso });

    for (const table of contract.tables) {
      expect(table.rls.enabled).toBe(true);
      expect(table.rls.serviceRoleAllowedInBrowser).toBe(false);
      expect(table.rls.policies.map((policy) => policy.operation)).toEqual(expect.arrayContaining([
        'select',
        'insert',
      ]));
      expect(table.rls.policies.map((policy) => policy.usesAuthUid)).toEqual(
        expect.arrayContaining([true]),
      );
      expect(table.rls.policies.map((policy) => policy.ownerCheck)).toEqual(
        expect.arrayContaining(['owner_user_id = auth.uid()']),
      );
      expect(table.rls.policies.map((policy) => policy.accountOwnerCheck)).toEqual(
        expect.arrayContaining(['account_id = owner_user_id']),
      );
    }
  });

  it('returns contract-only gates without creating migrations or runtime behavior', () => {
    const contract = buildSupabaseDataModelRlsContract({ nowIso });

    expect(contract.gates).toMatchObject({
      migrationFilesCreated: false,
      sqlApplied: false,
      supabaseClientCreated: false,
      authRuntimeEnabled: false,
      syncRuntimeEnabled: false,
      sourceOfTruthChanged: false,
      localDataChanged: false,
      cloudDataChanged: false,
      packageChanged: false,
      appDataSchemaChanged: false,
      trainingSessionSchemaChanged: false,
    });
    expect(contract.nextPhase).toBe('19D - Supabase Migration Files + Local Type Contracts V1');
  });

  it('validates complete contracts and fails closed when tables or RLS policies are missing', () => {
    const contract = buildSupabaseDataModelRlsContract({ nowIso });

    expect(validateSupabaseDataModelRlsContract(contract)).toEqual({
      ok: true,
      status: 'contract_ready',
      blockingErrors: [],
    });

    const missingTable = {
      ...contract,
      tables: contract.tables.filter((table) => table.name !== 'cloud_devices'),
    };
    expect(validateSupabaseDataModelRlsContract(missingTable)).toMatchObject({
      ok: false,
      status: 'contract_blocked',
      blockingErrors: ['required_table_missing'],
    });

    const missingRls = {
      ...contract,
      tables: contract.tables.map((table) =>
        table.name === 'cloud_appdata_snapshots'
          ? { ...table, rls: { ...table.rls, enabled: false } }
          : table,
      ),
    };
    expect(validateSupabaseDataModelRlsContract(missingRls)).toMatchObject({
      ok: false,
      status: 'contract_blocked',
      blockingErrors: ['rls_required'],
    });
  });

  it('rejects normalized training tables and service role browser exposure', () => {
    const contract = buildSupabaseDataModelRlsContract({ nowIso });
    const unsafe = {
      ...contract,
      tables: [
        ...contract.tables,
        {
          ...contract.tables[0],
          name: 'training_sessions',
          normalizedTrainingTable: true,
        },
      ],
    };

    expect(validateSupabaseDataModelRlsContract(unsafe)).toMatchObject({
      ok: false,
      status: 'contract_blocked',
      blockingErrors: ['normalized_training_table_blocked'],
    });

    const serviceRoleUnsafe = {
      ...contract,
      tables: contract.tables.map((table) =>
        table.name === 'cloud_sync_operations'
          ? { ...table, rls: { ...table.rls, serviceRoleAllowedInBrowser: true } }
          : table,
      ),
    };

    expect(validateSupabaseDataModelRlsContract(serviceRoleUnsafe)).toMatchObject({
      ok: false,
      status: 'contract_blocked',
      blockingErrors: ['service_role_browser_blocked'],
    });
  });
});

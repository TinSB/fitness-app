import { SUPABASE_DATA_MODEL_RLS_REQUIRED_TABLES } from './supabaseDataModelRlsContract';

export const PHASE19D_SUPABASE_MIGRATION_FILE =
  'supabase/migrations/20260524000000_phase19d_appdata_snapshot.sql';

export type Phase19dSupabaseJson =
  | null
  | boolean
  | number
  | string
  | Phase19dSupabaseJson[]
  | { [key: string]: Phase19dSupabaseJson };

export type Phase19dCloudAppDataSnapshotRow = {
  id: string;
  account_id: string;
  owner_user_id: string;
  device_id: string;
  local_owner_id: string;
  source_snapshot_hash: string;
  schema_version: number;
  operation_id: string;
  app_data: Phase19dSupabaseJson;
  validation_status: 'valid' | 'invalid' | 'pending_review';
  created_at: string;
};

export type Phase19dCloudSyncOperationRow = {
  id: string;
  account_id: string;
  owner_user_id: string;
  device_id: string;
  local_owner_id: string;
  operation_id: string;
  operation_type: 'migration_dry_run' | 'read_mirror' | 'write_shadow' | 'explicit_sync';
  source_snapshot_hash: string;
  status: 'candidate' | 'accepted_shadow' | 'rejected' | 'conflict' | 'rolled_back';
  created_at: string;
};

export type Phase19dCloudDeviceRow = {
  id: string;
  account_id: string;
  owner_user_id: string;
  device_id: string;
  local_owner_id: string;
  device_label: string | null;
  trusted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type Phase19dCloudConflictRow = {
  id: string;
  account_id: string;
  owner_user_id: string;
  device_id: string;
  local_owner_id: string;
  local_snapshot_hash: string;
  cloud_snapshot_hash: string;
  conflict_type: 'owner_mismatch' | 'both_changed_offline' | 'stale_revision' | 'device_clock_mismatch';
  resolution_status: 'pending_review' | 'keep_local' | 'keep_cloud' | 'manual_merge' | 'dismissed';
  created_at: string;
};

export type Phase19dCloudExportDeleteRequestRow = {
  id: string;
  account_id: string;
  owner_user_id: string;
  device_id: string;
  local_owner_id: string;
  request_type: 'export' | 'delete_cloud_data';
  status: 'pending_confirmation' | 'confirmed' | 'completed' | 'cancelled';
  confirmed_at: string | null;
  created_at: string;
};

export type Phase19dSupabaseTableName = (typeof SUPABASE_DATA_MODEL_RLS_REQUIRED_TABLES)[number];

export type Phase19dSupabaseColumnContract = {
  name: string;
  sqlType: string;
  tsType: string;
  required: boolean;
};

export type Phase19dSupabaseTableContract = {
  name: Phase19dSupabaseTableName;
  rowTypeName: string;
  columns: Phase19dSupabaseColumnContract[];
};

export type Phase19dSupabaseMigrationTypeGates = {
  migrationFilesCreated: true;
  sqlApplied: false;
  supabaseClientCreated: false;
  authRuntimeEnabled: false;
  syncRuntimeEnabled: false;
  sourceOfTruthChanged: false;
  localDataChanged: false;
  cloudDataChanged: false;
  packageChanged: false;
  appDataSchemaChanged: false;
  trainingSessionSchemaChanged: false;
};

export type Phase19dSupabaseMigrationTypeStatus =
  | 'migration_contract_ready'
  | 'migration_contract_blocked';

export type Phase19dSupabaseMigrationTypeBlockingError =
  | 'migration_file_mismatch'
  | 'required_table_missing'
  | 'appdata_json_contract_missing'
  | 'ownership_columns_missing';

export type Phase19dSupabaseMigrationLocalTypeContracts = {
  id: string;
  ok: boolean;
  status: Phase19dSupabaseMigrationTypeStatus;
  migrationFile: string;
  productScope: 'single-user-multi-device';
  sourceOfTruth: 'localStorage';
  tables: Phase19dSupabaseTableContract[];
  gates: Phase19dSupabaseMigrationTypeGates;
  blockingErrors: Phase19dSupabaseMigrationTypeBlockingError[];
  nextPhase: '19E - Auth Client Skeleton + Env Guard V1';
  createdAt: string;
};

export type Phase19dSupabaseMigrationLocalTypeContractsInput = {
  nowIso?: string;
};

export type Phase19dSupabaseMigrationLocalTypeValidationResult = {
  ok: boolean;
  status: Phase19dSupabaseMigrationTypeStatus;
  blockingErrors: Phase19dSupabaseMigrationTypeBlockingError[];
};

const ownershipColumns = (): Phase19dSupabaseColumnContract[] => [
  { name: 'id', sqlType: 'uuid', tsType: 'string', required: true },
  { name: 'account_id', sqlType: 'uuid', tsType: 'string', required: true },
  { name: 'owner_user_id', sqlType: 'uuid', tsType: 'string', required: true },
  { name: 'device_id', sqlType: 'uuid', tsType: 'string', required: true },
  { name: 'local_owner_id', sqlType: 'text', tsType: 'string', required: true },
];

const createdAtColumn = (): Phase19dSupabaseColumnContract => ({
  name: 'created_at',
  sqlType: 'timestamptz',
  tsType: 'string',
  required: true,
});

const table = (
  name: Phase19dSupabaseTableName,
  rowTypeName: string,
  columns: Phase19dSupabaseColumnContract[],
): Phase19dSupabaseTableContract => ({
  name,
  rowTypeName,
  columns: [...ownershipColumns(), ...columns, createdAtColumn()],
});

const buildTables = (): Phase19dSupabaseTableContract[] => [
  table('cloud_appdata_snapshots', 'Phase19dCloudAppDataSnapshotRow', [
    { name: 'source_snapshot_hash', sqlType: 'text', tsType: 'string', required: true },
    { name: 'schema_version', sqlType: 'integer', tsType: 'number', required: true },
    { name: 'operation_id', sqlType: 'text', tsType: 'string', required: true },
    { name: 'app_data', sqlType: 'jsonb', tsType: 'Phase19dSupabaseJson', required: true },
    { name: 'validation_status', sqlType: 'text', tsType: 'Phase19dCloudAppDataSnapshotRow["validation_status"]', required: true },
  ]),
  table('cloud_sync_operations', 'Phase19dCloudSyncOperationRow', [
    { name: 'operation_id', sqlType: 'text', tsType: 'string', required: true },
    { name: 'operation_type', sqlType: 'text', tsType: 'Phase19dCloudSyncOperationRow["operation_type"]', required: true },
    { name: 'source_snapshot_hash', sqlType: 'text', tsType: 'string', required: true },
    { name: 'status', sqlType: 'text', tsType: 'Phase19dCloudSyncOperationRow["status"]', required: true },
  ]),
  table('cloud_devices', 'Phase19dCloudDeviceRow', [
    { name: 'device_label', sqlType: 'text', tsType: 'string | null', required: false },
    { name: 'trusted_at', sqlType: 'timestamptz', tsType: 'string | null', required: false },
    { name: 'revoked_at', sqlType: 'timestamptz', tsType: 'string | null', required: false },
  ]),
  table('cloud_conflicts', 'Phase19dCloudConflictRow', [
    { name: 'local_snapshot_hash', sqlType: 'text', tsType: 'string', required: true },
    { name: 'cloud_snapshot_hash', sqlType: 'text', tsType: 'string', required: true },
    { name: 'conflict_type', sqlType: 'text', tsType: 'Phase19dCloudConflictRow["conflict_type"]', required: true },
    { name: 'resolution_status', sqlType: 'text', tsType: 'Phase19dCloudConflictRow["resolution_status"]', required: true },
  ]),
  table('cloud_export_delete_requests', 'Phase19dCloudExportDeleteRequestRow', [
    { name: 'request_type', sqlType: 'text', tsType: 'Phase19dCloudExportDeleteRequestRow["request_type"]', required: true },
    { name: 'status', sqlType: 'text', tsType: 'Phase19dCloudExportDeleteRequestRow["status"]', required: true },
    { name: 'confirmed_at', sqlType: 'timestamptz', tsType: 'string | null', required: false },
  ]),
];

const hasOwnershipColumns = (tableContract: Phase19dSupabaseTableContract): boolean => {
  const names = new Set(tableContract.columns.map((column) => column.name));
  return ['account_id', 'owner_user_id', 'device_id', 'local_owner_id'].every((name) => names.has(name));
};

export const validatePhase19dSupabaseMigrationLocalTypeContracts = (
  contract: Pick<Phase19dSupabaseMigrationLocalTypeContracts, 'migrationFile' | 'tables'>,
): Phase19dSupabaseMigrationLocalTypeValidationResult => {
  const blockingErrors = new Set<Phase19dSupabaseMigrationTypeBlockingError>();
  if (contract.migrationFile !== PHASE19D_SUPABASE_MIGRATION_FILE) {
    blockingErrors.add('migration_file_mismatch');
  }

  const tableNames = new Set(contract.tables.map((tableContract) => tableContract.name));
  for (const requiredTable of SUPABASE_DATA_MODEL_RLS_REQUIRED_TABLES) {
    if (!tableNames.has(requiredTable)) blockingErrors.add('required_table_missing');
  }

  const appDataSnapshot = contract.tables.find((tableContract) => tableContract.name === 'cloud_appdata_snapshots');
  const appDataColumn = appDataSnapshot?.columns.find((column) => column.name === 'app_data');
  if (!appDataColumn || appDataColumn.tsType !== 'Phase19dSupabaseJson') {
    blockingErrors.add('appdata_json_contract_missing');
  }

  if (contract.tables.some((tableContract) => !hasOwnershipColumns(tableContract))) {
    blockingErrors.add('ownership_columns_missing');
  }

  const errors = [...blockingErrors];
  return {
    ok: errors.length === 0,
    status: errors.length === 0 ? 'migration_contract_ready' : 'migration_contract_blocked',
    blockingErrors: errors,
  };
};

export const buildPhase19dSupabaseMigrationLocalTypeContracts = (
  input: Phase19dSupabaseMigrationLocalTypeContractsInput = {},
): Phase19dSupabaseMigrationLocalTypeContracts => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const tables = buildTables();
  const validation = validatePhase19dSupabaseMigrationLocalTypeContracts({
    migrationFile: PHASE19D_SUPABASE_MIGRATION_FILE,
    tables,
  });

  return {
    id: `phase19d-supabase-migration-types-${createdAt}`,
    ok: validation.ok,
    status: validation.status,
    migrationFile: PHASE19D_SUPABASE_MIGRATION_FILE,
    productScope: 'single-user-multi-device',
    sourceOfTruth: 'localStorage',
    tables,
    gates: {
      migrationFilesCreated: true,
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
    },
    blockingErrors: validation.blockingErrors,
    nextPhase: '19E - Auth Client Skeleton + Env Guard V1',
    createdAt,
  };
};

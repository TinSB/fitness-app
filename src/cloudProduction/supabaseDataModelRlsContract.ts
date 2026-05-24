export const SUPABASE_DATA_MODEL_RLS_REQUIRED_TABLES = [
  'cloud_appdata_snapshots',
  'cloud_sync_operations',
  'cloud_devices',
  'cloud_conflicts',
  'cloud_export_delete_requests',
] as const;

export type SupabaseDataModelRlsTableName = (typeof SUPABASE_DATA_MODEL_RLS_REQUIRED_TABLES)[number];

export type SupabaseDataModelRlsColumnKind =
  | 'uuid'
  | 'text'
  | 'jsonb'
  | 'integer'
  | 'timestamp'
  | 'enum';

export type SupabaseDataModelRlsPolicyOperation = 'select' | 'insert' | 'update' | 'delete';

export type SupabaseDataModelRlsContractStatus = 'contract_ready' | 'contract_blocked';

export type SupabaseDataModelRlsBlockingError =
  | 'required_table_missing'
  | 'rls_required'
  | 'owner_policy_missing'
  | 'account_owner_policy_missing'
  | 'service_role_browser_blocked'
  | 'normalized_training_table_blocked'
  | 'delete_policy_not_blocked';

export type SupabaseDataModelRlsColumnContract = {
  name: string;
  kind: SupabaseDataModelRlsColumnKind;
  required: boolean;
  ownershipField?: boolean;
  snapshotMetadata?: boolean;
  containsAppData?: boolean;
};

export type SupabaseDataModelRlsPolicyContract = {
  name: string;
  operation: SupabaseDataModelRlsPolicyOperation;
  usesAuthUid: boolean;
  ownerCheck: 'owner_user_id = auth.uid()';
  accountOwnerCheck: 'account_id = owner_user_id';
  deviceCheck?: 'device_id belongs to account_id';
  draftOnly: true;
};

export type SupabaseDataModelRlsTableContract = {
  name: string;
  purpose: string;
  documentFirst: boolean;
  normalizedTrainingTable: boolean;
  deletePolicy: 'blocked_until_explicit_data_lifecycle';
  columns: SupabaseDataModelRlsColumnContract[];
  rls: {
    enabled: boolean;
    serviceRoleAllowedInBrowser: boolean;
    policies: SupabaseDataModelRlsPolicyContract[];
  };
};

export type SupabaseDataModelRlsGates = {
  migrationFilesCreated: false;
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

export type SupabaseDataModelRlsContract = {
  id: string;
  ok: boolean;
  status: SupabaseDataModelRlsContractStatus;
  productScope: 'single-user-multi-device';
  sourceOfTruth: 'localStorage';
  candidateArchitecture: 'Supabase Auth + Supabase Postgres + RLS';
  tables: SupabaseDataModelRlsTableContract[];
  blockedModelingPaths: Array<
    | 'normalized_training_tables'
    | 'partial_training_table_migration'
    | 'last_write_wins'
    | 'browser_service_role'
    | 'default_cloud_sync'
  >;
  gates: SupabaseDataModelRlsGates;
  blockingErrors: SupabaseDataModelRlsBlockingError[];
  nextPhase: '19D - Supabase Migration Files + Local Type Contracts V1';
  createdAt: string;
};

export type SupabaseDataModelRlsValidationResult = {
  ok: boolean;
  status: SupabaseDataModelRlsContractStatus;
  blockingErrors: SupabaseDataModelRlsBlockingError[];
};

export type SupabaseDataModelRlsContractInput = {
  nowIso?: string;
};

const ownerColumns: SupabaseDataModelRlsColumnContract[] = [
  { name: 'account_id', kind: 'uuid', required: true, ownershipField: true },
  { name: 'owner_user_id', kind: 'uuid', required: true, ownershipField: true },
  { name: 'device_id', kind: 'uuid', required: true, ownershipField: true },
  { name: 'local_owner_id', kind: 'text', required: true, ownershipField: true },
];

const baseColumns = (): SupabaseDataModelRlsColumnContract[] => [
  { name: 'id', kind: 'uuid', required: true },
  ...ownerColumns,
  { name: 'created_at', kind: 'timestamp', required: true, snapshotMetadata: true },
];

const ownerPolicies = (tableName: string): SupabaseDataModelRlsPolicyContract[] => [
  {
    name: `${tableName}_select_own_rows`,
    operation: 'select',
    usesAuthUid: true,
    ownerCheck: 'owner_user_id = auth.uid()',
    accountOwnerCheck: 'account_id = owner_user_id',
    deviceCheck: 'device_id belongs to account_id',
    draftOnly: true,
  },
  {
    name: `${tableName}_insert_own_rows`,
    operation: 'insert',
    usesAuthUid: true,
    ownerCheck: 'owner_user_id = auth.uid()',
    accountOwnerCheck: 'account_id = owner_user_id',
    deviceCheck: 'device_id belongs to account_id',
    draftOnly: true,
  },
];

const table = (
  name: SupabaseDataModelRlsTableName,
  purpose: string,
  columns: SupabaseDataModelRlsColumnContract[],
): SupabaseDataModelRlsTableContract => ({
  name,
  purpose,
  documentFirst: name === 'cloud_appdata_snapshots',
  normalizedTrainingTable: false,
  deletePolicy: 'blocked_until_explicit_data_lifecycle',
  columns: [...baseColumns(), ...columns],
  rls: {
    enabled: true,
    serviceRoleAllowedInBrowser: false,
    policies: ownerPolicies(name),
  },
});

const buildTables = (): SupabaseDataModelRlsTableContract[] => [
  table('cloud_appdata_snapshots', 'validated AppData document snapshots for one owner account', [
    { name: 'source_snapshot_hash', kind: 'text', required: true, snapshotMetadata: true },
    { name: 'schema_version', kind: 'integer', required: true, snapshotMetadata: true },
    { name: 'operation_id', kind: 'text', required: true, snapshotMetadata: true },
    { name: 'app_data', kind: 'jsonb', required: true, containsAppData: true },
    { name: 'validation_status', kind: 'enum', required: true, snapshotMetadata: true },
  ]),
  table('cloud_sync_operations', 'idempotency and manual review journal for future sync operations', [
    { name: 'operation_id', kind: 'text', required: true, snapshotMetadata: true },
    { name: 'operation_type', kind: 'enum', required: true },
    { name: 'source_snapshot_hash', kind: 'text', required: true, snapshotMetadata: true },
    { name: 'status', kind: 'enum', required: true },
  ]),
  table('cloud_devices', 'owner devices allowed to participate in the same account candidate', [
    { name: 'device_label', kind: 'text', required: false },
    { name: 'trusted_at', kind: 'timestamp', required: false },
    { name: 'revoked_at', kind: 'timestamp', required: false },
  ]),
  table('cloud_conflicts', 'manual conflict review records for local and cloud snapshot divergence', [
    { name: 'local_snapshot_hash', kind: 'text', required: true, snapshotMetadata: true },
    { name: 'cloud_snapshot_hash', kind: 'text', required: true, snapshotMetadata: true },
    { name: 'conflict_type', kind: 'enum', required: true },
    { name: 'resolution_status', kind: 'enum', required: true },
  ]),
  table('cloud_export_delete_requests', 'future owner-controlled cloud export and delete lifecycle records', [
    { name: 'request_type', kind: 'enum', required: true },
    { name: 'status', kind: 'enum', required: true },
    { name: 'confirmed_at', kind: 'timestamp', required: false },
  ]),
];

const hasOwnerPolicy = (tableContract: SupabaseDataModelRlsTableContract) =>
  tableContract.rls.policies.some((policy) =>
    policy.usesAuthUid &&
    policy.ownerCheck === 'owner_user_id = auth.uid()' &&
    ['select', 'insert'].includes(policy.operation),
  );

const hasAccountOwnerPolicy = (tableContract: SupabaseDataModelRlsTableContract) =>
  tableContract.rls.policies.some((policy) => policy.accountOwnerCheck === 'account_id = owner_user_id');

export const validateSupabaseDataModelRlsContract = (
  contract: Pick<SupabaseDataModelRlsContract, 'tables'>,
): SupabaseDataModelRlsValidationResult => {
  const blockingErrors = new Set<SupabaseDataModelRlsBlockingError>();
  const tableNames = new Set(contract.tables.map((tableContract) => tableContract.name));

  for (const requiredTable of SUPABASE_DATA_MODEL_RLS_REQUIRED_TABLES) {
    if (!tableNames.has(requiredTable)) blockingErrors.add('required_table_missing');
  }

  for (const tableContract of contract.tables) {
    if (tableContract.normalizedTrainingTable === true) {
      blockingErrors.add('normalized_training_table_blocked');
    }
    if (tableContract.rls.enabled !== true) blockingErrors.add('rls_required');
    if (tableContract.rls.serviceRoleAllowedInBrowser === true) {
      blockingErrors.add('service_role_browser_blocked');
    }
    if (!hasOwnerPolicy(tableContract)) blockingErrors.add('owner_policy_missing');
    if (!hasAccountOwnerPolicy(tableContract)) blockingErrors.add('account_owner_policy_missing');
    if (tableContract.deletePolicy !== 'blocked_until_explicit_data_lifecycle') {
      blockingErrors.add('delete_policy_not_blocked');
    }
  }

  const errors = [...blockingErrors];
  return {
    ok: errors.length === 0,
    status: errors.length === 0 ? 'contract_ready' : 'contract_blocked',
    blockingErrors: errors,
  };
};

export const buildSupabaseDataModelRlsContract = (
  input: SupabaseDataModelRlsContractInput = {},
): SupabaseDataModelRlsContract => {
  const createdAt = input.nowIso ?? new Date().toISOString();
  const tables = buildTables();
  const validation = validateSupabaseDataModelRlsContract({ tables });

  return {
    id: `phase19c-supabase-data-model-rls-${createdAt}`,
    ok: validation.ok,
    status: validation.status,
    productScope: 'single-user-multi-device',
    sourceOfTruth: 'localStorage',
    candidateArchitecture: 'Supabase Auth + Supabase Postgres + RLS',
    tables,
    blockedModelingPaths: [
      'normalized_training_tables',
      'partial_training_table_migration',
      'last_write_wins',
      'browser_service_role',
      'default_cloud_sync',
    ],
    gates: {
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
    },
    blockingErrors: validation.blockingErrors,
    nextPhase: '19D - Supabase Migration Files + Local Type Contracts V1',
    createdAt,
  };
};

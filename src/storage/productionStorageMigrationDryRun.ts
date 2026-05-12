export type ProductionStorageMigrationDryRunInput = {
  source: unknown;
  sourceLabel?: string;
  expectedVersion?: string;
};

export type ProductionStorageMigrationDryRunResult = {
  ok: boolean;
  status: 'passed' | 'blocked';
  sourceLabel: string;
  target: 'dry-run-only';
  writesPerformed: false;
  errors: string[];
  warnings: string[];
  summary: {
    topLevelKeyCount: number;
    hasVersion: boolean;
    expectedVersion?: string;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const runProductionStorageMigrationDryRun = ({
  source,
  sourceLabel = 'synthetic-local-snapshot',
  expectedVersion,
}: ProductionStorageMigrationDryRunInput): ProductionStorageMigrationDryRunResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(source)) {
    errors.push('source must be an object snapshot');
  }

  const snapshot = isRecord(source) ? source : {};
  const topLevelKeys = Object.keys(snapshot);
  const version = snapshot.version;

  if (topLevelKeys.length === 0) {
    warnings.push('source snapshot is empty');
  }

  if (expectedVersion !== undefined && version !== expectedVersion) {
    warnings.push('source version does not match expected version');
  }

  return {
    ok: errors.length === 0,
    status: errors.length === 0 ? 'passed' : 'blocked',
    sourceLabel,
    target: 'dry-run-only',
    writesPerformed: false,
    errors,
    warnings,
    summary: {
      topLevelKeyCount: topLevelKeys.length,
      hasVersion: typeof version === 'string',
      expectedVersion,
    },
  };
};

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { expect } from 'vitest';

export const repoRoot = () => process.cwd();

export const readSource = (path: string) => readFileSync(resolve(repoRoot(), path), 'utf8');

export const collectRuntimeSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectRuntimeSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });

export const relativePath = (path: string) => relative(repoRoot(), path).replaceAll('\\', '/');

const runtimeFilesWithDedicatedBoundaryCoverage = new Set([
  'src/auth/authBoundary.ts',
  'src/auth/authProviderTypes.ts',
  'src/cloudProduction/authClientSkeletonEnvGuard.ts',
  'src/cloudProduction/cloudReadWriteVerificationFlow.ts',
  'src/cloudProduction/cloudParityCheck.ts',
  'src/cloudProduction/cloudReadMirrorVerification.ts',
  'src/cloudProduction/cloudReadMirror.ts',
  'src/cloudProduction/cloudWriteShadowCandidate.ts',
  'src/cloudProduction/cloudWriteShadowMode.ts',
  'src/cloudProduction/conflictOfflineRollbackRuntimeFlow.ts',
  'src/cloudProduction/conflictReview.ts',
  'src/cloudProduction/firstUploadExplicitApply.ts',
  'src/cloudProduction/localBackupDryRunMigrationRuntimeFlow.ts',
  'src/cloudProduction/localBackupDryRunUi.ts',
  'src/cloudProduction/productionAcceptanceSyntheticData.ts',
  'src/cloudProduction/supabaseProjectRuntimeReadinessCheck.ts',
  'src/cloudProduction/supabaseAuthRuntimeAdapter.ts',
  'src/cloudProduction/v0UiPolishHandoffContract.ts',
  'src/uiOs/settings/CloudSyncPolishSettingsPanel.tsx',
  'src/uiOs/settings/cloudSyncAuthActionController.ts',
  'src/uiOs/settings/cloudSyncRuntimeSettingsAdapter.ts',
  'src/storage/apiStorageAdapter.ts',
  'src/storage/apiWriteThroughRuntime.ts',
  'src/storage/bootFromApiSnapshot.ts',
  'src/storage/localStorageToSqliteMigrationApply.ts',
  'src/storage/localStorageToSqliteMigrationDryRun.ts',
  'src/storage/migrationRollbackRecovery.ts',
  'src/storage/runtimeSourceConfig.ts',
  'src/storage/runtimeSourceSelector.ts',
]);

export const collectSrcRuntimeFiles = () =>
  collectRuntimeSourceFiles(resolve(repoRoot(), 'src')).filter(
    (path) => !runtimeFilesWithDedicatedBoundaryCoverage.has(relativePath(path)),
  );

export const expectSourceNotToContain = (path: string, blocked: string[]) => {
  const source = readFileSync(path, 'utf8');
  const offenders = blocked.filter((token) => source.includes(token));
  expect(offenders, `${relativePath(path)} should not contain ${offenders.join(', ')}`).toEqual([]);
};

export const expectNoRawStack = (value: unknown) => {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain('stack');
  expect(serialized).not.toContain('SqliteRepositoryError');
  expect(serialized).not.toContain('Error:');
};

export const expectNoTrackedEnvironmentFiles = () => {
  const tracked = execFileSync('git', ['ls-files', '--', '.env', '.env.local', '.env.production'], {
    cwd: repoRoot(),
    encoding: 'utf8',
  }).trim();

  expect(tracked ? tracked.split(/\r?\n/) : []).toEqual([]);
  expect(existsSync(resolve(repoRoot(), '.env')), '.env should not exist').toBe(false);
  expect(existsSync(resolve(repoRoot(), '.env.production')), '.env.production should not exist').toBe(false);
  expect(readSource('.gitignore')).toMatch(/\.env\*\.local|\.env\.local/);
};

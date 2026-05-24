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
  'src/cloudProduction/cloudReadMirror.ts',
  'src/cloudProduction/cloudWriteShadowMode.ts',
  'src/cloudProduction/supabaseProjectRuntimeReadinessCheck.ts',
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

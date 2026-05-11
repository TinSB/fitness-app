import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const blockedBrowserRoutes = [
  '/sessions/active/patches',
  '/sessions/active/complete',
  '/sessions/active/discard',
  '/data-health/repair/apply',
  '/backup/import',
  '/backup/export',
  '/reset/',
  '/recovery/',
];

describe('session patch mutation browser boundary remains blocked', () => {
  it('does not add session patch browser prototype files in Task 5.13', () => {
    for (const path of [
      'src/devApi/devApiSessionPatchConfig.ts',
      'src/devApi/devApiSessionPatchClient.ts',
      'src/devApi/DevApiSessionPatchPrototype.tsx',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist yet`).toBe(false);
    }
  });

  it('keeps src browser runtime free of session patch, complete, and discard route strings', () => {
    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      const offenders = blockedBrowserRoutes.filter((route) => source.includes(route));
      expect(offenders, `${relativePath(file)} should not expose blocked browser routes`).toEqual([]);
    }
  });

  it('keeps broad mutation client, source selector, and API storage absent', () => {
    for (const path of [
      'src/devApi/devApiMutationClient.ts',
      'src/mutationClient.ts',
      'src/services/mutationClient.ts',
      'src/hooks/useMutationApi.ts',
      'src/api/mutations.ts',
      'src/storage/runtimeSourceSelector.ts',
      'src/storage/apiStorageAdapter.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist`).toBe(false);
    }

    const packageJson = readSource('package.json');
    expect(packageJson).not.toMatch(/playwright|cypress|mutation-client|auth|sync|cloud/i);
  });
});

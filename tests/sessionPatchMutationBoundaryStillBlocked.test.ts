import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { DEV_API_SESSION_COMPLETE_ROUTE } from '../src/devApi/devApiSessionCompleteClient';
import { DEV_API_SESSION_DISCARD_ROUTE } from '../src/devApi/devApiSessionDiscardClient';
import { DEV_API_SESSION_PATCH_ROUTE } from '../src/devApi/devApiSessionPatchClient';
import { DEV_API_SESSION_START_ROUTE } from '../src/devApi/devApiSessionStartClient';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const blockedBrowserRoutes = [
  '/data-health/repair/apply',
  '/backup/import',
  '/backup/export',
  '/reset/',
  '/recovery/',
];

describe('session patch mutation browser boundary remains constrained', () => {
  it('adds the approved session patch, complete, and discard browser prototype files through Task 5.20', () => {
    for (const path of [
      'src/devApi/devApiSessionPatchConfig.ts',
      'src/devApi/devApiSessionPatchClient.ts',
      'src/devApi/DevApiSessionPatchPrototype.tsx',
      'src/devApi/devApiSessionCompleteConfig.ts',
      'src/devApi/devApiSessionCompleteClient.ts',
      'src/devApi/DevApiSessionCompletePrototype.tsx',
      'src/devApi/devApiSessionDiscardConfig.ts',
      'src/devApi/devApiSessionDiscardClient.ts',
      'src/devApi/DevApiSessionDiscardPrototype.tsx',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should exist`).toBe(true);
    }
  });

  it('locks the browser mutation route allowlist to seven routes', () => {
    expect([
      `POST ${DEV_API_DATA_HEALTH_DISMISS_ROUTE}`,
      `POST ${DEV_API_HISTORY_DATA_FLAG_ROUTE}`,
      `POST ${DEV_API_HISTORY_SET_EDIT_ROUTE}`,
      `POST ${DEV_API_SESSION_START_ROUTE}`,
      `POST ${DEV_API_SESSION_PATCH_ROUTE}`,
      `POST ${DEV_API_SESSION_COMPLETE_ROUTE}`,
      `POST ${DEV_API_SESSION_DISCARD_ROUTE}`,
    ]).toEqual([
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
      'POST /sessions/active/discard',
    ]);
  });

  it('keeps src browser runtime free of destructive route strings', () => {
    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      const offenders = blockedBrowserRoutes.filter((route) => source.includes(route));
      expect(offenders, `${relativePath(file)} should not expose blocked browser routes`).toEqual([]);
    }
  });

  it('keeps broad mutation client absent while allowing storage runtime prototypes', () => {
    for (const path of [
      'src/devApi/devApiMutationClient.ts',
      'src/mutationClient.ts',
      'src/services/mutationClient.ts',
      'src/hooks/useMutationApi.ts',
      'src/api/mutations.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist`).toBe(false);
    }
    expect(existsSync(resolve(repoRoot(), 'src/storage/runtimeSourceSelector.ts'))).toBe(true);
    expect(existsSync(resolve(repoRoot(), 'src/storage/runtimeSourceConfig.ts'))).toBe(true);

    expect(
      existsSync(resolve(repoRoot(), 'src/storage/apiStorageAdapter.ts')),
      'Task 5.24 API storage adapter may exist default-off',
    ).toBe(true);

    const packageJson = readSource('package.json');
    expect(packageJson).not.toMatch(/playwright|cypress|mutation-client|auth|sync|cloud/i);
  });
});

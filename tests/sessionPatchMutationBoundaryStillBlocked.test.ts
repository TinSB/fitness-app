import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { DEV_API_SESSION_PATCH_ROUTE } from '../src/devApi/devApiSessionPatchClient';
import { DEV_API_SESSION_START_ROUTE } from '../src/devApi/devApiSessionStartClient';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const blockedBrowserRoutes = [
  '/sessions/active/complete',
  '/sessions/active/discard',
  '/data-health/repair/apply',
  '/backup/import',
  '/backup/export',
  '/reset/',
  '/recovery/',
];

describe('session patch mutation browser boundary remains constrained', () => {
  it('adds only the approved session patch browser prototype files in Task 5.14', () => {
    for (const path of [
      'src/devApi/devApiSessionPatchConfig.ts',
      'src/devApi/devApiSessionPatchClient.ts',
      'src/devApi/DevApiSessionPatchPrototype.tsx',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should exist`).toBe(true);
    }
    for (const path of [
      'src/devApi/devApiSessionCompleteConfig.ts',
      'src/devApi/devApiSessionCompleteClient.ts',
      'src/devApi/DevApiSessionCompletePrototype.tsx',
      'src/devApi/devApiSessionDiscardConfig.ts',
      'src/devApi/devApiSessionDiscardClient.ts',
      'src/devApi/DevApiSessionDiscardPrototype.tsx',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist yet`).toBe(false);
    }
  });

  it('locks the browser mutation route allowlist to five routes', () => {
    expect([
      `POST ${DEV_API_DATA_HEALTH_DISMISS_ROUTE}`,
      `POST ${DEV_API_HISTORY_DATA_FLAG_ROUTE}`,
      `POST ${DEV_API_HISTORY_SET_EDIT_ROUTE}`,
      `POST ${DEV_API_SESSION_START_ROUTE}`,
      `POST ${DEV_API_SESSION_PATCH_ROUTE}`,
    ]).toEqual([
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
    ]);
  });

  it('keeps src browser runtime free of session complete and discard route strings', () => {
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

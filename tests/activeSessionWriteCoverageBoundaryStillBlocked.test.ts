import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { DEV_API_HISTORY_DATA_FLAG_ROUTE } from '../src/devApi/devApiHistoryDataFlagClient';
import { DEV_API_HISTORY_SET_EDIT_ROUTE } from '../src/devApi/devApiHistorySetEditClient';
import { DEV_API_SESSION_COMPLETE_ROUTE } from '../src/devApi/devApiSessionCompleteClient';
import { DEV_API_SESSION_PATCH_ROUTE } from '../src/devApi/devApiSessionPatchClient';
import { DEV_API_SESSION_START_ROUTE } from '../src/devApi/devApiSessionStartClient';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const approvedMutationFiles = new Set([
  'src/devApi/devApiDataHealthDismissClient.ts',
  'src/devApi/devApiDataHealthDismissConfig.ts',
  'src/devApi/DevApiDataHealthDismissPrototype.tsx',
  'src/devApi/devApiHistoryDataFlagClient.ts',
  'src/devApi/devApiHistoryDataFlagConfig.ts',
  'src/devApi/DevApiHistoryDataFlagPrototype.tsx',
  'src/devApi/devApiHistorySetEditClient.ts',
  'src/devApi/devApiHistorySetEditConfig.ts',
  'src/devApi/DevApiHistorySetEditExperiment.tsx',
  'src/devApi/devApiSessionStartClient.ts',
  'src/devApi/devApiSessionStartConfig.ts',
  'src/devApi/DevApiSessionStartPrototype.tsx',
  'src/devApi/devApiSessionPatchClient.ts',
  'src/devApi/devApiSessionPatchConfig.ts',
  'src/devApi/DevApiSessionPatchPrototype.tsx',
  'src/devApi/devApiSessionCompleteClient.ts',
  'src/devApi/devApiSessionCompleteConfig.ts',
  'src/devApi/DevApiSessionCompletePrototype.tsx',
]);

const blockedBrowserRoutes = [
  '/sessions/active/discard',
  '/data-health/repair/apply',
  '/backup/import',
  '/backup/export',
  '/reset/',
  '/recovery/',
];

const blockedNodeOnlyTokens = [
  'node:http',
  'node:sqlite',
  'devLauncher',
  'httpRuntimeAdapter',
  'serverAdapter',
  'sqliteRepository',
  'devApiRunner',
  'devDbRecovery',
];

describe('active session write coverage browser boundary remains blocked', () => {
  it('keeps accepted browser mutation routes exactly six after session complete prototype', () => {
    expect([
      `POST ${DEV_API_DATA_HEALTH_DISMISS_ROUTE}`,
      `POST ${DEV_API_HISTORY_DATA_FLAG_ROUTE}`,
      `POST ${DEV_API_HISTORY_SET_EDIT_ROUTE}`,
      `POST ${DEV_API_SESSION_START_ROUTE}`,
      `POST ${DEV_API_SESSION_PATCH_ROUTE}`,
      `POST ${DEV_API_SESSION_COMPLETE_ROUTE}`,
    ]).toEqual([
      'POST /data-health/issues/:issueId/dismiss',
      'POST /history/:id/data-flag',
      'POST /history/:id/edit',
      'POST /sessions/start',
      'POST /sessions/active/patches',
      'POST /sessions/active/complete',
    ]);
  });

  it('keeps browser runtime free of complete, discard, and other blocked routes', () => {
    for (const file of collectSrcRuntimeFiles()) {
      const path = relativePath(file);
      const source = stripComments(readFileSync(file, 'utf8'));
      const routeOffenders = blockedBrowserRoutes.filter((route) => source.includes(route));
      expect(routeOffenders, `${path} should not expose blocked browser routes`).toEqual([]);

      if (!approvedMutationFiles.has(path)) {
        expect(source, `${path} should not add browser write methods`).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
      }
    }
  });

  it('adds only session patch and complete devApi browser prototype files and keeps discard absent', () => {
    for (const path of [
      'src/devApi/devApiSessionPatchConfig.ts',
      'src/devApi/devApiSessionPatchClient.ts',
      'src/devApi/DevApiSessionPatchPrototype.tsx',
      'src/devApi/devApiSessionCompleteConfig.ts',
      'src/devApi/devApiSessionCompleteClient.ts',
      'src/devApi/DevApiSessionCompletePrototype.tsx',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should exist after Task 5.14`).toBe(true);
    }

    for (const path of [
      'src/devApi/devApiSessionPatchConfig.ts',
      'src/devApi/devApiSessionPatchClient.ts',
      'src/devApi/DevApiSessionPatchPrototype.tsx',
      'src/devApi/devApiSessionDiscardConfig.ts',
      'src/devApi/devApiSessionDiscardClient.ts',
      'src/devApi/DevApiSessionDiscardPrototype.tsx',
    ].filter((path) => !path.includes('SessionPatch') && !path.includes('SessionComplete'))) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist yet`).toBe(false);
    }
  });

  it('keeps browser source free of Node-only stack and broad mutation clients', () => {
    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      const offenders = blockedNodeOnlyTokens.filter((token) => source.includes(token));
      expect(offenders, `${relativePath(file)} should stay browser-safe`).toEqual([]);
    }

    for (const path of [
      'src/devApi/devApiMutationClient.ts',
      'src/mutationClient.ts',
      'src/services/mutationClient.ts',
      'src/hooks/useMutationApi.ts',
      'src/api/mutations.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist`).toBe(false);
    }

    const packageJson = readSource('package.json');
    expect(packageJson).not.toMatch(/playwright|cypress|mutation-client|auth|sync|cloud/i);
  });
});

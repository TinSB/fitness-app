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
  'src/devApi/devApiSessionDiscardClient.ts',
  'src/devApi/devApiSessionDiscardConfig.ts',
  'src/devApi/DevApiSessionDiscardPrototype.tsx',
]);

const blockedRoutes = [
  '/data-health/repair/apply',
  '/backup/import',
  '/backup/export',
  '/reset/',
  '/recovery/',
];

const nodeOnlyTokens = [
  'node:http',
  'node:sqlite',
  'devLauncher',
  'httpRuntimeAdapter',
  'serverAdapter',
  'sqliteRepository',
  'devApiRunner',
  'devDbRecovery',
];

describe('API-backed persistence facade boundaries remain blocked', () => {
  it('allows only the Task 5.24 default-off adapter and keeps selector, App mount, and source switch blocked', () => {
    expect(existsSync(resolve(repoRoot(), 'src/storage/apiStorageAdapter.ts'))).toBe(true);
    for (const path of [
      'src/storage/runtimeSourceSelector.ts',
      'src/storage/runtimeSourceConfig.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist yet`).toBe(false);
    }

    const app = readSource('src/App.tsx');
    expect(app).not.toMatch(/apiStorageAdapter|runtimeSourceSelector|api-primary-dev|VITE_IRONPATH_RUNTIME_SOURCE/);
    expect(readSource('src/storage/localStorageAdapter.ts')).not.toContain('fetch(');
    expect(readSource('src/storage/persistence.ts')).not.toMatch(/apiStorageAdapter|runtimeSourceSelector|api-primary-dev/);
    expect(readSource('src/storage/apiStorageAdapter.ts')).toContain("API_STORAGE_ADAPTER_RUNTIME_SOURCE = 'api-primary-dev'");
  });

  it('keeps browser mutation routes exactly seven and blocks repair/backup/reset routes', () => {
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

    for (const file of collectSrcRuntimeFiles()) {
      const path = relativePath(file);
      const source = stripComments(readFileSync(file, 'utf8'));
      expect(blockedRoutes.filter((route) => source.includes(route)), `${path} blocked route boundary`).toEqual([]);
      if (!approvedMutationFiles.has(path)) {
        expect(source, `${path} should not add write methods`).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
      }
    }
  });

  it('keeps broad mutation clients, package drift, production flags, and Node-only browser imports blocked', () => {
    for (const path of [
      'src/devApi/devApiMutationClient.ts',
      'src/mutationClient.ts',
      'src/services/mutationClient.ts',
      'src/hooks/useMutationApi.ts',
      'src/api/mutations.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist`).toBe(false);
    }

    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      expect(nodeOnlyTokens.filter((token) => source.includes(token)), `${relativePath(file)} should stay browser-safe`).toEqual([]);
    }

    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const allowedScripts = new Set([
      'dev',
      'api:dev:build',
      'api:dev',
      'build',
      'build:stats',
      'build:size-check',
      'predeploy:check',
      'preview',
      'typecheck',
      'test',
      'test:watch',
    ]);
    expect(Object.keys(packageJson.scripts || {}).filter((script) => !allowedScripts.has(script))).toEqual([]);
    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    expect(Object.keys(deps).filter((name) =>
      /apiStorageAdapter|runtime-source|auth|sync|cloud|playwright|cypress/i.test(name),
    )).toEqual([]);
  });
});

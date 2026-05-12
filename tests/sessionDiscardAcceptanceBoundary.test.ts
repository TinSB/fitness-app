import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
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

const collectFilesIfDirectory = (path: string): string[] => {
  if (!existsSync(path)) return [];
  const stat = statSync(path);
  if (!stat.isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const next = join(path, entry.name);
    if (entry.isDirectory()) return collectFilesIfDirectory(next);
    return [next];
  });
};

describe('session discard acceptance boundary', () => {
  it('keeps accepted browser mutation routes exactly seven', () => {
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

  it('blocks repair, backup, reset, and broad mutation clients', () => {
    for (const file of collectSrcRuntimeFiles()) {
      const path = relativePath(file);
      const source = stripComments(readFileSync(file, 'utf8'));
      expect(blockedRoutes.filter((route) => source.includes(route)), `${path} blocked route boundary`).toEqual([]);
      if (!approvedMutationFiles.has(path)) {
        expect(source, `${path} should not add browser write methods`).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
      }
      expect(nodeOnlyTokens.filter((token) => source.includes(token)), `${path} should stay browser-safe`).toEqual([]);
    }

    for (const path of [
      'src/devApi/devApiMutationClient.ts',
      'src/mutationClient.ts',
      'src/services/mutationClient.ts',
      'src/hooks/useMutationApi.ts',
      'src/api/mutations.ts',
    ]) {
      expect(collectFilesIfDirectory(resolve(repoRoot(), path)), `${path} should not exist`).toEqual([]);
    }
  });

  it('keeps docs, storage, package, and browser build free of source-of-truth switch drift', () => {
    const docs = [
      'docs/SESSION_DISCARD_ACCEPTANCE_HARDENING.md',
      'docs/SESSION_DISCARD_MUTATION_PROTOTYPE_PLAN.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
    ].map(readSource).join('\n');
    const storage = readSource('src/storage/localStorageAdapter.ts') + readSource('src/storage/persistence.ts');

    expect(storage).not.toContain('fetch(');
    expect(storage).not.toContain('/sessions/');
    expect(docs).not.toMatch(/replace localStorage now|make API source of truth now|enable production backend now|enable auth now|enable sync now/i);
    expect(readSource('package.json')).not.toMatch(/playwright|cypress|mutation-client|auth|sync|cloud/i);

    const distFiles = collectFilesIfDirectory(resolve(repoRoot(), 'dist')).filter((path) => /\.(js|html|css|map)$/.test(path));
    const offenders = distFiles.flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return nodeOnlyTokens.filter((token) => source.includes(token)).map((token) => `${relativePath(path)}:${token}`);
    });
    expect(offenders).toEqual([]);
  });
});

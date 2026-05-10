import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_ROUTE } from '../src/devApi/devApiDataHealthDismissClient';
import { createDevApiReadOnlyClient } from '../src/devApi/devApiReadOnlyClient';
import {
  collectSrcRuntimeFiles,
  readSource,
  relativePath,
  repoRoot,
} from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const approvedBrowserMutationFiles = new Set([
  'src/devApi/devApiDataHealthDismissClient.ts',
  'src/devApi/devApiDataHealthDismissConfig.ts',
  'src/devApi/DevApiDataHealthDismissPrototype.tsx',
]);

const forbiddenRoutes = [
  '/sessions/start',
  '/sessions/active/patches',
  '/sessions/active/complete',
  '/sessions/active/discard',
  '/history/:id/edit',
  '/history/:id/data-flag',
  '/data-health/repair/apply',
  '/backup/',
  '/backup/import',
  '/backup/export',
  '/reset/',
  '/recovery/',
];

const broadMutationClientPaths = [
  'src/mutationClient.ts',
  'src/services/mutationClient.ts',
  'src/hooks/useMutationApi.ts',
  'src/api/mutations.ts',
  'src/api/mutations',
];

const collectFilesIfDirectory = (path: string): string[] => {
  if (!existsSync(path)) return [];
  const stat = statSync(path);
  if (!stat.isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const next = join(path, entry.name);
    if (entry.isDirectory()) return collectFilesIfDirectory(next);
    return /\.(ts|tsx)$/.test(entry.name) ? [next] : [];
  });
};

describe('DataHealth dismiss regression route lock', () => {
  it('keeps the approved route constant to DataHealth issue dismiss only', () => {
    expect(DEV_API_DATA_HEALTH_DISMISS_ROUTE).toBe('/data-health/issues/:issueId/dismiss');
  });

  it('keeps browser mutation code one-route-only and non-generic', () => {
    const client = stripComments(readSource('src/devApi/devApiDataHealthDismissClient.ts'));
    const prototype = stripComments(readSource('src/devApi/DevApiDataHealthDismissPrototype.tsx'));

    expect(client).toContain('/data-health/issues/');
    expect(client).toContain('/dismiss');
    expect(client).toContain('method: \'POST\'');
    expect(client).not.toMatch(/request\s*\(\s*method\s*,\s*path/i);
    expect(client).not.toMatch(/method\s*:\s*(method|httpMethod)/i);
    expect(prototype).not.toMatch(/fetch\s*\(/);

    for (const route of forbiddenRoutes) {
      expect(client, route).not.toContain(route);
      expect(prototype, route).not.toContain(route);
    }
  });

  it('blocks forbidden mutation routes and POST usage outside the allowlisted prototype files', () => {
    for (const file of collectSrcRuntimeFiles()) {
      const normalized = relativePath(file);
      const source = stripComments(readFileSync(file, 'utf8'));

      for (const route of forbiddenRoutes) {
        expect(source, `${normalized} should not contain ${route}`).not.toContain(route);
      }

      if (!approvedBrowserMutationFiles.has(normalized)) {
        expect(source, `${normalized} should not contain dismiss mutation route`).not.toContain('/data-health/issues/');
        expect(source, `${normalized} should not issue browser POST`).not.toMatch(/method\s*:\s*['"`]POST['"`]/);
      }
    }
  });

  it('keeps read-only client GET-only and blocks broad mutation clients', () => {
    const readOnlySource = stripComments(readSource('src/devApi/devApiReadOnlyClient.ts'));
    const readOnlyClient = createDevApiReadOnlyClient({
      enabled: true,
      status: 'enabled',
      baseUrl: 'http://127.0.0.1:8787',
      timeoutMs: 1500,
    });

    expect(Object.keys(readOnlyClient)).toEqual([
      'readHealth',
      'readAppDataSummary',
      'readSessionsSummary',
      'readHistory',
      'readHistoryDetail',
      'readDataHealthSummary',
    ]);
    expect(readOnlySource).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
    expect(readOnlySource).not.toContain('/data-health/issues/');

    for (const path of broadMutationClientPaths) {
      expect(collectFilesIfDirectory(resolve(repoRoot(), path)), `${path} should not exist`).toEqual([]);
    }
  });
});

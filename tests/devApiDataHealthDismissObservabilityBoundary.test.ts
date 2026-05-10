import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
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

const productionSrcFiles = () =>
  collectSrcRuntimeFiles().filter((path) => {
    const normalized = relativePath(path);
    return !normalized.includes('/__tests__/') && !normalized.endsWith('.test.ts') && !normalized.endsWith('.test.tsx');
  });

const approvedDismissFiles = new Set([
  'src/devApi/devApiDataHealthDismissClient.ts',
  'src/devApi/devApiDataHealthDismissConfig.ts',
  'src/devApi/DevApiDataHealthDismissPrototype.tsx',
]);

const approvedHistoryDataFlagFiles = new Set([
  'src/devApi/devApiHistoryDataFlagClient.ts',
  'src/devApi/devApiHistoryDataFlagConfig.ts',
  'src/devApi/DevApiHistoryDataFlagPrototype.tsx',
]);

const blockedRoutes = [
  '/sessions/start',
  '/sessions/active/patches',
  '/sessions/active/complete',
  '/sessions/active/discard',
  '/history/:id/edit',
  '/data-health/repair/apply',
  '/backup/',
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

const mutationClientPaths = [
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

describe('DataHealth dismiss observability boundaries', () => {
  it('keeps browser mutation code to the approved one-route client', () => {
    const client = stripComments(readSource('src/devApi/devApiDataHealthDismissClient.ts'));
    const prototype = stripComments(readSource('src/devApi/DevApiDataHealthDismissPrototype.tsx'));

    expect(client).toContain('/data-health/issues/');
    expect(client).toContain('method: \'POST\'');
    expect(client).not.toMatch(/request\s*\(\s*method\s*,\s*path/i);
    expect(client).not.toMatch(/method\s*:\s*method|method\s*:\s*httpMethod/i);
    expect(prototype).not.toMatch(/fetch\s*\(/);

    for (const route of blockedRoutes) {
      expect(client).not.toContain(route);
      expect(prototype).not.toContain(route);
    }
  });

  it('keeps production browser source free of forbidden routes and Node-only stack', () => {
    for (const file of productionSrcFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      const normalized = relativePath(file);

      expect(
        nodeOnlyTokens.filter((token) => source.includes(token)),
        `${normalized} should not include Node-only tokens`,
      ).toEqual([]);

      expect(
        blockedRoutes.filter((route) => source.includes(route)),
        `${normalized} should not include forbidden mutation routes`,
      ).toEqual([]);

      if (!approvedDismissFiles.has(normalized)) {
        expect(source, `${normalized} should not contain DataHealth dismiss route`).not.toContain('/data-health/issues/');
      }
      if (!approvedHistoryDataFlagFiles.has(normalized)) {
        expect(source, `${normalized} should not contain History data-flag route`).not.toContain('/history/:id/data-flag');
        expect(source, `${normalized} should not contain dynamic History data-flag route`).not.toMatch(/\/history\/\$\{[^}]+}\/*data-flag/);
      }
      if (!approvedDismissFiles.has(normalized) && !approvedHistoryDataFlagFiles.has(normalized)) {
        expect(source, `${normalized} should not issue browser POST`).not.toMatch(/method\s*:\s*['"`]POST['"`]/);
      }
    }
  });

  it('keeps read-only client GET-only and does not add broad mutation or API-backed storage', () => {
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

    for (const path of mutationClientPaths) {
      expect(collectFilesIfDirectory(resolve(repoRoot(), path)), `${path} should not exist`).toEqual([]);
    }

    const storage = stripComments(readSource('src/storage/localStorageAdapter.ts'));
    expect(storage).not.toContain('fetch(');
    expect(storage).not.toContain('/data-health/issues/');
  });

  it('keeps package metadata free of mutation/prod/auth/sync/browser automation expansion', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const scripts = Object.keys(packageJson.scripts || {});
    expect(scripts.filter((script) =>
      /mutation|integration|prod|production|auth|sync|playwright|cypress/i.test(script),
    )).toEqual([]);

    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    expect(Object.keys(deps).filter((name) =>
      /fastify|express|koa|hono|trpc|graphql|auth|sync|mutation-client|playwright|cypress/i.test(name),
    )).toEqual([]);
  });
});

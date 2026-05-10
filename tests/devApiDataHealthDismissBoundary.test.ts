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

describe('Dev API DataHealth dismiss prototype boundaries', () => {
  it('keeps browser source free of Node-only imports', () => {
    for (const file of productionSrcFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      const normalized = relativePath(file);
      const nodeOffenders = blockedNodeOnlyTokens.filter((token) => source.includes(token));
      expect(nodeOffenders, `${normalized} should not include Node-only tokens`).toEqual([]);
    }
    const apiIndex = readSource('apps/api/src/index.ts');
    for (const token of blockedNodeOnlyTokens) {
      expect(apiIndex).not.toContain(token);
    }
  });

  it('exposes only the approved browser mutation prototype routes', () => {
    for (const file of productionSrcFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      const normalized = relativePath(file);
      const routeOffenders = blockedRoutes.filter((route) => source.includes(route));
      expect(routeOffenders, `${normalized} should not contain blocked mutation routes`).toEqual([]);

      if (!approvedDismissFiles.has(normalized)) {
        expect(source, `${normalized} should not contain the approved dismiss route`).not.toContain('/data-health/issues/');
      }
      if (!approvedHistoryDataFlagFiles.has(normalized)) {
        expect(source, `${normalized} should not contain the approved history data-flag route`).not.toContain('/history/:id/data-flag');
        expect(source, `${normalized} should not contain dynamic history data-flag route`).not.toMatch(/\/history\/\$\{[^}]+}\/*data-flag/);
      }
      if (!approvedDismissFiles.has(normalized) && !approvedHistoryDataFlagFiles.has(normalized)) {
        expect(source, `${normalized} should not use browser POST`).not.toMatch(/method\s*:\s*['"`]POST['"`]/);
      }
    }
  });

  it('keeps the read-only client GET-only', () => {
    const source = stripComments(readSource('src/devApi/devApiReadOnlyClient.ts'));
    const client = createDevApiReadOnlyClient({
      enabled: true,
      status: 'enabled',
      baseUrl: 'http://127.0.0.1:8787',
      timeoutMs: 1500,
    });

    expect(Object.keys(client)).toEqual([
      'readHealth',
      'readAppDataSummary',
      'readSessionsSummary',
      'readHistory',
      'readHistoryDetail',
      'readDataHealthSummary',
    ]);
    expect(source).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
    expect(source).not.toMatch(/\/data-health\/issues\/|\/sessions\/start|\/sessions\/active|\/history\/:id\/edit|\/data-health\/repair\/apply/);
  });

  it('does not add a broad mutation client, mutation hooks, or API-backed storage', () => {
    for (const path of mutationClientPaths) {
      expect(collectFilesIfDirectory(resolve(repoRoot(), path)), `${path} should not exist`).toEqual([]);
    }

    const adapter = readSource('src/storage/localStorageAdapter.ts');
    expect(adapter).not.toContain('fetch(');
    expect(adapter).not.toContain('/data-health/issues/');
    expect(adapter).not.toContain('DevApiDataHealthDismiss');
  });

  it('does not add blocked package scripts or dependencies', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const scripts = packageJson.scripts || {};
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
    expect(Object.keys(scripts).filter((name) => !allowedScripts.has(name))).toEqual([]);

    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    const blockedDeps = Object.keys(deps).filter((name) =>
      /fastify|express|koa|hono|trpc|graphql|auth|sync|mutation-client|playwright|cypress/i.test(name),
    );
    expect(blockedDeps).toEqual([]);
  });
});

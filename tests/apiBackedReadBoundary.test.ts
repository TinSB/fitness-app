import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_BACKED_READ_ROUTES, createApiBackedReadClient } from '../src/devApi/apiBackedReadClient';
import { collectSrcRuntimeFiles, readSource, relativePath, repoRoot } from './runtimeBoundaryTestHelpers';

const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const apiBackedReadFiles = [
  'src/devApi/apiBackedReadConfig.ts',
  'src/devApi/apiBackedReadClient.ts',
  'src/devApi/ApiBackedReadDiagnostics.tsx',
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

describe('API-backed read prototype boundary', () => {
  it('adds only the approved API-backed read prototype files', () => {
    for (const path of apiBackedReadFiles) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should exist`).toBe(true);
    }

    for (const path of [
      'src/storage/runtimeSourceSelector.ts',
      'src/storage/runtimeSourceConfig.ts',
      'src/storage/apiStorageAdapter.ts',
      'src/storage/bootFromApiSnapshot.ts',
      'src/storage/apiWriteThroughRuntime.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist yet`).toBe(false);
    }
  });

  it('locks the API-backed read route surface to GET-only read routes', () => {
    expect(API_BACKED_READ_ROUTES).toEqual([
      '/health',
      '/app-data/summary',
      '/sessions/summary',
      '/history',
      '/history/:id',
      '/data-health/summary',
    ]);

    const client = createApiBackedReadClient({
      enabled: true,
      status: 'enabled',
      runtimeSource: 'api-readonly',
      baseUrl: 'http://127.0.0.1:8787',
      timeoutMs: 1500,
    });
    expect(Object.keys(client).sort()).toEqual([
      'readAppDataSummary',
      'readDataHealthSummary',
      'readHealth',
      'readHistory',
      'readHistoryDetail',
      'readSessionsSummary',
    ]);
  });

  it('keeps API-backed read source free of POST writes, persistence writes, and blocked route strings', () => {
    const blocked = [
      'method: "POST"',
      "method: 'POST'",
      '`POST`',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
      '/history/:id/edit',
      '/data-health/repair/apply',
      '/backup/import',
      '/backup/export',
      '/reset/',
      '/recovery/',
      'saveData',
      'loadData',
      'localStorage.setItem',
      'localStorageAdapter',
      'apiStorageAdapter',
      'api-primary-dev',
      'makeApiSourceOfTruth',
      'offlineMutationQueue',
    ];

    for (const path of apiBackedReadFiles) {
      const source = stripComments(readSource(path));
      expect(blocked.filter((token) => source.includes(token)), `${path} blocked tokens`).toEqual([]);
    }
  });

  it('keeps browser source free of Node-only runtime tokens', () => {
    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      const offenders = blockedNodeOnlyTokens.filter((token) => source.includes(token));
      expect(offenders, `${relativePath(file)} Node-only boundary`).toEqual([]);
    }
  });

  it('does not add a broad mutation client, package drift, or API-backed storage adapter', () => {
    for (const path of [
      'src/mutationClient.ts',
      'src/services/mutationClient.ts',
      'src/hooks/useMutationApi.ts',
      'src/api/mutations.ts',
      'src/devApi/devApiMutationClient.ts',
      'src/storage/apiStorageAdapter.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist`).toBe(false);
    }

    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(Object.keys(packageJson.scripts || {}).sort()).toEqual([
      'api:dev',
      'api:dev:build',
      'build',
      'build:size-check',
      'build:stats',
      'dev',
      'predeploy:check',
      'preview',
      'test',
      'test:watch',
      'typecheck',
    ]);

    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    expect(Object.keys(deps).filter((name) =>
      /fastify|express|koa|hono|trpc|graphql|auth|sync|mutation-client|playwright|cypress/i.test(name),
    )).toEqual([]);
  });
});

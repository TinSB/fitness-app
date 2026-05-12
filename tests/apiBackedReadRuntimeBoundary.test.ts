import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_BACKED_READ_ROUTES } from '../src/devApi/apiBackedReadClient';
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

describe('API-backed read runtime acceptance boundary', () => {
  it('keeps read routes GET-only and does not add POST writes', () => {
    expect(API_BACKED_READ_ROUTES).toEqual([
      '/health',
      '/app-data/summary',
      '/sessions/summary',
      '/history',
      '/history/:id',
      '/data-health/summary',
    ]);

    for (const path of apiBackedReadFiles) {
      const source = stripComments(readSource(path));
      expect(source).not.toMatch(/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/);
      expect(source).not.toMatch(/\/sessions\/start|\/sessions\/active|\/history\/:id\/edit|\/data-health\/repair|\/backup\/|\/reset\/|\/recovery\//);
    }
  });

  it('keeps source switch, API storage adapter, broad mutation clients, and package drift absent', () => {
    for (const path of [
      'src/storage/runtimeSourceSelector.ts',
      'src/storage/runtimeSourceConfig.ts',
      'src/storage/bootFromApiSnapshot.ts',
      'src/storage/apiWriteThroughRuntime.ts',
      'src/devApi/devApiMutationClient.ts',
      'src/mutationClient.ts',
      'src/services/mutationClient.ts',
      'src/hooks/useMutationApi.ts',
      'src/api/mutations.ts',
    ]) {
      expect(existsSync(resolve(repoRoot(), path)), `${path} should not exist`).toBe(false);
    }
    expect(existsSync(resolve(repoRoot(), 'src/storage/apiStorageAdapter.ts')), 'Task 5.24 adapter may exist default-off').toBe(true);

    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    expect(Object.keys(deps).filter((name) =>
      /fastify|express|koa|hono|trpc|graphql|auth|sync|mutation-client|playwright|cypress/i.test(name),
    )).toEqual([]);
    expect(Object.keys(packageJson.scripts || {}).filter((name) =>
      name !== 'predeploy:check' && /prod|auth|sync|cloud|deploy|migration:apply/i.test(name),
    )).toEqual([]);
  });

  it('keeps browser build source free of Node-only runtime tokens', () => {
    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      const offenders = blockedNodeOnlyTokens.filter((token) => source.includes(token));
      expect(offenders, `${relativePath(file)} should stay browser-safe`).toEqual([]);
    }
  });

  it('records Task 5.9 in docs without production readiness or source migration instructions', () => {
    const docs = [
      'docs/API_BACKED_READ_RUNTIME_ACCEPTANCE.md',
      'docs/API_BACKED_READ_RUNTIME_PLAN.md',
      'API_CONTRACT.md',
      'FULL_STACK_REFACTOR_PLAN.md',
      'docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md',
    ].map(readSource).join('\n');

    expect(docs).toContain('Task 5.9');
    expect(docs).toContain('Task 5.10 API-backed Read Manual App Acceptance V1');
    expect(docs).not.toMatch(/production ready|enable production backend now|enable auth now|enable sync now/i);
    expect(docs).not.toMatch(/switch source of truth now|make API source of truth now|replace localStorage now/i);
  });
});

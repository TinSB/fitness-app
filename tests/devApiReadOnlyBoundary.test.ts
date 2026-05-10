import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectRuntimeSourceFiles,
  collectSrcRuntimeFiles,
  expectSourceNotToContain,
  readSource,
  repoRoot,
} from './runtimeBoundaryTestHelpers';

const nodeOnlyRuntimeTokens = [
  'devLauncher',
  'httpRuntimeAdapter',
  'serverAdapter',
  'sqliteRepository',
  'devApiRunner',
  'devDbRecovery',
  'node:http',
  'node:sqlite',
];

const allowedScriptNames = new Set([
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

describe('dev API read-only browser boundaries', () => {
  it('keeps App.tsx and production src free of Node-only runtime imports', () => {
    expectSourceNotToContain(resolve(repoRoot(), 'src/App.tsx'), nodeOnlyRuntimeTokens);
    collectSrcRuntimeFiles().forEach((file) => expectSourceNotToContain(file, ['node:http', 'node:sqlite']));
  });

  it('keeps browser-facing API index from exporting Node-only runtime', () => {
    expectSourceNotToContain(resolve(repoRoot(), 'apps/api/src/index.ts'), nodeOnlyRuntimeTokens);
    expectSourceNotToContain(resolve(repoRoot(), 'apps/api/src/index.ts'), ['./node', './node/', 'node/index']);
  });

  it('keeps frontend dev API code read-only and browser-safe', () => {
    const sources = collectRuntimeSourceFiles(resolve(repoRoot(), 'src/devApi'))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    expect(sources).not.toMatch(/\/sessions\/start|\/sessions\/active|\/history\/:id\/edit|\/data-health\/repair|backup|importBackup|exportBackup|resetDev|repairLegacy/i);
    expect(sources).not.toContain('saveData');
    expect(sources).not.toContain('loadData');
    expect(sources).not.toContain('localStorageAdapter');
    expect(sources).not.toContain('node:http');
    expect(sources).not.toContain('node:sqlite');
    expect(sources).not.toContain('serverAdapter');
    expect(sources).not.toContain('sqliteRepository');
  });

  it('keeps localStorageAdapter from becoming API-backed', () => {
    const adapter = readSource('src/storage/localStorageAdapter.ts');

    expect(adapter).not.toContain('fetch(');
    expect(adapter).not.toContain('/app-data/summary');
    expect(adapter).not.toContain('/sessions/summary');
    expect(adapter).not.toContain('DevApiReadOnly');
  });

  it('does not add package scripts or dependencies for the prototype', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const unexpectedScripts = Object.entries(packageJson.scripts).filter(([name, command]) => {
      if (allowedScriptNames.has(name)) return false;
      return /migration|integration|frontend.*api|api.*client|production|prod|auth|sync/i.test(`${name} ${command}`);
    });
    expect(unexpectedScripts).toEqual([]);

    const deps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    };
    ['fastify', 'express', 'koa', 'hono', '@trpc/server', 'graphql', 'tsx', 'ts-node'].forEach((name) => {
      expect(deps).not.toHaveProperty(name);
    });
  });
});

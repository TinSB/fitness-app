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

describe('read-only runtime boundary acceptance', () => {
  it('keeps production browser runtime free of Node-only imports', () => {
    expectSourceNotToContain(resolve(repoRoot(), 'src/App.tsx'), nodeOnlyRuntimeTokens);
    collectSrcRuntimeFiles().forEach((file) => expectSourceNotToContain(file, ['node:http', 'node:sqlite']));
    expectSourceNotToContain(resolve(repoRoot(), 'apps/api/src/index.ts'), nodeOnlyRuntimeTokens);
    expectSourceNotToContain(resolve(repoRoot(), 'apps/api/src/index.ts'), ['./node', './node/', 'node/index']);
  });

  it('keeps dev API frontend code read-only and browser-safe', () => {
    const source = collectRuntimeSourceFiles(resolve(repoRoot(), 'src/devApi'))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    expect(source).not.toMatch(/\bPOST\b|\bPUT\b|\bPATCH\b|\bDELETE\b/);
    expect(source).not.toMatch(/\/sessions\/start|\/sessions\/active|\/history\/:id\/edit|\/history\/:id\/data-flag/);
    expect(source).not.toMatch(/\/data-health\/issues\/:issueId\/dismiss|\/data-health\/repair\/apply/);
    expect(source).not.toMatch(/\/backup|backup\/|importBackup|exportBackup|\/reset|\/recovery|resetDev/i);
    expect(source).not.toContain('node:http');
    expect(source).not.toContain('node:sqlite');
    expect(source).not.toContain('serverAdapter');
    expect(source).not.toContain('sqliteRepository');
  });

  it('keeps localStorageAdapter and package metadata unchanged as runtime boundaries', () => {
    const adapter = readSource('src/storage/localStorageAdapter.ts');
    expect(adapter).not.toContain('fetch(');
    expect(adapter).not.toContain('DevApiReadOnly');
    expect(adapter).not.toContain('/app-data/summary');

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

    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    ['fastify', 'express', 'koa', 'hono', '@trpc/server', 'graphql', 'tsx', 'ts-node'].forEach((name) => {
      expect(deps).not.toHaveProperty(name);
    });
  });
});

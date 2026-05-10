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

const approvedDataHealthDismissFiles = new Set([
  'src/devApi/devApiDataHealthDismissClient.ts',
  'src/devApi/devApiDataHealthDismissConfig.ts',
  'src/devApi/DevApiDataHealthDismissPrototype.tsx',
  'src/devApi/devApiHistoryDataFlagClient.ts',
  'src/devApi/devApiHistoryDataFlagConfig.ts',
  'src/devApi/DevApiHistoryDataFlagPrototype.tsx',
]);

describe('read-only runtime boundary acceptance', () => {
  it('keeps production browser runtime free of Node-only imports', () => {
    expectSourceNotToContain(resolve(repoRoot(), 'src/App.tsx'), nodeOnlyRuntimeTokens);
    collectSrcRuntimeFiles().forEach((file) => expectSourceNotToContain(file, ['node:http', 'node:sqlite']));
    expectSourceNotToContain(resolve(repoRoot(), 'apps/api/src/index.ts'), nodeOnlyRuntimeTokens);
    expectSourceNotToContain(resolve(repoRoot(), 'apps/api/src/index.ts'), ['./node', './node/', 'node/index']);
  });

  it('keeps dev API frontend code read-only and browser-safe', () => {
    const sources = collectRuntimeSourceFiles(resolve(repoRoot(), 'src/devApi'))
      .map((file) => ({
        path: file.replace(repoRoot(), '').replace(/^[/\\]/, '').replaceAll('\\', '/'),
        source: readFileSync(file, 'utf8'),
      }));
    const readOnlySources = sources
      .filter((file) => !approvedDataHealthDismissFiles.has(file.path))
      .map((file) => file.source)
      .join('\n');
    const approvedSource = sources
      .filter((file) => approvedDataHealthDismissFiles.has(file.path))
      .map((file) => file.source)
      .join('\n');

    expect(readOnlySources).not.toMatch(/\bPOST\b|\bPUT\b|\bPATCH\b|\bDELETE\b/);
    expect(readOnlySources).not.toMatch(/\/sessions\/start|\/sessions\/active|\/history\/:id\/edit|\/history\/:id\/data-flag/);
    expect(readOnlySources).not.toMatch(/\/data-health\/issues\/:issueId\/dismiss|\/data-health\/repair\/apply/);
    expect(readOnlySources).not.toMatch(/\/backup|backup\/|importBackup|exportBackup|\/reset|\/recovery|resetDev/i);
    expect(approvedSource).not.toMatch(/\bPUT\b|\bPATCH\b|\bDELETE\b/);
    expect(approvedSource).not.toMatch(/\/sessions\/|\/history\/:id\/edit|\/data-health\/repair\/apply|\/backup|\/reset|\/recovery/i);
    expect(sources.map((file) => file.source).join('\n')).not.toContain('node:http');
    expect(sources.map((file) => file.source).join('\n')).not.toContain('node:sqlite');
    expect(sources.map((file) => file.source).join('\n')).not.toContain('serverAdapter');
    expect(sources.map((file) => file.source).join('\n')).not.toContain('sqliteRepository');
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

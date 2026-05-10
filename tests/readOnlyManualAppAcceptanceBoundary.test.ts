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

const nodeOnlyTokens = [
  'devLauncher',
  'httpRuntimeAdapter',
  'serverAdapter',
  'sqliteRepository',
  'devApiRunner',
  'devDbRecovery',
  'node:http',
  'node:sqlite',
];

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

const misleadingInstructions = [
  /(^|\n)\s*(-\s*)?connect App\.tsx to API(\.|$)/i,
  /(^|\n)\s*(-\s*)?replace localStorage(\.|$)/i,
  /(^|\n)\s*(-\s*)?enable mutation integration(\.|$)/i,
  /(^|\n)\s*(-\s*)?deploy production backend(\.|$)/i,
  /(^|\n)\s*(-\s*)?enable auth(\.|$)/i,
  /(^|\n)\s*(-\s*)?enable sync(\.|$)/i,
];

describe('read-only App manual acceptance boundaries', () => {
  it('keeps production browser runtime free of Node-only imports', () => {
    expectSourceNotToContain(resolve(repoRoot(), 'src/App.tsx'), nodeOnlyTokens);
    collectSrcRuntimeFiles().forEach((file) => expectSourceNotToContain(file, ['node:http', 'node:sqlite']));
    expectSourceNotToContain(resolve(repoRoot(), 'apps/api/src/index.ts'), nodeOnlyTokens);
    expectSourceNotToContain(resolve(repoRoot(), 'apps/api/src/index.ts'), ['./node', './node/', 'node/index']);
  });

  it('does not introduce frontend write clients or API-backed storage', () => {
    const devApiSource = collectRuntimeSourceFiles(resolve(repoRoot(), 'src/devApi'))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    const adapter = readSource('src/storage/localStorageAdapter.ts');

    expect(devApiSource).not.toMatch(/\bPOST\b|\bPUT\b|\bPATCH\b|\bDELETE\b/);
    expect(devApiSource).not.toMatch(/\/sessions\/start|\/sessions\/active|\/history\/:id\/edit|\/history\/:id\/data-flag/);
    expect(devApiSource).not.toMatch(/\/data-health\/issues\/:issueId\/dismiss|\/data-health\/repair\/apply/);
    expect(devApiSource).not.toMatch(/\/backup|backup\/|importBackup|exportBackup|\/reset|\/recovery|resetDev/i);
    expect(adapter).not.toContain('fetch(');
    expect(adapter).not.toContain('DevApiReadOnly');
    expect(adapter).not.toContain('/app-data/summary');
  });

  it('does not add package scripts, dependencies, or browser automation tooling', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const unexpectedScripts = Object.entries(packageJson.scripts).filter(([name, command]) => {
      if (allowedScripts.has(name)) return false;
      return /manual|acceptance|readonly|read-only|migration|integration|prod|auth|sync|playwright|cypress/i.test(`${name} ${command}`);
    });
    expect(unexpectedScripts).toEqual([]);

    const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    ['playwright', '@playwright/test', 'cypress', 'fastify', 'express', 'koa', 'hono', '@trpc/server', 'graphql'].forEach((name) => {
      expect(deps).not.toHaveProperty(name);
    });
  });

  it('keeps docs free of action-oriented migration instructions', () => {
    const docs = [
      readSource('docs/READONLY_APP_MANUAL_ACCEPTANCE.md'),
      readSource('docs/DEV_API_READONLY_APP_INTEGRATION_PLAN.md'),
      readSource('API_CONTRACT.md'),
      readSource('FULL_STACK_REFACTOR_PLAN.md'),
      readSource('docs/MANUAL_API_ACCEPTANCE_CHECKLIST.md'),
    ].join('\n');

    misleadingInstructions.forEach((pattern) => expect(docs).not.toMatch(pattern));
  });
});

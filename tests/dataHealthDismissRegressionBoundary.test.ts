import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
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

const forbiddenBrowserMutationRoutes = [
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

const collectDistFiles = (directory: string): string[] => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectDistFiles(path);
    return entry.isFile() ? [path] : [];
  });
};

describe('DataHealth dismiss regression global boundary lock', () => {
  it('keeps App and src runtime free of Node-only imports', () => {
    const appSource = stripComments(readSource('src/App.tsx'));
    for (const token of nodeOnlyTokens) {
      expect(appSource, `App.tsx should not include ${token}`).not.toContain(token);
    }

    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      const normalized = relativePath(file);
      for (const token of ['node:http', 'node:sqlite']) {
        expect(source, `${normalized} should not include ${token}`).not.toContain(token);
      }
    }
  });

  it('keeps browser-facing API index free of Node-only runtime exports', () => {
    const apiIndex = stripComments(readSource('apps/api/src/index.ts'));
    for (const token of nodeOnlyTokens) {
      expect(apiIndex).not.toContain(token);
    }
    expect(apiIndex).not.toMatch(/from\s+['"].*node\//);
  });

  it('keeps localStorage adapter and package metadata free of write-path expansion', () => {
    const storage = stripComments(readSource('src/storage/localStorageAdapter.ts'));
    expect(storage).not.toContain('fetch(');
    expect(storage).not.toContain('/data-health/issues/');
    expect(storage).not.toContain('/history/:id/data-flag');

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

  it('keeps forbidden mutation routes out of browser source', () => {
    for (const file of collectSrcRuntimeFiles()) {
      const source = stripComments(readFileSync(file, 'utf8'));
      const normalized = relativePath(file);
      for (const route of forbiddenBrowserMutationRoutes) {
        expect(source, `${normalized} should not contain ${route}`).not.toContain(route);
      }
    }
  });

  it('keeps dist output clean when build artifacts are present', () => {
    const distFiles = collectDistFiles(resolve(repoRoot(), 'dist'));
    if (!distFiles.length) return;

    for (const file of distFiles) {
      const source = readFileSync(file, 'utf8');
      for (const token of nodeOnlyTokens) {
        expect(source, `${relativePath(file)} should not include ${token}`).not.toContain(token);
      }
    }
  });
});

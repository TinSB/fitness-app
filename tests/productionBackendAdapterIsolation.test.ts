import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSource, repoRoot } from './runtimeBoundaryTestHelpers';

describe('production backend adapter skeleton isolation', () => {
  it('is not exported from browser-facing API index files', () => {
    expect(readSource('apps/api/src/index.ts')).not.toContain('productionBackendAdapter');
    expect(readSource('src/App.tsx')).not.toContain('productionBackendAdapter');
  });

  it('does not add framework, listener, deployment, auth, database, or migration behavior', () => {
    const source = readSource('apps/api/src/node/productionBackendAdapter.ts');

    for (const forbidden of [
      'listen(',
      'createServer',
      "from 'fastify'",
      'from "fastify"',
      "from 'express'",
      'from "express"',
      "from 'koa'",
      'from "koa"',
      "from 'hono'",
      'from "hono"',
      'node:http',
      'node:sqlite',
      'sqliteRepository',
      'OAuth',
      'password',
      'token storage',
      'migration apply',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('does not add package, lockfile, or deployment config changes', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(Object.keys(packageJson.dependencies)).toEqual(['ajv', 'lucide-react', 'react', 'react-dom']);
    expect(Object.keys(packageJson.devDependencies)).toEqual([
      '@tailwindcss/vite',
      '@types/node',
      '@types/react',
      '@types/react-dom',
      '@vitejs/plugin-react',
      'tailwindcss',
      'typescript',
      'vite',
      'vitest',
    ]);
    expect(packageJson.scripts).not.toHaveProperty('deploy:production');
    expect(existsSync(resolve(repoRoot(), 'package-lock.json'))).toBe(true);
    expect(existsSync(resolve(repoRoot(), 'pnpm-lock.yaml'))).toBe(true);
  });
});

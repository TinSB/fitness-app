import { existsSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { collectSrcRuntimeFiles, expectSourceNotToContain, readSource, repoRoot } from './runtimeBoundaryTestHelpers';

const collectRepoFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', '.ironpath'].includes(entry.name)) return [];
      return collectRepoFiles(path);
    }
    return [relative(repoRoot(), path).replaceAll('\\', '/')];
  });

describe('Phase 6 preflight boundary still blocked', () => {
  it('keeps App.tsx free of production backend/auth/sync/deployment wiring', () => {
    const app = readSource('src/App.tsx');
    expect(app).not.toMatch(/PHASE6_PREFLIGHT|production backend|auth provider|login|signup|cloud sync|monitoring|deployment|sentry/i);
  });

  it('keeps browser runtime free of production server modules and forbidden routes', () => {
    for (const file of collectSrcRuntimeFiles()) {
      expectSourceNotToContain(file, [
        "from 'fastify'",
        'from "fastify"',
        "from 'express'",
        'from "express"',
        "from 'koa'",
        'from "koa"',
        "from 'hono'",
        'from "hono"',
        "from 'next-auth'",
        'from "next-auth"',
        '/auth',
        '/login',
        '/signup',
        '/users',
        '/sync',
        '/cloud',
        '/data-health/repair/apply',
        '/backup/import',
        '/backup/export',
        '/reset/',
        '/recovery/',
        'node:http',
        'node:sqlite',
        'devLauncher',
        'httpRuntimeAdapter',
        'serverAdapter',
        'sqliteRepository',
        'devApiRunner',
        'devDbRecovery',
      ]);
    }
  });

  it('keeps exact seven accepted browser mutation routes', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
  });

  it('keeps localStorage adapter and api-primary-dev dev/local only', () => {
    expect(existsSync(resolve(repoRoot(), 'src/storage/localStorageAdapter.ts'))).toBe(true);
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
    expect(createRuntimeSourceSelector({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
      VITE_IRONPATH_DEV_API_BASE_URL: 'http://127.0.0.1:8787',
    })).toMatchObject({
      mode: 'api-primary-dev',
      productionReady: false,
    });
    expect(createRuntimeSourceSelector({
      DEV: false,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
      VITE_IRONPATH_DEV_API_BASE_URL: 'http://127.0.0.1:8787',
    })).toMatchObject({ mode: 'localStorage' });
  });

  it('keeps package scripts, dependencies, lockfiles, and normalized tables unchanged in scope', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(Object.keys(packageJson.scripts)).toEqual([
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
    expect(Object.keys(packageJson.dependencies)).toEqual(['@supabase/supabase-js', 'ajv', 'lucide-react', 'react', 'react-dom']);
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
    expect(existsSync(resolve(repoRoot(), 'package-lock.json'))).toBe(true);
    expect(existsSync(resolve(repoRoot(), 'pnpm-lock.yaml'))).toBe(true);

    const suspiciousFiles = collectRepoFiles(repoRoot()).filter((path) =>
      /(^|\/)(migrations?|schema)\/.*(user|account|auth|sync|normalized|production)/i.test(path)
      || /(normalized|auth|sync|production).*\.sql$/i.test(path),
    );
    expect(suspiciousFiles).toEqual([]);
  });
});

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

describe('production migration backup rollback boundary still blocked', () => {
  it('keeps browser runtime free of migration/export/repair/reset routes and server modules', () => {
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
        'productionMigration',
        'destructiveMigration',
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

  it('keeps localStorage default and api-primary-dev non-production', () => {
    expect(existsSync(resolve(repoRoot(), 'src/storage/localStorageAdapter.ts'))).toBe(true);
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
    expect(createRuntimeSourceSelector({
      DEV: false,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
      VITE_IRONPATH_DEV_API_BASE_URL: 'http://127.0.0.1:8787',
    })).toMatchObject({ mode: 'localStorage' });
  });

  it('keeps package files and normalized migration files unchanged in scope', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

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
      /(^|\/)(migrations?|schema)\/.*(normalized|production|user|account|auth|sync|cloud)/i.test(path)
      || /(normalized|production|user|account|auth|sync|cloud).*\.sql$/i.test(path),
    );
    expect(suspiciousFiles).toEqual([]);
  });
});

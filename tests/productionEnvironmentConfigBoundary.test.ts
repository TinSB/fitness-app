import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { collectSrcRuntimeFiles, expectSourceNotToContain, readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_ENVIRONMENT_CONFIG_BOUNDARY.md';

describe('production environment config boundary', () => {
  it('documents environment names, secrets separation, and no production enablement', () => {
    const doc = readSource(docPath);

    for (const expected of [
      '# Production Environment Config Boundary',
      '## Environment Names',
      '`local`',
      '`development`',
      '`staging`',
      '`production`',
      '## Secrets Separation',
      'no secret values',
      '## Runtime Enablement Boundary',
      'Production runtime must not become active by default.',
      'no production deploy',
      'Task 6.22 Deployment Runtime Strategy & Staging Plan V1',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('keeps browser runtime free of deployment, secret, and forbidden route behavior', () => {
    for (const file of collectSrcRuntimeFiles()) {
      expectSourceNotToContain(file, [
        'process.env.PRODUCTION_SECRET',
        'VITE_PRODUCTION_SECRET',
        'VERCEL_TOKEN',
        'DEPLOYMENT_TOKEN',
        '/auth',
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

  it('keeps exact accepted routes and localStorage default', () => {
    expect(API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES).toEqual([
      '/data-health/issues/:issueId/dismiss',
      '/history/:id/data-flag',
      '/history/:id/edit',
      '/sessions/start',
      '/sessions/active/patches',
      '/sessions/active/complete',
      '/sessions/active/discard',
    ]);
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

  it('keeps package scripts and dependencies unchanged', () => {
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
    expect(packageJson.scripts).not.toHaveProperty('deploy');
    expect(packageJson.scripts).not.toHaveProperty('deploy:prod');
  });
});

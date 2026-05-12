import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { collectSrcRuntimeFiles, expectSourceNotToContain, repoRoot } from './runtimeBoundaryTestHelpers';

describe('production deployment environment boundary', () => {
  it('keeps runtime free of deployment providers secrets and blocked routes', () => {
    for (const file of collectSrcRuntimeFiles()) {
      expectSourceNotToContain(file, [
        '/data-health/repair/apply',
        '/backup/import',
        '/backup/export',
        '/reset/',
        '/recovery/',
        '/auth',
        '/sync',
        '/cloud',
        'VERCEL_TOKEN',
        'AWS_SECRET',
        'DEPLOY_HOOK',
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

  it('does not add deployment config files that change production behavior', () => {
    expect(JSON.parse(readFileSync(resolve(repoRoot(), 'vercel.json'), 'utf8'))).toMatchObject({
      git: { deploymentEnabled: false },
    });

    for (const file of [
      'netlify.toml',
      'render.yaml',
      'fly.toml',
      'Dockerfile',
    ]) {
      expect(existsSync(resolve(repoRoot(), file))).toBe(false);
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
  });
});

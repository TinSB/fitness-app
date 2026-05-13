import { describe, expect, it } from 'vitest';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

const docPath = 'docs/PRODUCTION_BACKEND_DEPLOYMENT_BOUNDARY.md';

describe('production backend deployment boundary', () => {
  it('documents deployment boundary and non-implementation', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Vercel frontend deployment does not equal backend production readiness.',
      '`api-primary-dev` and devApiRunner must not be deployed as production backend.',
      'frontend may remain a Vercel/static web app',
      'production backend should be a separate production service',
      'no production deployment',
      'no Vercel serverless backend',
      'no backend hosting provider is selected or configured',
      'no monitoring runtime',
      'no production source-of-truth switch',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('documents CI and environment safety rules', () => {
    const doc = readSource(docPath);

    for (const expected of [
      'Preview and production environments must remain distinct.',
      'Secret values must not be committed',
      'Localhost and dev API base URLs are not production backend URLs.',
      'IronPath Validation',
      'gh pr checks <PR_NUMBER> --required --watch',
      'Optional Vercel preview checks do not block merge',
      'Never use `--admin`.',
      'Never bypass branch protection.',
    ]) {
      expect(doc).toContain(expected);
    }
  });

  it('preserves runtime and route boundaries', () => {
    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
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
});

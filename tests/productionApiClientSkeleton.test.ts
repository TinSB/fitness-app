import { describe, expect, it } from 'vitest';
import { createProductionApiClient } from '../src/productionApi/productionApiClient';
import { resolveProductionApiConfig } from '../src/productionApi/productionApiConfig';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('frontend production api client skeleton', () => {
  it('is disabled by default and fails closed', async () => {
    const client = createProductionApiClient();

    expect(client.enabled).toBe(false);
    await expect(client.getHealth()).resolves.toMatchObject({
      ok: false,
      error: { code: 'production_api_disabled' },
    });
  });

  it('requires explicit production-safe config', () => {
    expect(resolveProductionApiConfig({ enabled: true })).toMatchObject({
      ok: false,
      errors: [{ code: 'production_api_base_url_required' }],
    });
    expect(resolveProductionApiConfig({ enabled: true, baseUrl: 'http://localhost:3000' })).toMatchObject({
      ok: false,
      errors: [{ code: 'production_api_base_url_not_production' }],
    });
    expect(resolveProductionApiConfig({ enabled: true, baseUrl: 'https://api.ironpath.example/' })).toEqual({
      ok: true,
      enabled: true,
      baseUrl: 'https://api.ironpath.example',
    });
  });

  it('performs only enabled read calls through injected fetch', async () => {
    const requested: string[] = [];
    const client = createProductionApiClient(
      { enabled: true, baseUrl: 'https://api.ironpath.example' },
      async (input) => {
        requested.push(input);
        return {
          ok: true,
          status: 200,
          json: async () => ({ input }),
        };
      },
    );

    await expect(client.getHistoryDetail('synthetic id')).resolves.toEqual({
      ok: true,
      value: { input: 'https://api.ironpath.example/history/synthetic%20id' },
    });
    expect(requested).toEqual(['https://api.ironpath.example/history/synthetic%20id']);
  });

  it('does not expose mutation methods or import Node-only modules', () => {
    const client = createProductionApiClient();
    const keys = Object.keys(client);

    for (const forbiddenKey of ['post', 'mutate', 'repair', 'reset', 'importBackup', 'exportBackup', 'write']) {
      expect(keys).not.toContain(forbiddenKey);
    }

    const source = [
      readSource('src/productionApi/productionApiClient.ts'),
      readSource('src/productionApi/productionApiConfig.ts'),
    ].join('\n');
    for (const forbidden of ['apps/api/src/node', 'node:http', 'node:sqlite', 'devApiRunner']) {
      expect(source).not.toContain(forbidden);
    }
    expect(readSource('src/App.tsx')).not.toContain('productionApiClient');
  });

  it('preserves localStorage and route boundaries', () => {
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

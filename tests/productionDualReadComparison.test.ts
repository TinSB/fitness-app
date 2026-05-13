import { describe, expect, it } from 'vitest';
import { compareProductionDualRead } from '../src/productionApi/productionDualReadComparison';
import { API_STORAGE_ADAPTER_ACCEPTED_WRITE_ROUTES } from '../src/storage/apiStorageAdapter';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

const localValue = Object.freeze({ workouts: 2, activeSession: false });

describe('production dual-read comparison', () => {
  it('is disabled by default and does not call production read', async () => {
    let called = false;
    const result = await compareProductionDualRead({
      localValue,
      productionRead: async () => {
        called = true;
        return { ok: true, value: localValue };
      },
    });

    expect(called).toBe(false);
    expect(result).toMatchObject({
      status: 'disabled',
      diagnosticOnly: true,
      appCanContinue: true,
      mutatedLocal: false,
      localValue,
    });
  });

  it('reports match, mismatch, unavailable, and failed without mutating local value', async () => {
    await expect(compareProductionDualRead({
      enabled: true,
      localValue,
      productionRead: async () => ({ ok: true, value: { activeSession: false, workouts: 2 } }),
    })).resolves.toMatchObject({ status: 'match', mutatedLocal: false });

    await expect(compareProductionDualRead({
      enabled: true,
      localValue,
      productionRead: async () => ({ ok: true, value: { workouts: 3, activeSession: false } }),
    })).resolves.toMatchObject({ status: 'mismatch', mutatedLocal: false });

    await expect(compareProductionDualRead({
      enabled: true,
      localValue,
      productionRead: async () => ({
        ok: false,
        error: { code: 'production_api_request_failed', message: 'failed' },
      }),
    })).resolves.toMatchObject({ status: 'unavailable', errorCode: 'production_api_request_failed' });

    await expect(compareProductionDualRead({
      enabled: true,
      localValue,
      timeoutMs: 1,
      productionRead: async () => new Promise((resolve) => {
        setTimeout(() => resolve({ ok: true, value: localValue }), 20);
      }),
    })).resolves.toMatchObject({ status: 'failed', errorCode: 'production_dual_read_failed' });

    expect(localValue).toEqual({ workouts: 2, activeSession: false });
  });

  it('does not contain local mutation, backend write, or Node-only imports', () => {
    const source = readSource('src/productionApi/productionDualReadComparison.ts');

    for (const forbidden of ['localStorage.setItem', 'saveData(', 'POST', 'apps/api/src/node', 'node:http', 'node:sqlite']) {
      expect(source).not.toContain(forbidden);
    }
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

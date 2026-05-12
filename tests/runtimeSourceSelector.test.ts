import { describe, expect, it } from 'vitest';
import { createRuntimeSourceSelector, selectRuntimeSource } from '../src/storage/runtimeSourceSelector';
import { resolveRuntimeSourceConfig } from '../src/storage/runtimeSourceConfig';

describe('runtime source selector prototype', () => {
  it('selects localStorage by default without API reads or writes', () => {
    expect(createRuntimeSourceSelector({})).toEqual({
      mode: 'localStorage',
      fallbackMode: 'localStorage',
      sourceOfTruth: 'localStorage',
      appBootSource: 'localStorage',
      appWriteTarget: 'localStorage',
      apiReadEnabled: false,
      apiWriteEnabled: false,
      localStorageFallbackAvailable: true,
      productionReady: false,
      requiresVisibleFailure: false,
    });
  });

  it('selects api-readonly as diagnostics while localStorage remains source of truth', () => {
    expect(createRuntimeSourceSelector({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-readonly',
    })).toMatchObject({
      mode: 'api-readonly',
      sourceOfTruth: 'localStorage',
      appBootSource: 'localStorage',
      appWriteTarget: 'localStorage',
      apiReadEnabled: true,
      apiWriteEnabled: false,
      localStorageFallbackAvailable: true,
      productionReady: false,
      requiresVisibleFailure: true,
    });
  });

  it('selects api-primary-dev only as explicit dev/local API source of truth', () => {
    expect(createRuntimeSourceSelector({
      DEV: true,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
      VITE_IRONPATH_DEV_API_BASE_URL: 'http://127.0.0.1:8787',
    })).toMatchObject({
      mode: 'api-primary-dev',
      sourceOfTruth: 'api-primary-dev',
      appBootSource: 'api-primary-dev',
      appWriteTarget: 'api-primary-dev',
      apiReadEnabled: true,
      apiWriteEnabled: true,
      localStorageFallbackAvailable: true,
      productionReady: false,
      requiresVisibleFailure: true,
    });
  });

  it('falls back to localStorage when config resolution rejects the API mode', () => {
    const config = resolveRuntimeSourceConfig({
      DEV: false,
      VITE_IRONPATH_RUNTIME_SOURCE: 'api-primary-dev',
    });

    expect(selectRuntimeSource(config)).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      appBootSource: 'localStorage',
      appWriteTarget: 'localStorage',
      apiReadEnabled: false,
      apiWriteEnabled: false,
    });
  });
});

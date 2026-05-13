import { describe, expect, it } from 'vitest';
import {
  classifyProductionBackendBaseUrl,
  resolveProductionRuntimeConfig,
} from '../apps/api/src/node/productionRuntimeConfig';
import { createRuntimeSourceSelector } from '../src/storage/runtimeSourceSelector';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('production runtime config guard', () => {
  it('fails closed by default', () => {
    expect(resolveProductionRuntimeConfig()).toMatchObject({
      ok: false,
      enabled: false,
      runtimeKind: 'disabled',
      errors: [{ code: 'production_runtime_disabled' }],
    });
  });

  it('accepts only explicit production runtime config', () => {
    expect(resolveProductionRuntimeConfig({
      enabled: true,
      runtimeKind: 'production-runtime',
      backendBaseUrl: 'https://api.ironpath.example',
    })).toEqual({
      ok: true,
      enabled: true,
      runtimeKind: 'production-runtime',
      backendBaseUrl: 'https://api.ironpath.example',
      backendBaseUrlClassification: 'production',
      errors: [],
    });
  });

  it('rejects api-primary-dev and dev/local URLs as production', () => {
    expect(resolveProductionRuntimeConfig({
      enabled: true,
      runtimeKind: 'api-primary-dev',
      backendBaseUrl: 'https://api.ironpath.example',
    })).toMatchObject({
      ok: false,
      errors: [{ code: 'api_primary_dev_not_production' }],
    });

    expect(resolveProductionRuntimeConfig({
      enabled: true,
      runtimeKind: 'production-runtime',
      backendBaseUrl: 'http://localhost:5173',
    })).toMatchObject({
      ok: false,
      backendBaseUrlClassification: 'dev-local',
      errors: [{ code: 'backend_base_url_not_production' }],
    });
  });

  it('keeps safe error messages without echoing secret values', () => {
    const result = resolveProductionRuntimeConfig({
      enabled: true,
      runtimeKind: 'production-runtime',
      backendBaseUrl: 'not a url with secret-token-value',
      containsSecretValues: true,
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('secret-token-value');
    expect(result).toMatchObject({
      ok: false,
      errors: [
        { code: 'secret_values_not_allowed' },
        { code: 'backend_base_url_invalid' },
      ],
    });
  });

  it('classifies base URLs without promoting local development', () => {
    expect(classifyProductionBackendBaseUrl()).toBe('missing');
    expect(classifyProductionBackendBaseUrl('https://localhost')).toBe('dev-local');
    expect(classifyProductionBackendBaseUrl('http://api.ironpath.example')).toBe('invalid');
    expect(classifyProductionBackendBaseUrl('https://api.ironpath.example')).toBe('production');
  });

  it('preserves runtime source and documents guard boundaries', () => {
    const doc = readSource('docs/PRODUCTION_RUNTIME_CONFIG_GUARD.md');

    expect(createRuntimeSourceSelector({ DEV: true })).toMatchObject({
      mode: 'localStorage',
      sourceOfTruth: 'localStorage',
      apiWriteEnabled: false,
    });
    for (const expected of [
      'api-primary-dev` is rejected as production runtime',
      'secret values are not accepted by the guard',
      'Production source-of-truth switch remains blocked.',
      'No eighth browser mutation route is authorized.',
      'Task 8.4 may begin only after Task 8.3 is fully merged.',
    ]) {
      expect(doc).toContain(expected);
    }
  });
});

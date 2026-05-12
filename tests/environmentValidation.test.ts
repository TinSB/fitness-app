import { describe, expect, it } from 'vitest';
import { validateEnvironmentConfig } from '../src/config/environmentValidation';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('environment validation skeleton', () => {
  it('accepts local and development metadata without secret values', () => {
    expect(validateEnvironmentConfig({
      environmentName: 'local',
      runtimeSource: 'localStorage',
      secretReferenceNames: [],
    })).toEqual({
      ok: true,
      environmentName: 'local',
      productionRuntimeEnabled: false,
      secretValuesAccepted: false,
      errors: [],
      warnings: [],
    });

    expect(validateEnvironmentConfig({
      environmentName: 'development',
      runtimeSource: 'apiReadonly',
      secretReferenceNames: ['AUTH_PROVIDER_CLIENT_ID_REFERENCE'],
    })).toMatchObject({
      ok: true,
      environmentName: 'development',
      secretValuesAccepted: false,
      errors: [],
    });
  });

  it('blocks secret values and production runtime enablement', () => {
    expect(validateEnvironmentConfig({
      environmentName: 'production',
      runtimeSource: 'apiPrimaryDev',
      productionRuntimeEnabled: true,
      containsSecretValues: true,
      secretReferenceNames: [''],
    })).toEqual({
      ok: false,
      environmentName: 'production',
      productionRuntimeEnabled: true,
      secretValuesAccepted: false,
      errors: [
        'secret values must not be supplied to browser validation',
        'production runtime is not enabled by this skeleton',
        'API primary dev mode is not a production runtime source',
        'secret reference names must be non-empty placeholders',
      ],
      warnings: ['production environment requires a future architecture gate'],
    });
  });

  it('contains no secret values, deployment behavior, providers, or network calls', () => {
    const source = readSource('src/config/environmentValidation.ts');

    for (const forbidden of [
      'fetch(',
      'XMLHttpRequest',
      'localStorage.setItem',
      'localStorage.removeItem',
      'sessionStorage',
      'node:http',
      'node:sqlite',
      'writeFile',
      'createServer',
      'listen(',
      'login',
      'OAuth',
      'remoteWriteQueue',
      'backgroundSync',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});

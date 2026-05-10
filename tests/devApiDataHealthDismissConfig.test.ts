import { describe, expect, it } from 'vitest';
import {
  resolveDevApiDataHealthDismissConfig,
} from '../src/devApi/devApiDataHealthDismissConfig';
import { readSource } from './runtimeBoundaryTestHelpers';

const enabledEnv = {
  DEV: true,
  VITE_IRONPATH_DEV_API_COMPARE: '1',
  VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: 'datahealth-dismiss',
};

describe('Dev API DataHealth dismiss config', () => {
  it('defaults off', () => {
    expect(resolveDevApiDataHealthDismissConfig({})).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'not_dev',
    });
  });

  it('enables only in DEV with read-only compare and the DataHealth dismiss experiment flag', () => {
    expect(resolveDevApiDataHealthDismissConfig(enabledEnv)).toMatchObject({
      enabled: true,
      status: 'enabled',
      experiment: 'datahealth-dismiss',
      baseUrl: 'http://127.0.0.1:8787',
      timeoutMs: 1500,
    });

    expect(resolveDevApiDataHealthDismissConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
    })).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'mutation_flag_off',
    });
  });

  it('stays disabled in production-like env even when flags are present', () => {
    expect(resolveDevApiDataHealthDismissConfig({
      ...enabledEnv,
      DEV: false,
    })).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'not_dev',
    });
  });

  it('requires read-only comparison opt-in before mutation experiment opt-in', () => {
    expect(resolveDevApiDataHealthDismissConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: 'datahealth-dismiss',
    })).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'compare_flag_off',
    });
  });

  it('rejects non-localhost base URLs', () => {
    expect(resolveDevApiDataHealthDismissConfig({
      ...enabledEnv,
      VITE_IRONPATH_DEV_API_BASE_URL: 'https://example.com',
    })).toMatchObject({
      enabled: false,
      status: 'invalid',
      error: { code: 'dev_api_non_localhost_base_url' },
    });
  });

  it('does not write localStorage', () => {
    const source = readSource('src/devApi/devApiDataHealthDismissConfig.ts');
    expect(source).not.toMatch(/localStorage|saveData|loadData|localStorageAdapter/);
  });
});

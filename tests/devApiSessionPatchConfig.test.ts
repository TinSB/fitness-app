import { describe, expect, it } from 'vitest';
import { resolveDevApiDataHealthDismissConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { resolveDevApiHistoryDataFlagConfig } from '../src/devApi/devApiHistoryDataFlagConfig';
import { resolveDevApiHistorySetEditConfig } from '../src/devApi/devApiHistorySetEditConfig';
import { resolveDevApiSessionStartConfig } from '../src/devApi/devApiSessionStartConfig';
import {
  DEV_API_SESSION_PATCH_EXPERIMENT,
  resolveDevApiSessionPatchConfig,
} from '../src/devApi/devApiSessionPatchConfig';
import { readSource } from './runtimeBoundaryTestHelpers';

const enabledEnv = {
  DEV: true,
  VITE_IRONPATH_DEV_API_COMPARE: '1',
  VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: DEV_API_SESSION_PATCH_EXPERIMENT,
};

describe('Dev API session patch config', () => {
  it('defaults off', () => {
    expect(resolveDevApiSessionPatchConfig({})).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'not_dev',
    });
  });

  it('enables only in DEV with compare and the session-patch experiment flag', () => {
    expect(DEV_API_SESSION_PATCH_EXPERIMENT).toBe('session-patch');
    expect(resolveDevApiSessionPatchConfig(enabledEnv)).toMatchObject({
      enabled: true,
      status: 'enabled',
      experiment: 'session-patch',
      baseUrl: 'http://127.0.0.1:8787',
      timeoutMs: 1500,
    });
  });

  it('stays disabled in production-like env and without compare', () => {
    expect(resolveDevApiSessionPatchConfig({ ...enabledEnv, DEV: false })).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'not_dev',
    });
    expect(resolveDevApiSessionPatchConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: DEV_API_SESSION_PATCH_EXPERIMENT,
    })).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'compare_flag_off',
    });
  });

  it('requires the exact mutation experiment and keeps flags isolated', () => {
    expect(resolveDevApiSessionPatchConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
    })).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'mutation_flag_off',
    });

    expect(resolveDevApiDataHealthDismissConfig(enabledEnv)).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'mutation_flag_off',
    });
    expect(resolveDevApiHistoryDataFlagConfig(enabledEnv)).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'mutation_flag_off',
    });
    expect(resolveDevApiHistorySetEditConfig(enabledEnv)).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'mutation_flag_off',
    });
    expect(resolveDevApiSessionStartConfig(enabledEnv)).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'mutation_flag_off',
    });
  });

  it('keeps localhost-only base URL validation', () => {
    expect(resolveDevApiSessionPatchConfig({
      ...enabledEnv,
      VITE_IRONPATH_DEV_API_BASE_URL: 'https://example.com',
    })).toMatchObject({
      enabled: false,
      status: 'invalid',
      error: { code: 'dev_api_non_localhost_base_url' },
    });
  });

  it('does not import persistence or write localStorage', () => {
    const source = readSource('src/devApi/devApiSessionPatchConfig.ts');
    expect(source).not.toMatch(/localStorage|saveData|loadData|localStorageAdapter/);
  });
});

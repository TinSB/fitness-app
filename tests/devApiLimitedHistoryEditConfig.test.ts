import { describe, expect, it } from 'vitest';
import {
  DEV_API_HISTORY_SET_EDIT_EXPERIMENT,
  resolveDevApiHistorySetEditConfig,
} from '../src/devApi/devApiHistorySetEditConfig';
import { resolveDevApiDataHealthDismissConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { resolveDevApiHistoryDataFlagConfig } from '../src/devApi/devApiHistoryDataFlagConfig';
import { readSource } from './runtimeBoundaryTestHelpers';

const enabledEnv = {
  DEV: true,
  VITE_IRONPATH_DEV_API_COMPARE: '1',
  VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: DEV_API_HISTORY_SET_EDIT_EXPERIMENT,
};

describe('Dev API limited history edit config', () => {
  it('defaults off', () => {
    expect(resolveDevApiHistorySetEditConfig({})).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'not_dev',
    });
  });

  it('enables only in DEV with read-only compare and the limited history edit experiment flag', () => {
    expect(DEV_API_HISTORY_SET_EDIT_EXPERIMENT).toBe('limited-history-edit');
    expect(resolveDevApiHistorySetEditConfig(enabledEnv)).toMatchObject({
      enabled: true,
      status: 'enabled',
      experiment: 'limited-history-edit',
      baseUrl: 'http://127.0.0.1:8787',
      timeoutMs: 1500,
    });
  });

  it('stays disabled in production-like env even when flags are present', () => {
    expect(resolveDevApiHistorySetEditConfig({ ...enabledEnv, DEV: false })).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'not_dev',
    });
  });

  it('requires read-only comparison opt-in before mutation experiment opt-in', () => {
    expect(resolveDevApiHistorySetEditConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: DEV_API_HISTORY_SET_EDIT_EXPERIMENT,
    })).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'compare_flag_off',
    });

    expect(resolveDevApiHistorySetEditConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
    })).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'mutation_flag_off',
    });
  });

  it('keeps localhost-only base URL validation', () => {
    expect(resolveDevApiHistorySetEditConfig({
      ...enabledEnv,
      VITE_IRONPATH_DEV_API_BASE_URL: 'https://example.com',
    })).toMatchObject({
      enabled: false,
      status: 'invalid',
      error: { code: 'dev_api_non_localhost_base_url' },
    });
  });

  it('keeps mutation experiment flags isolated', () => {
    expect(resolveDevApiHistorySetEditConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: 'datahealth-dismiss',
    })).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'mutation_flag_off',
    });

    expect(resolveDevApiHistorySetEditConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: 'history-data-flag',
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
  });

  it('does not write localStorage', () => {
    const source = readSource('src/devApi/devApiHistorySetEditConfig.ts');
    expect(source).not.toMatch(/localStorage|saveData|loadData|localStorageAdapter/);
  });
});

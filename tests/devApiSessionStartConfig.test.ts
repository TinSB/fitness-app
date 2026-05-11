import { describe, expect, it } from 'vitest';
import {
  DEV_API_SESSION_START_EXPERIMENT,
  resolveDevApiSessionStartConfig,
} from '../src/devApi/devApiSessionStartConfig';
import { resolveDevApiDataHealthDismissConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { resolveDevApiHistoryDataFlagConfig } from '../src/devApi/devApiHistoryDataFlagConfig';
import { resolveDevApiHistorySetEditConfig } from '../src/devApi/devApiHistorySetEditConfig';
import { readSource } from './runtimeBoundaryTestHelpers';

const enabledEnv = {
  DEV: true,
  VITE_IRONPATH_DEV_API_COMPARE: '1',
  VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: DEV_API_SESSION_START_EXPERIMENT,
};

describe('Dev API session start config', () => {
  it('defaults off', () => {
    expect(resolveDevApiSessionStartConfig({})).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'not_dev',
    });
  });

  it('enables only in DEV with compare and the session-start experiment flag', () => {
    expect(DEV_API_SESSION_START_EXPERIMENT).toBe('session-start');
    expect(resolveDevApiSessionStartConfig(enabledEnv)).toMatchObject({
      enabled: true,
      status: 'enabled',
      experiment: 'session-start',
      baseUrl: 'http://127.0.0.1:8787',
      timeoutMs: 1500,
    });
  });

  it('stays disabled in production-like env and without compare', () => {
    expect(resolveDevApiSessionStartConfig({ ...enabledEnv, DEV: false })).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'not_dev',
    });
    expect(resolveDevApiSessionStartConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: DEV_API_SESSION_START_EXPERIMENT,
    })).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'compare_flag_off',
    });
  });

  it('requires the exact mutation experiment and keeps flags isolated', () => {
    expect(resolveDevApiSessionStartConfig({
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
  });

  it('keeps localhost-only base URL validation', () => {
    expect(resolveDevApiSessionStartConfig({
      ...enabledEnv,
      VITE_IRONPATH_DEV_API_BASE_URL: 'https://example.com',
    })).toMatchObject({
      enabled: false,
      status: 'invalid',
      error: { code: 'dev_api_non_localhost_base_url' },
    });
  });

  it('does not import persistence or write localStorage', () => {
    const source = readSource('src/devApi/devApiSessionStartConfig.ts');
    expect(source).not.toMatch(/localStorage|saveData|loadData|localStorageAdapter/);
  });
});

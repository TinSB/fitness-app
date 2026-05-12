import { describe, expect, it } from 'vitest';
import { resolveDevApiDataHealthDismissConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { resolveDevApiHistoryDataFlagConfig } from '../src/devApi/devApiHistoryDataFlagConfig';
import { resolveDevApiHistorySetEditConfig } from '../src/devApi/devApiHistorySetEditConfig';
import { resolveDevApiSessionCompleteConfig } from '../src/devApi/devApiSessionCompleteConfig';
import { resolveDevApiSessionDiscardConfig, DEV_API_SESSION_DISCARD_EXPERIMENT } from '../src/devApi/devApiSessionDiscardConfig';
import { resolveDevApiSessionPatchConfig } from '../src/devApi/devApiSessionPatchConfig';
import { resolveDevApiSessionStartConfig } from '../src/devApi/devApiSessionStartConfig';
import { readSource } from './runtimeBoundaryTestHelpers';

const enabledEnv = {
  DEV: true,
  VITE_IRONPATH_DEV_API_COMPARE: '1',
  VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: DEV_API_SESSION_DISCARD_EXPERIMENT,
};

describe('Dev API session discard config', () => {
  it('defaults off', () => {
    expect(resolveDevApiSessionDiscardConfig({})).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'not_dev',
    });
  });

  it('enables only in DEV with compare and the session-discard experiment flag', () => {
    expect(DEV_API_SESSION_DISCARD_EXPERIMENT).toBe('session-discard');
    expect(resolveDevApiSessionDiscardConfig(enabledEnv)).toMatchObject({
      enabled: true,
      status: 'enabled',
      experiment: 'session-discard',
      baseUrl: 'http://127.0.0.1:8787',
      timeoutMs: 1500,
    });
  });

  it('stays disabled in production-like env, without compare, and for other mutation flags', () => {
    expect(resolveDevApiSessionDiscardConfig({ ...enabledEnv, DEV: false })).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'not_dev',
    });
    expect(resolveDevApiSessionDiscardConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: DEV_API_SESSION_DISCARD_EXPERIMENT,
    })).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'compare_flag_off',
    });

    expect(resolveDevApiDataHealthDismissConfig(enabledEnv)).toMatchObject({ enabled: false, reason: 'mutation_flag_off' });
    expect(resolveDevApiHistoryDataFlagConfig(enabledEnv)).toMatchObject({ enabled: false, reason: 'mutation_flag_off' });
    expect(resolveDevApiHistorySetEditConfig(enabledEnv)).toMatchObject({ enabled: false, reason: 'mutation_flag_off' });
    expect(resolveDevApiSessionStartConfig(enabledEnv)).toMatchObject({ enabled: false, reason: 'mutation_flag_off' });
    expect(resolveDevApiSessionPatchConfig(enabledEnv)).toMatchObject({ enabled: false, reason: 'mutation_flag_off' });
    expect(resolveDevApiSessionCompleteConfig(enabledEnv)).toMatchObject({ enabled: false, reason: 'mutation_flag_off' });
  });

  it('keeps localhost-only base URL validation and no persistence imports', () => {
    expect(resolveDevApiSessionDiscardConfig({
      ...enabledEnv,
      VITE_IRONPATH_DEV_API_BASE_URL: 'https://example.com',
    })).toMatchObject({
      enabled: false,
      status: 'invalid',
      error: { code: 'dev_api_non_localhost_base_url' },
    });

    const source = readSource('src/devApi/devApiSessionDiscardConfig.ts');
    expect(source).not.toMatch(/localStorage|saveData|loadData|localStorageAdapter/);
  });
});

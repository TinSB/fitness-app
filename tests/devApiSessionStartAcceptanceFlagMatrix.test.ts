import { describe, expect, it } from 'vitest';
import { DEV_API_DATA_HEALTH_DISMISS_EXPERIMENT, resolveDevApiDataHealthDismissConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { DEV_API_HISTORY_DATA_FLAG_EXPERIMENT, resolveDevApiHistoryDataFlagConfig } from '../src/devApi/devApiHistoryDataFlagConfig';
import { DEV_API_HISTORY_SET_EDIT_EXPERIMENT, resolveDevApiHistorySetEditConfig } from '../src/devApi/devApiHistorySetEditConfig';
import { DEV_API_SESSION_START_EXPERIMENT, resolveDevApiSessionStartConfig } from '../src/devApi/devApiSessionStartConfig';

describe('Session Start acceptance flag matrix', () => {
  it('enables only in DEV with compare and session-start experiment', () => {
    expect(resolveDevApiSessionStartConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: DEV_API_SESSION_START_EXPERIMENT,
    })).toMatchObject({ enabled: true, status: 'enabled', experiment: 'session-start' });
  });

  it('stays disabled for compare-only, mutation-only, wrong flag, and production-like env', () => {
    expect(resolveDevApiSessionStartConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
    })).toEqual({ enabled: false, status: 'disabled', reason: 'mutation_flag_off' });

    expect(resolveDevApiSessionStartConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: DEV_API_SESSION_START_EXPERIMENT,
    })).toEqual({ enabled: false, status: 'disabled', reason: 'compare_flag_off' });

    expect(resolveDevApiSessionStartConfig({
      DEV: false,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: DEV_API_SESSION_START_EXPERIMENT,
    })).toEqual({ enabled: false, status: 'disabled', reason: 'not_dev' });

    for (const flag of [
      DEV_API_DATA_HEALTH_DISMISS_EXPERIMENT,
      DEV_API_HISTORY_DATA_FLAG_EXPERIMENT,
      DEV_API_HISTORY_SET_EDIT_EXPERIMENT,
      'unknown',
    ]) {
      expect(resolveDevApiSessionStartConfig({
        DEV: true,
        VITE_IRONPATH_DEV_API_COMPARE: '1',
        VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: flag,
      })).toEqual({ enabled: false, status: 'disabled', reason: 'mutation_flag_off' });
    }
  });

  it('does not cross-enable the other mutation prototypes', () => {
    const env = {
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: DEV_API_SESSION_START_EXPERIMENT,
    };

    expect(resolveDevApiDataHealthDismissConfig(env)).toEqual({ enabled: false, status: 'disabled', reason: 'mutation_flag_off' });
    expect(resolveDevApiHistoryDataFlagConfig(env)).toEqual({ enabled: false, status: 'disabled', reason: 'mutation_flag_off' });
    expect(resolveDevApiHistorySetEditConfig(env)).toEqual({ enabled: false, status: 'disabled', reason: 'mutation_flag_off' });
  });
});

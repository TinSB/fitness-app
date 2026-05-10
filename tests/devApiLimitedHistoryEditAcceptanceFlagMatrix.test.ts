import { describe, expect, it } from 'vitest';
import {
  DEV_API_HISTORY_SET_EDIT_EXPERIMENT,
  resolveDevApiHistorySetEditConfig,
} from '../src/devApi/devApiHistorySetEditConfig';
import { resolveDevApiDataHealthDismissConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { resolveDevApiHistoryDataFlagConfig } from '../src/devApi/devApiHistoryDataFlagConfig';

describe('limited history edit acceptance flag matrix', () => {
  it('requires DEV, read-only compare, and the dedicated mutation experiment flag', () => {
    expect(resolveDevApiHistorySetEditConfig({})).toMatchObject({ enabled: false, reason: 'not_dev' });
    expect(resolveDevApiHistorySetEditConfig({ DEV: true })).toMatchObject({ enabled: false, reason: 'compare_flag_off' });
    expect(resolveDevApiHistorySetEditConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
    })).toMatchObject({ enabled: false, reason: 'mutation_flag_off' });
    expect(resolveDevApiHistorySetEditConfig({
      DEV: false,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: DEV_API_HISTORY_SET_EDIT_EXPERIMENT,
    })).toMatchObject({ enabled: false, reason: 'not_dev' });

    expect(resolveDevApiHistorySetEditConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: DEV_API_HISTORY_SET_EDIT_EXPERIMENT,
    })).toMatchObject({
      enabled: true,
      status: 'enabled',
      experiment: 'limited-history-edit',
    });
  });

  it('does not cross-enable other mutation experiments', () => {
    const limitedEnv = {
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: DEV_API_HISTORY_SET_EDIT_EXPERIMENT,
    };

    expect(resolveDevApiDataHealthDismissConfig(limitedEnv)).toMatchObject({ enabled: false, reason: 'mutation_flag_off' });
    expect(resolveDevApiHistoryDataFlagConfig(limitedEnv)).toMatchObject({ enabled: false, reason: 'mutation_flag_off' });
    expect(resolveDevApiHistorySetEditConfig({
      ...limitedEnv,
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: 'datahealth-dismiss',
    })).toMatchObject({ enabled: false, reason: 'mutation_flag_off' });
    expect(resolveDevApiHistorySetEditConfig({
      ...limitedEnv,
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: 'history-data-flag',
    })).toMatchObject({ enabled: false, reason: 'mutation_flag_off' });
  });

  it('rejects non-localhost base URLs before any mutation can render', () => {
    expect(resolveDevApiHistorySetEditConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: DEV_API_HISTORY_SET_EDIT_EXPERIMENT,
      VITE_IRONPATH_DEV_API_BASE_URL: 'https://example.com',
    })).toMatchObject({
      enabled: false,
      status: 'invalid',
      error: { code: 'dev_api_non_localhost_base_url' },
    });
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveDevApiDataHealthDismissConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { DevApiHistoryDataFlagPrototype } from '../src/devApi/DevApiHistoryDataFlagPrototype';
import {
  DEV_API_HISTORY_DATA_FLAG_EXPERIMENT,
  resolveDevApiHistoryDataFlagConfig,
  type DevApiHistoryDataFlagEnv,
} from '../src/devApi/devApiHistoryDataFlagConfig';
import { makeRecordData } from './recordDataHealthMutationFixtures';

const baseEnv: DevApiHistoryDataFlagEnv = {
  DEV: true,
  VITE_IRONPATH_DEV_API_COMPARE: '1',
  VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: DEV_API_HISTORY_DATA_FLAG_EXPERIMENT,
};

const renderWithEnv = (env: DevApiHistoryDataFlagEnv) => {
  let fetchCalls = 0;
  const markup = renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototype, {
    data: makeRecordData(),
    config: resolveDevApiHistoryDataFlagConfig(env),
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response('{}');
    },
  }));
  return { markup, fetchCalls };
};

describe('History data-flag acceptance flag matrix', () => {
  it('keeps the prototype disabled unless DEV, compare, and history-data-flag are all enabled', () => {
    const disabledCases: Array<[string, DevApiHistoryDataFlagEnv]> = [
      ['compare flag off', { DEV: true, VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: 'history-data-flag' }],
      ['mutation flag off', { DEV: true, VITE_IRONPATH_DEV_API_COMPARE: '1' }],
      ['production-like env', { ...baseEnv, DEV: false }],
      ['mutation flag missing', { DEV: true, VITE_IRONPATH_DEV_API_COMPARE: '1' }],
      ['compare flag missing', { DEV: true, VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: 'history-data-flag' }],
    ];

    for (const [label, env] of disabledCases) {
      const { markup, fetchCalls } = renderWithEnv(env);
      expect(markup, label).toBe('');
      expect(fetchCalls, label).toBe(0);
    }
  });

  it('does not let DataHealth dismiss experiment flag enable History data-flag', () => {
    const historyConfig = resolveDevApiHistoryDataFlagConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: 'datahealth-dismiss',
    });
    const dismissConfig = resolveDevApiDataHealthDismissConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: 'datahealth-dismiss',
    });

    expect(historyConfig).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'mutation_flag_off',
    });
    expect(dismissConfig).toMatchObject({
      enabled: true,
      status: 'enabled',
      experiment: 'datahealth-dismiss',
    });
    expect(renderWithEnv({
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: 'datahealth-dismiss',
    }).markup).toBe('');
  });

  it('does not let History data-flag experiment flag enable DataHealth dismiss', () => {
    const historyConfig = resolveDevApiHistoryDataFlagConfig(baseEnv);
    const dismissConfig = resolveDevApiDataHealthDismissConfig(baseEnv);

    expect(historyConfig).toMatchObject({
      enabled: true,
      status: 'enabled',
      experiment: 'history-data-flag',
    });
    expect(dismissConfig).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'mutation_flag_off',
    });
  });

  it('renders the accepted prototype only when all flags and a stable target record are present', () => {
    const { markup, fetchCalls } = renderWithEnv(baseEnv);

    expect(markup).toContain('Dev API History data-flag experiment');
    expect(markup).toContain('localStorage remains source of truth');
    expect(markup).toContain('Current dataFlag: normal');
    expect(markup).toContain('Target dataFlag: test');
    expect(fetchCalls).toBe(0);
  });
});

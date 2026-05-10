import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DevApiDataHealthDismissPrototype } from '../src/devApi/DevApiDataHealthDismissPrototype';
import { resolveDevApiDataHealthDismissConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { makeRepairableWeightData } from './recordDataHealthMutationFixtures';

const data = makeRepairableWeightData();

const renderWithEnv = (env: Parameters<typeof resolveDevApiDataHealthDismissConfig>[0]) => {
  let fetchCalls = 0;
  const markup = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototype, {
    data,
    config: resolveDevApiDataHealthDismissConfig(env),
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response('{}');
    },
  }));

  return { markup, fetchCalls };
};

describe('DataHealth dismiss acceptance flag matrix', () => {
  it('does not render mutation UI or POST when compare flag is off', () => {
    const { markup, fetchCalls } = renderWithEnv({
      DEV: true,
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: 'datahealth-dismiss',
    });

    expect(markup).toBe('');
    expect(fetchCalls).toBe(0);
  });

  it('does not render mutation UI or POST when mutation flag is off', () => {
    const { markup, fetchCalls } = renderWithEnv({
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
    });

    expect(markup).toBe('');
    expect(fetchCalls).toBe(0);
  });

  it('stays disabled in production-like env even when both flags are present', () => {
    const { markup, fetchCalls } = renderWithEnv({
      DEV: false,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: 'datahealth-dismiss',
    });

    expect(markup).toBe('');
    expect(fetchCalls).toBe(0);
  });

  it('does not enable from read-only compare flag alone', () => {
    const config = resolveDevApiDataHealthDismissConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
    });

    expect(config).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'mutation_flag_off',
    });
  });

  it('does not enable from mutation experiment flag alone', () => {
    const config = resolveDevApiDataHealthDismissConfig({
      DEV: true,
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: 'datahealth-dismiss',
    });

    expect(config).toEqual({
      enabled: false,
      status: 'disabled',
      reason: 'compare_flag_off',
    });
  });

  it('renders only when DEV, read-only compare, and the mutation experiment flag are all enabled', () => {
    const { markup, fetchCalls } = renderWithEnv({
      DEV: true,
      VITE_IRONPATH_DEV_API_COMPARE: '1',
      VITE_IRONPATH_DEV_API_MUTATION_EXPERIMENT: 'datahealth-dismiss',
    });

    expect(markup).toContain('Dev API DataHealth dismiss experiment');
    expect(markup).toContain('Dev-only mutation experiment');
    expect(markup).toContain('localStorage remains source of truth');
    expect(fetchCalls).toBe(0);
  });
});

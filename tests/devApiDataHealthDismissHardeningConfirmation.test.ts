import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  canSubmitDataHealthDismissPrototype,
  createDataHealthDismissSourceContext,
  DevApiDataHealthDismissPrototype,
  DevApiDataHealthDismissPrototypePanel,
} from '../src/devApi/DevApiDataHealthDismissPrototype';
import type {
  DevApiDataHealthDismissConfig,
  DevApiDataHealthDismissEnabledConfig,
} from '../src/devApi/devApiDataHealthDismissConfig';
import { makeRepairableWeightData } from './recordDataHealthMutationFixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

const config: DevApiDataHealthDismissEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'datahealth-dismiss',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

const disabledConfig: DevApiDataHealthDismissConfig = {
  enabled: false,
  status: 'disabled',
  reason: 'mutation_flag_off',
};

const sourceContext = createDataHealthDismissSourceContext(makeRepairableWeightData())!;
const buttonMarkup = (markup: string) => markup.match(/<button[\s\S]*?<\/button>/)?.[0] || '';

describe('DataHealth dismiss hardening confirmation behavior', () => {
  it('cancel or unchecked confirmation prevents POST eligibility', () => {
    expect(canSubmitDataHealthDismissPrototype({
      config,
      sourceContext,
      confirmed: false,
      pending: false,
    })).toBe(false);

    const markup = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototypePanel, {
      config,
      sourceContext,
      selectedIssueId: sourceContext.issueId,
      confirmed: false,
      pending: false,
      state: { status: 'idle' },
    }));

    expect(buttonMarkup(markup)).toContain('disabled');
    expect(markup).toContain('I confirm this one-route dev request');
  });

  it('success and failure panel states require re-confirmation before retry', () => {
    const success = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototypePanel, {
      config,
      sourceContext,
      selectedIssueId: sourceContext.issueId,
      confirmed: false,
      pending: false,
      state: {
        status: 'success',
        issueId: sourceContext.issueId,
        snapshot: {
          snapshotId: 'snapshot-confirmation',
          schemaVersion: 1,
          createdAt: '2026-05-10T00:00:00.000Z',
        },
      },
    }));
    const failure = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototypePanel, {
      config,
      sourceContext,
      selectedIssueId: sourceContext.issueId,
      confirmed: false,
      pending: false,
      state: {
        status: 'failure',
        issueId: sourceContext.issueId,
        error: {
          code: 'dev_mutation_not_successful',
          serverCode: 'issue_not_found',
          message: 'Issue was not found.',
        },
      },
    }));

    expect(buttonMarkup(success)).toContain('disabled');
    expect(buttonMarkup(failure)).toContain('disabled');
    expect(success).toContain('No data was changed locally');
    expect(failure).toContain('issue_not_found');
  });

  it('disabled flags clear the visible prototype', () => {
    let fetchCalls = 0;
    const markup = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototype, {
      data: makeRepairableWeightData(),
      config: disabledConfig,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response('{}');
      },
    }));

    expect(markup).toBe('');
    expect(fetchCalls).toBe(0);
  });

  it('issue target changes clear stale confirmation in the prototype source', () => {
    const source = readSource('src/devApi/DevApiDataHealthDismissPrototype.tsx');

    expect(source).toContain('const changeIssue = (issueId: string)');
    expect(source).toContain('setConfirmed(false)');
    expect(source).toContain('onIssueChange={changeIssue}');
  });
});

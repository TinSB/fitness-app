import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  canSubmitDataHealthDismissPrototype,
  createDataHealthDismissMetadata,
  createDataHealthDismissSourceContext,
  DevApiDataHealthDismissPrototypePanel,
} from '../src/devApi/DevApiDataHealthDismissPrototype';
import {
  dismissDataHealthIssueViaDevApi,
  type DevApiDataHealthDismissFetch,
} from '../src/devApi/devApiDataHealthDismissClient';
import type { DevApiDataHealthDismissEnabledConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { makeRepairableWeightData } from './recordDataHealthMutationFixtures';

const config: DevApiDataHealthDismissEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'datahealth-dismiss',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

const successBody = {
  result: {
    ok: true,
    changed: true,
    status: 'success',
    reasonCode: 'data_health_issue_dismissed',
    message: 'dismissed',
  },
  snapshot: {
    snapshotId: 'snapshot-acceptance-1',
    schemaVersion: 1,
    createdAt: '2026-05-10T00:00:00.000Z',
  },
};

const sourceContext = createDataHealthDismissSourceContext(makeRepairableWeightData())!;
const metadata = createDataHealthDismissMetadata({
  issueId: sourceContext.issueId,
  sourceFingerprint: sourceContext.sourceFingerprint,
  nowIso: '2026-05-10T00:00:00.000Z',
});

const buttonMarkup = (markup: string) => markup.match(/<button[\s\S]*?<\/button>/)?.[0] || '';

describe('DataHealth dismiss acceptance interaction states', () => {
  it('requires confirmation before submit is allowed', () => {
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

  it('treats cancel or unchecked confirmation as no-submit state', () => {
    expect(canSubmitDataHealthDismissPrototype({
      config,
      sourceContext,
      confirmed: true,
      pending: false,
    })).toBe(true);
    expect(canSubmitDataHealthDismissPrototype({
      config,
      sourceContext,
      confirmed: false,
      pending: false,
    })).toBe(false);
  });

  it('sends exactly one approved POST when confirmed', async () => {
    const calls: Array<{ url: string; method?: string; body?: string | null }> = [];
    const fetchImpl: DevApiDataHealthDismissFetch = async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method,
        body: typeof init?.body === 'string' ? init.body : null,
      });
      return new Response(JSON.stringify(successBody), { status: 200 });
    };

    const result = await dismissDataHealthIssueViaDevApi({
      issueId: sourceContext.issueId,
      config,
      metadata,
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      url: `http://127.0.0.1:8787/data-health/issues/${encodeURIComponent(sourceContext.issueId)}/dismiss`,
      method: 'POST',
      body: JSON.stringify({ confirmed: true }),
    });
  });

  it('disables duplicate submit while pending and does not show optimistic success', () => {
    expect(canSubmitDataHealthDismissPrototype({
      config,
      sourceContext,
      confirmed: true,
      pending: true,
    })).toBe(false);

    const markup = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototypePanel, {
      config,
      sourceContext,
      selectedIssueId: sourceContext.issueId,
      confirmed: true,
      pending: true,
      state: { status: 'pending', issueId: sourceContext.issueId, metadata },
    }));

    expect(buttonMarkup(markup)).toContain('disabled');
    expect(markup).toContain('Pending');
    expect(markup).not.toContain('Snapshot recorded');
    expect(markup).not.toContain('Success</dd>');
  });

  it('renders success only as local-preserving copy after snapshot metadata exists', () => {
    const markup = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototypePanel, {
      config,
      sourceContext,
      selectedIssueId: sourceContext.issueId,
      confirmed: false,
      pending: false,
      state: {
        status: 'success',
        issueId: sourceContext.issueId,
        metadata,
        snapshot: successBody.snapshot,
      },
    }));

    expect(markup).toContain('Snapshot recorded: snapshot-acceptance-1');
    expect(markup).toContain('No data was changed locally');
    expect(canSubmitDataHealthDismissPrototype({
      config,
      sourceContext,
      confirmed: false,
      pending: false,
    })).toBe(false);
  });
});

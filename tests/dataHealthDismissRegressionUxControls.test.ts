import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  canSubmitDataHealthDismissPrototype,
  createDataHealthDismissMetadata,
  createDataHealthDismissSourceContext,
  createDataHealthDismissSubmitLock,
  DevApiDataHealthDismissPrototypePanel,
} from '../src/devApi/DevApiDataHealthDismissPrototype';
import type { DevApiDataHealthDismissEnabledConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { makeRepairableWeightData } from './recordDataHealthMutationFixtures';

const config: DevApiDataHealthDismissEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'datahealth-dismiss',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

const sourceContext = createDataHealthDismissSourceContext(makeRepairableWeightData())!;
const metadata = createDataHealthDismissMetadata({
  issueId: sourceContext.issueId,
  sourceFingerprint: sourceContext.sourceFingerprint,
  nowIso: '2026-05-10T00:00:00.000Z',
});

const buttonMarkup = (markup: string) => markup.match(/<button[\s\S]*?<\/button>/)?.[0] || '';
const forbiddenControlPattern = /\b(repair|sync|overwrite|import|export|reset|apply|fix|migrate)\b/i;

describe('DataHealth dismiss regression UX/control lock', () => {
  it('requires explicit confirmation before any submit is eligible', () => {
    expect(canSubmitDataHealthDismissPrototype({
      config,
      sourceContext,
      confirmed: false,
      pending: false,
    })).toBe(false);
    expect(canSubmitDataHealthDismissPrototype({
      config,
      sourceContext,
      confirmed: true,
      pending: false,
    })).toBe(true);

    const markup = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototypePanel, {
      config,
      sourceContext,
      selectedIssueId: sourceContext.issueId,
      confirmed: false,
      pending: false,
      state: { status: 'idle' },
    }));

    expect(markup).toContain('Dev-only mutation experiment');
    expect(markup).toContain('localStorage remains source of truth');
    expect(markup).toContain('I confirm this one-route dev request');
    expect(buttonMarkup(markup)).toContain('disabled');
    expect(markup).not.toMatch(forbiddenControlPattern);
  });

  it('locks pending and duplicate-submit behavior without optimistic success', () => {
    const lock = createDataHealthDismissSubmitLock();
    expect(lock.acquire()).toBe(true);
    expect(lock.acquire()).toBe(false);
    lock.release();
    expect(lock.acquire()).toBe(true);

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
      state: {
        status: 'pending',
        issueId: sourceContext.issueId,
        metadata,
        duplicateSubmitBlocked: true,
      },
    }));

    expect(buttonMarkup(markup)).toContain('disabled');
    expect(markup).toContain('Pending');
    expect(markup).toContain('Duplicate attempt');
    expect(markup).toContain('blocked');
    expect(markup).not.toContain('Snapshot recorded');
    expect(markup).not.toContain('Success</dd>');
    expect(markup).not.toMatch(forbiddenControlPattern);
  });

  it('requires re-confirmation after failure and never exposes forbidden controls', () => {
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
      state: {
        status: 'failure',
        issueId: sourceContext.issueId,
        metadata,
        error: {
          code: 'dev_mutation_not_successful',
          serverCode: 'no_change',
          message: 'Already dismissed.',
        },
      },
    }));

    expect(markup).toContain('Failure');
    expect(markup).toContain('no_change');
    expect(buttonMarkup(markup)).toContain('disabled');
    expect(markup).not.toContain('Snapshot recorded');
    expect(markup).not.toMatch(forbiddenControlPattern);
  });

  it('renders success as local-preserving copy only', () => {
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
        snapshot: {
          snapshotId: 'snapshot-ux-regression',
          schemaVersion: 1,
          createdAt: '2026-05-10T00:00:00.000Z',
        },
      },
    }));

    expect(markup).toContain('Snapshot recorded: snapshot-ux-regression');
    expect(markup).toContain('No data was changed locally');
    expect(markup).toContain('localStorage remains source of truth');
    expect(markup).not.toMatch(forbiddenControlPattern);
  });
});

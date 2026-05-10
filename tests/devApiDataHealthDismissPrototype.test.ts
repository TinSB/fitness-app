import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  createDataHealthDismissMetadata,
  createDataHealthDismissSourceContext,
  DevApiDataHealthDismissPrototype,
  DevApiDataHealthDismissPrototypePanel,
} from '../src/devApi/DevApiDataHealthDismissPrototype';
import type { DevApiDataHealthDismissConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { makeRepairableWeightData } from './recordDataHealthMutationFixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

const enabledConfig: DevApiDataHealthDismissConfig = {
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

describe('Dev API DataHealth dismiss prototype', () => {
  it('renders nothing when disabled and performs no fetch', () => {
    const data = makeRepairableWeightData();
    let fetchCalls = 0;
    const markup = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototype, {
      data,
      config: disabledConfig,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response('{}');
      },
    }));

    expect(markup).toBe('');
    expect(fetchCalls).toBe(0);
  });

  it('does not render mutation UI for read-only compare flag alone', () => {
    const data = makeRepairableWeightData();
    const markup = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototype, {
      data,
      config: { enabled: false, status: 'disabled', reason: 'mutation_flag_off' },
    }));

    expect(markup).toBe('');
  });

  it('renders the minimal dev-only prototype when enabled', () => {
    const data = makeRepairableWeightData();
    const markup = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototype, {
      data,
      config: enabledConfig,
    }));

    expect(markup).toContain('Dev API DataHealth dismiss experiment');
    expect(markup).toContain('Dev-only mutation experiment');
    expect(markup).toContain('localStorage remains source of truth');
    expect(markup).toContain('Send dismiss request');
    expect(markup).not.toMatch(/\b(repair|sync|overwrite|import|export|reset|apply|fix)\b/i);
  });

  it('shows safe misconfiguration diagnostics without fetch', () => {
    const data = makeRepairableWeightData();
    let fetchCalls = 0;
    const markup = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototype, {
      data,
      config: {
        enabled: false,
        status: 'invalid',
        error: {
          code: 'dev_api_non_localhost_base_url',
          message: 'Dev API read-only comparison base URL must be localhost-only.',
        },
      },
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response('{}');
      },
    }));

    expect(markup).toContain('Misconfigured');
    expect(markup).toContain('localhost Dev API base URL');
    expect(markup).not.toContain('example.com');
    expect(fetchCalls).toBe(0);
  });

  it('requires confirmation and disables duplicate submit while pending', () => {
    const data = makeRepairableWeightData();
    const sourceContext = createDataHealthDismissSourceContext(data)!;
    const withoutConfirmation = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototypePanel, {
      config: enabledConfig,
      confirmed: false,
      pending: false,
      selectedIssueId: sourceContext.issueId,
      sourceContext,
      state: { status: 'idle' },
    }));
    const pending = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototypePanel, {
      config: enabledConfig,
      confirmed: true,
      pending: true,
      selectedIssueId: sourceContext.issueId,
      sourceContext,
      state: { status: 'pending', issueId: sourceContext.issueId },
    }));

    expect(withoutConfirmation.match(/<button[\s\S]*?<\/button>/)?.[0]).toContain('disabled');
    expect(pending.match(/<button[\s\S]*?<\/button>/)?.[0]).toContain('disabled');
    expect(pending).toContain('Pending');
  });

  it('shows success only with snapshot metadata and keeps copy local-only', () => {
    const data = makeRepairableWeightData();
    const sourceContext = createDataHealthDismissSourceContext(data)!;
    const metadata = createDataHealthDismissMetadata({
      issueId: sourceContext.issueId,
      sourceFingerprint: sourceContext.sourceFingerprint,
      nowIso: '2026-05-10T00:00:00.000Z',
    });
    const markup = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototypePanel, {
      config: enabledConfig,
      confirmed: false,
      pending: false,
      selectedIssueId: sourceContext.issueId,
      sourceContext,
      state: {
        status: 'success',
        issueId: sourceContext.issueId,
        metadata,
        snapshot: {
          snapshotId: 'snapshot-1',
          schemaVersion: 1,
          createdAt: '2026-05-10T00:00:00.000Z',
        },
      },
    }));

    expect(markup).toContain('Success');
    expect(markup).toContain('Snapshot recorded: snapshot-1');
    expect(markup).toContain('No data was changed locally');
  });

  it('shows failure state without throwing to App root', () => {
    const data = makeRepairableWeightData();
    const sourceContext = createDataHealthDismissSourceContext(data)!;
    const markup = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototypePanel, {
      config: enabledConfig,
      confirmed: true,
      pending: false,
      selectedIssueId: sourceContext.issueId,
      sourceContext,
      state: {
        status: 'failure',
        issueId: sourceContext.issueId,
        error: {
          code: 'dev_mutation_unavailable',
          message: 'DataHealth dismiss request is unavailable.',
        },
      },
    }));

    expect(markup).toContain('Failure');
    expect(markup).toContain('dev_mutation_unavailable');
  });

  it('does not mutate AppData while building source context or rendering', () => {
    const data = makeRepairableWeightData();
    const before = JSON.stringify(data);

    createDataHealthDismissSourceContext(data);
    renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototype, {
      data,
      config: enabledConfig,
    }));

    expect(JSON.stringify(data)).toBe(before);
  });

  it('does not import persistence or write localStorage', () => {
    const source = readSource('src/devApi/DevApiDataHealthDismissPrototype.tsx');
    expect(source).not.toMatch(/setData|saveData|loadData|localStorageAdapter/);
    expect(source).not.toMatch(/localStorage\.(getItem|setItem|removeItem|clear)|window\.localStorage|globalThis\.localStorage/);
    expect(source).not.toMatch(/node:http|node:sqlite|serverAdapter|sqliteRepository/);
  });
});

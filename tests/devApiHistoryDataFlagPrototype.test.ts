import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  canSubmitHistoryDataFlagPrototype,
  createHistoryDataFlagMetadata,
  createHistoryDataFlagSourceContext,
  createHistoryDataFlagSubmitLock,
  DevApiHistoryDataFlagPrototype,
  DevApiHistoryDataFlagPrototypePanel,
} from '../src/devApi/DevApiHistoryDataFlagPrototype';
import type { DevApiHistoryDataFlagConfig } from '../src/devApi/devApiHistoryDataFlagConfig';
import { makeAppData } from './fixtures';
import { makeRecordData } from './recordDataHealthMutationFixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

const enabledConfig: DevApiHistoryDataFlagConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'history-data-flag',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

const disabledConfig: DevApiHistoryDataFlagConfig = {
  enabled: false,
  status: 'disabled',
  reason: 'mutation_flag_off',
};

describe('Dev API History data-flag prototype', () => {
  it('renders nothing when disabled and performs no fetch', () => {
    const data = makeRecordData();
    let fetchCalls = 0;
    const markup = renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototype, {
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
    const data = makeRecordData();
    const markup = renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototype, {
      data,
      config: { enabled: false, status: 'disabled', reason: 'mutation_flag_off' },
    }));

    expect(markup).toBe('');
  });

  it('renders the minimal dev-only prototype only with a stable target record', () => {
    const data = makeRecordData();
    const markup = renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototype, {
      data,
      config: enabledConfig,
    }));

    expect(markup).toContain('Dev API History data-flag experiment');
    expect(markup).toContain('Dev-only mutation experiment');
    expect(markup).toContain('localStorage remains source of truth');
    expect(markup).toContain('Current dataFlag: normal');
    expect(markup).toContain('Target dataFlag: test');
    expect(markup).toContain('Statistics may change');
    expect(markup).toContain('Send dataFlag request');
    expect(markup).not.toMatch(/\b(repair|sync|overwrite|import|export|reset|apply|fix)\b/i);
  });

  it('shows safe empty-state diagnostics with no POST when no stable record exists', () => {
    const data = makeAppData({ history: [] });
    let fetchCalls = 0;
    const markup = renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototype, {
      data,
      config: enabledConfig,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response('{}');
      },
    }));

    expect(markup).toContain('No stable history record is available');
    expect(markup).toContain('No request was sent');
    expect(fetchCalls).toBe(0);
  });

  it('shows safe misconfiguration diagnostics without fetch', () => {
    const data = makeRecordData();
    let fetchCalls = 0;
    const markup = renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototype, {
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
    const data = makeRecordData();
    const sourceContext = createHistoryDataFlagSourceContext(data)!;
    const withoutConfirmation = renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototypePanel, {
      config: enabledConfig,
      confirmed: false,
      pending: false,
      selectedSessionId: sourceContext.sessionId,
      sourceContext,
      targetDataFlag: sourceContext.targetDataFlag,
      state: { status: 'idle' },
    }));
    const pending = renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototypePanel, {
      config: enabledConfig,
      confirmed: true,
      pending: true,
      selectedSessionId: sourceContext.sessionId,
      sourceContext,
      targetDataFlag: sourceContext.targetDataFlag,
      state: { status: 'pending', sessionId: sourceContext.sessionId },
    }));
    const lock = createHistoryDataFlagSubmitLock();

    expect(withoutConfirmation.match(/<button[\s\S]*?<\/button>/)?.[0]).toContain('disabled');
    expect(pending.match(/<button[\s\S]*?<\/button>/)?.[0]).toContain('disabled');
    expect(pending).toContain('Pending');
    expect(lock.acquire()).toBe(true);
    expect(lock.acquire()).toBe(false);
    lock.release();
    expect(lock.acquire()).toBe(true);
  });

  it('can submit only after explicit confirmation with source context', () => {
    const data = makeRecordData();
    const sourceContext = createHistoryDataFlagSourceContext(data)!;

    expect(canSubmitHistoryDataFlagPrototype({
      config: enabledConfig,
      sourceContext,
      confirmed: false,
      pending: false,
    })).toBe(false);
    expect(canSubmitHistoryDataFlagPrototype({
      config: enabledConfig,
      sourceContext,
      confirmed: true,
      pending: false,
    })).toBe(true);
    expect(canSubmitHistoryDataFlagPrototype({
      config: enabledConfig,
      sourceContext,
      confirmed: true,
      pending: true,
    })).toBe(false);
  });

  it('shows success only with snapshot metadata and keeps copy local-only', () => {
    const data = makeRecordData();
    const sourceContext = createHistoryDataFlagSourceContext(data)!;
    const metadata = createHistoryDataFlagMetadata({
      sessionId: sourceContext.sessionId,
      targetDataFlag: sourceContext.targetDataFlag,
      sourceFingerprint: sourceContext.sourceFingerprint,
      nowIso: '2026-05-10T00:00:00.000Z',
    });
    const markup = renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototypePanel, {
      config: enabledConfig,
      confirmed: false,
      pending: false,
      selectedSessionId: sourceContext.sessionId,
      sourceContext,
      targetDataFlag: sourceContext.targetDataFlag,
      state: {
        status: 'success',
        sessionId: sourceContext.sessionId,
        targetDataFlag: sourceContext.targetDataFlag,
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
    const data = makeRecordData();
    const sourceContext = createHistoryDataFlagSourceContext(data)!;
    const markup = renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototypePanel, {
      config: enabledConfig,
      confirmed: true,
      pending: false,
      selectedSessionId: sourceContext.sessionId,
      sourceContext,
      targetDataFlag: sourceContext.targetDataFlag,
      state: {
        status: 'failure',
        sessionId: sourceContext.sessionId,
        error: {
          code: 'dev_mutation_unavailable',
          message: 'History data-flag request is unavailable.',
        },
      },
    }));

    expect(markup).toContain('Failure');
    expect(markup).toContain('dev_mutation_unavailable');
  });

  it('does not mutate AppData while building source context or rendering', () => {
    const data = makeRecordData();
    const before = JSON.stringify(data);

    createHistoryDataFlagSourceContext(data);
    renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototype, {
      data,
      config: enabledConfig,
    }));

    expect(JSON.stringify(data)).toBe(before);
  });

  it('does not import persistence or write localStorage', () => {
    const source = readSource('src/devApi/DevApiHistoryDataFlagPrototype.tsx');
    expect(source).not.toMatch(/setData|saveData|loadData|localStorageAdapter/);
    expect(source).not.toMatch(/localStorage\.(getItem|setItem|removeItem|clear)|window\.localStorage|globalThis\.localStorage/);
    expect(source).not.toMatch(/node:http|node:sqlite|serverAdapter|sqliteRepository/);
  });
});

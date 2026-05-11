import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  canSubmitSessionCompletePrototype,
  createSessionCompleteDiagnosticSummary,
  createSessionCompleteMetadata,
  createSessionCompleteSourceContext,
  createSessionCompleteSubmitLock,
  DevApiSessionCompletePrototype,
  DevApiSessionCompletePrototypePanel,
} from '../src/devApi/DevApiSessionCompletePrototype';
import type { DevApiSessionCompleteConfig } from '../src/devApi/devApiSessionCompleteConfig';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

const enabledConfig: DevApiSessionCompleteConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'session-complete',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

const disabledConfig: DevApiSessionCompleteConfig = {
  enabled: false,
  status: 'disabled',
  reason: 'mutation_flag_off',
};

const dataWithTarget = () => makeAppData({
  activeSession: makeFocusSession([makeExercise('bench-press', 2, 2)]),
});

describe('Dev API session complete prototype', () => {
  it('renders nothing when disabled and performs no fetch', () => {
    let fetchCalls = 0;
    const markup = renderToStaticMarkup(createElement(DevApiSessionCompletePrototype, {
      data: dataWithTarget(),
      config: disabledConfig,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response('{}');
      },
    }));

    expect(markup).toBe('');
    expect(fetchCalls).toBe(0);
  });

  it('renders the dev-only prototype only with a stable active session', () => {
    const markup = renderToStaticMarkup(createElement(DevApiSessionCompletePrototype, {
      data: dataWithTarget(),
      config: enabledConfig,
    }));

    expect(markup).toContain('Dev API session complete experiment');
    expect(markup).toContain('Dev-only mutation experiment');
    expect(markup).toContain('localStorage remains source of truth');
    expect(markup).toContain('Active session target');
    expect(markup).toContain('Completed sets: 2');
    expect(markup).not.toMatch(/\b(repair|sync|overwrite|import|export|reset|apply|fix|migrate)\b/i);
  });

  it('blocks when no active session target is available', () => {
    const noActive = createSessionCompleteSourceContext(makeAppData({ activeSession: null }));
    const markup = renderToStaticMarkup(createElement(DevApiSessionCompletePrototype, {
      data: makeAppData({ activeSession: null }),
      config: enabledConfig,
    }));

    expect(noActive).toBeNull();
    expect(markup).toContain('No stable session-complete target is available');
    expect(markup).toContain('No request was sent');
  });

  it('builds stable source context and metadata without mutating AppData', () => {
    const data = dataWithTarget();
    const before = JSON.stringify(data);
    const context = createSessionCompleteSourceContext(data);

    expect(context).toMatchObject({
      activeSessionId: 'session-focus',
      sourceSnapshotVersion: 'phase5-session-complete-v1',
      exerciseCount: 1,
      completedSetCount: 2,
    });
    expect(context?.sourceSnapshotHash).toMatch(/^session-complete-/);

    const metadata = createSessionCompleteMetadata({
      sourceContext: context!,
      nowIso: '2026-05-11T00:00:00.000Z',
    });
    expect(metadata).toMatchObject({
      activeSessionId: 'session-focus',
      confirmed: true,
      sourceSnapshotHash: context?.sourceSnapshotHash,
      sourceSnapshotVersion: 'phase5-session-complete-v1',
    });
    expect(metadata.mutationId).toMatch(/^session-complete-/);
    expect(metadata.idempotencyKey).toContain(metadata.requestFingerprint);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('requires confirmation and disables duplicate submit while pending', () => {
    const sourceContext = createSessionCompleteSourceContext(dataWithTarget())!;
    const withoutConfirmation = renderToStaticMarkup(createElement(DevApiSessionCompletePrototypePanel, {
      config: enabledConfig,
      confirmed: false,
      pending: false,
      sourceContext,
      state: { status: 'idle' },
    }));
    const pending = renderToStaticMarkup(createElement(DevApiSessionCompletePrototypePanel, {
      config: enabledConfig,
      confirmed: true,
      pending: true,
      sourceContext,
      state: { status: 'pending', activeSessionId: sourceContext.activeSessionId },
    }));
    const lock = createSessionCompleteSubmitLock();

    expect(withoutConfirmation.match(/<button[\s\S]*?<\/button>/)?.[0]).toContain('disabled');
    expect(pending.match(/<button[\s\S]*?<\/button>/)?.[0]).toContain('disabled');
    expect(pending).toContain('Pending');
    expect(lock.acquire()).toBe(true);
    expect(lock.acquire()).toBe(false);
    lock.release();
    expect(lock.acquire()).toBe(true);
  });

  it('can submit only after confirmation with source snapshot metadata', () => {
    const sourceContext = createSessionCompleteSourceContext(dataWithTarget())!;

    expect(canSubmitSessionCompletePrototype({
      config: enabledConfig,
      sourceContext,
      confirmed: false,
      pending: false,
    })).toBe(false);
    expect(canSubmitSessionCompletePrototype({
      config: enabledConfig,
      sourceContext,
      confirmed: true,
      pending: false,
    })).toBe(true);
    expect(canSubmitSessionCompletePrototype({
      config: enabledConfig,
      sourceContext: { ...sourceContext, sourceSnapshotHash: '' },
      confirmed: true,
      pending: false,
    })).toBe(false);
    expect(canSubmitSessionCompletePrototype({
      config: enabledConfig,
      sourceContext,
      confirmed: true,
      pending: true,
    })).toBe(false);
  });

  it('shows success only with snapshot metadata and keeps copy local-only', () => {
    const sourceContext = createSessionCompleteSourceContext(dataWithTarget())!;
    const metadata = createSessionCompleteMetadata({
      sourceContext,
      nowIso: '2026-05-11T00:00:00.000Z',
    });
    const markup = renderToStaticMarkup(createElement(DevApiSessionCompletePrototypePanel, {
      config: enabledConfig,
      confirmed: false,
      pending: false,
      sourceContext,
      state: {
        status: 'success',
        activeSessionId: sourceContext.activeSessionId,
        metadata,
        snapshot: {
          snapshotId: 'snapshot-1',
          schemaVersion: 1,
          createdAt: '2026-05-11T00:00:00.000Z',
        },
      },
    }));

    expect(markup).toContain('Success');
    expect(markup).toContain('Snapshot recorded: snapshot-1');
    expect(markup).toContain('No App data was changed locally');
  });

  it('shows safe failure diagnostics and recovery note', () => {
    const sourceContext = createSessionCompleteSourceContext(dataWithTarget())!;
    const state = {
      status: 'failure' as const,
      activeSessionId: sourceContext.activeSessionId,
      error: {
        code: 'dev_mutation_not_successful' as const,
        serverCode: 'no_active_session',
        message: 'Current dev snapshot has no session.',
      },
    };
    const markup = renderToStaticMarkup(createElement(DevApiSessionCompletePrototypePanel, {
      config: enabledConfig,
      confirmed: true,
      pending: false,
      sourceContext,
      state,
    }));
    const diagnostic = createSessionCompleteDiagnosticSummary({ state, sourceContext, confirmed: true });

    expect(markup).toContain('Failure');
    expect(markup).toContain('no_active_session');
    expect(diagnostic).toMatchObject({
      state: 'failure',
      failureCode: 'no_active_session',
      snapshotMetadataPresent: false,
    });
  });

  it('does not import persistence or write localStorage', () => {
    const source = readSource('src/devApi/DevApiSessionCompletePrototype.tsx');
    expect(source).not.toMatch(/setData|saveData|loadData|localStorageAdapter/);
    expect(source).not.toMatch(/localStorage\.(getItem|setItem|removeItem|clear)|window\.localStorage|globalThis\.localStorage/);
    expect(source).not.toMatch(/node:http|node:sqlite|serverAdapter|sqliteRepository/);
  });
});

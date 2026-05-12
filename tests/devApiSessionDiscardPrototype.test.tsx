import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  canSubmitSessionDiscardPrototype,
  createSessionDiscardDiagnosticSummary,
  createSessionDiscardMetadata,
  createSessionDiscardSourceContext,
  createSessionDiscardSubmitLock,
  DevApiSessionDiscardPrototype,
  DevApiSessionDiscardPrototypePanel,
} from '../src/devApi/DevApiSessionDiscardPrototype';
import type { DevApiSessionDiscardConfig } from '../src/devApi/devApiSessionDiscardConfig';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

const enabledConfig: DevApiSessionDiscardConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'session-discard',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

const disabledConfig: DevApiSessionDiscardConfig = {
  enabled: false,
  status: 'disabled',
  reason: 'mutation_flag_off',
};

const dataWithTarget = () => makeAppData({
  activeSession: makeFocusSession([makeExercise('bench-press', 2, 1)]),
});

describe('Dev API session discard prototype', () => {
  it('renders nothing when disabled and performs no fetch', () => {
    let fetchCalls = 0;
    const markup = renderToStaticMarkup(createElement(DevApiSessionDiscardPrototype, {
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
    const markup = renderToStaticMarkup(createElement(DevApiSessionDiscardPrototype, {
      data: dataWithTarget(),
      config: enabledConfig,
    }));

    expect(markup).toContain('Dev API session discard experiment');
    expect(markup).toContain('Dev-only mutation experiment');
    expect(markup).toContain('localStorage remains source of truth');
    expect(markup).toContain('Active session target');
    expect(markup).toContain('Completed sets: 1');
    expect(markup).not.toMatch(/\b(repair|sync|overwrite|import|export|reset|apply|fix|migrate)\b/i);
  });

  it('blocks when no active session target is available', () => {
    const noActive = createSessionDiscardSourceContext(makeAppData({ activeSession: null }));
    const markup = renderToStaticMarkup(createElement(DevApiSessionDiscardPrototype, {
      data: makeAppData({ activeSession: null }),
      config: enabledConfig,
    }));

    expect(noActive).toBeNull();
    expect(markup).toContain('No stable session-discard target is available');
    expect(markup).toContain('No request was sent');
  });

  it('builds stable source context and metadata without mutating AppData', () => {
    const data = dataWithTarget();
    const before = JSON.stringify(data);
    const context = createSessionDiscardSourceContext(data);

    expect(context).toMatchObject({
      activeSessionId: 'session-focus',
      sourceSnapshotVersion: 'phase5-session-discard-v1',
      exerciseCount: 1,
      completedSetCount: 1,
    });
    expect(context?.sourceSnapshotHash).toMatch(/^session-discard-/);

    const metadata = createSessionDiscardMetadata({
      sourceContext: context!,
      nowIso: '2026-05-12T00:00:00.000Z',
    });
    expect(metadata).toMatchObject({
      activeSessionId: 'session-focus',
      confirmed: true,
      confirmDiscard: true,
      sourceSnapshotHash: context?.sourceSnapshotHash,
      sourceSnapshotVersion: 'phase5-session-discard-v1',
    });
    expect(metadata.mutationId).toMatch(/^session-discard-/);
    expect(metadata.idempotencyKey).toContain(metadata.requestFingerprint);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('requires strong confirmation and disables duplicate submit while pending', () => {
    const sourceContext = createSessionDiscardSourceContext(dataWithTarget())!;
    const withoutConfirmation = renderToStaticMarkup(createElement(DevApiSessionDiscardPrototypePanel, {
      config: enabledConfig,
      confirmed: false,
      pending: false,
      sourceContext,
      state: { status: 'idle' },
    }));
    const pending = renderToStaticMarkup(createElement(DevApiSessionDiscardPrototypePanel, {
      config: enabledConfig,
      confirmed: true,
      pending: true,
      sourceContext,
      state: { status: 'pending', activeSessionId: sourceContext.activeSessionId },
    }));
    const lock = createSessionDiscardSubmitLock();

    expect(withoutConfirmation.match(/<button[\s\S]*?<\/button>/)?.[0]).toContain('disabled');
    expect(pending.match(/<button[\s\S]*?<\/button>/)?.[0]).toContain('disabled');
    expect(pending).toContain('Pending');
    expect(lock.acquire()).toBe(true);
    expect(lock.acquire()).toBe(false);
    lock.release();
    expect(lock.acquire()).toBe(true);
  });

  it('can submit only after confirmation with source snapshot metadata', () => {
    const sourceContext = createSessionDiscardSourceContext(dataWithTarget())!;

    expect(canSubmitSessionDiscardPrototype({
      config: enabledConfig,
      sourceContext,
      confirmed: false,
      pending: false,
    })).toBe(false);
    expect(canSubmitSessionDiscardPrototype({
      config: enabledConfig,
      sourceContext,
      confirmed: true,
      pending: false,
    })).toBe(true);
    expect(canSubmitSessionDiscardPrototype({
      config: enabledConfig,
      sourceContext: { ...sourceContext, sourceSnapshotHash: '' },
      confirmed: true,
      pending: false,
    })).toBe(false);
    expect(canSubmitSessionDiscardPrototype({
      config: enabledConfig,
      sourceContext,
      confirmed: true,
      pending: true,
    })).toBe(false);
  });

  it('shows success only with snapshot metadata and keeps copy local-only', () => {
    const sourceContext = createSessionDiscardSourceContext(dataWithTarget())!;
    const metadata = createSessionDiscardMetadata({
      sourceContext,
      nowIso: '2026-05-12T00:00:00.000Z',
    });
    const markup = renderToStaticMarkup(createElement(DevApiSessionDiscardPrototypePanel, {
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
          createdAt: '2026-05-12T00:00:00.000Z',
        },
      },
    }));

    expect(markup).toContain('Success');
    expect(markup).toContain('Snapshot recorded: snapshot-1');
    expect(markup).toContain('No App data was changed locally');
  });

  it('shows safe failure diagnostics and recovery note', () => {
    const sourceContext = createSessionDiscardSourceContext(dataWithTarget())!;
    const state = {
      status: 'failure' as const,
      activeSessionId: sourceContext.activeSessionId,
      error: {
        code: 'dev_mutation_not_successful' as const,
        serverCode: 'discard_requires_confirmation',
        message: 'Discard confirmation required.',
      },
    };
    const markup = renderToStaticMarkup(createElement(DevApiSessionDiscardPrototypePanel, {
      config: enabledConfig,
      confirmed: true,
      pending: false,
      sourceContext,
      state,
    }));
    const diagnostic = createSessionDiscardDiagnosticSummary({ state, sourceContext, confirmed: true });

    expect(markup).toContain('Failure');
    expect(markup).toContain('discard_requires_confirmation');
    expect(diagnostic).toMatchObject({
      state: 'failure',
      failureCode: 'discard_requires_confirmation',
      snapshotMetadataPresent: false,
    });
  });

  it('does not import persistence or write localStorage', () => {
    const source = readSource('src/devApi/DevApiSessionDiscardPrototype.tsx');
    expect(source).not.toMatch(/setData|saveData|loadData|localStorageAdapter/);
    expect(source).not.toMatch(/localStorage\.(getItem|setItem|removeItem|clear)|window\.localStorage|globalThis\.localStorage/);
    expect(source).not.toMatch(/node:http|node:sqlite|serverAdapter|sqliteRepository/);
  });
});

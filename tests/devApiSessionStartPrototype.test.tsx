import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  canSubmitSessionStartPrototype,
  createSessionStartDiagnosticSummary,
  createSessionStartMetadata,
  createSessionStartSourceContext,
  createSessionStartSubmitLock,
  DevApiSessionStartPrototype,
  DevApiSessionStartPrototypePanel,
} from '../src/devApi/DevApiSessionStartPrototype';
import type { DevApiSessionStartConfig } from '../src/devApi/devApiSessionStartConfig';
import { makeAppData, getTemplate } from './fixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

const enabledConfig: DevApiSessionStartConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'session-start',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

const disabledConfig: DevApiSessionStartConfig = {
  enabled: false,
  status: 'disabled',
  reason: 'mutation_flag_off',
};

describe('Dev API session start prototype', () => {
  it('renders nothing when disabled and performs no fetch', () => {
    const data = makeAppData();
    let fetchCalls = 0;
    const markup = renderToStaticMarkup(createElement(DevApiSessionStartPrototype, {
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

  it('renders the dev-only prototype only with a stable target and no active session', () => {
    const data = makeAppData({ selectedTemplateId: 'push-a', activeSession: null });
    const markup = renderToStaticMarkup(createElement(DevApiSessionStartPrototype, {
      data,
      config: enabledConfig,
    }));

    expect(markup).toContain('Dev API session start experiment');
    expect(markup).toContain('Dev-only mutation experiment');
    expect(markup).toContain('localStorage remains source of truth');
    expect(markup).toContain('Target template');
    expect(markup).toContain(getTemplate('push-a').name);
    expect(markup).not.toMatch(/\b(repair|sync|overwrite|import|export|reset|apply|fix|migrate)\b/i);
  });

  it('blocks when local App state already has an active session', () => {
    const activeSession = {
      id: 'active-1',
      date: '2026-05-11',
      templateId: 'push-a',
      templateName: 'Push A',
      trainingMode: 'hybrid' as const,
      focus: 'push',
      exercises: [],
      status: makeAppData().todayStatus,
      completed: false,
    };
    const data = makeAppData({ activeSession });
    const context = createSessionStartSourceContext(data);
    const markup = renderToStaticMarkup(createElement(DevApiSessionStartPrototype, {
      data,
      config: enabledConfig,
    }));

    expect(context).toMatchObject({ hasActiveSession: true, activeSessionId: 'active-1', sourceSnapshotHash: '' });
    expect(markup).toContain('Local App state already has an active session');
    expect(markup).toContain('No request was sent');
  });

  it('builds stable source context and metadata without mutating AppData', () => {
    const data = makeAppData({ selectedTemplateId: 'push-a' });
    const before = JSON.stringify(data);
    const context = createSessionStartSourceContext(data);

    expect(context).toMatchObject({
      templateId: 'push-a',
      hasActiveSession: false,
      sourceSnapshotVersion: 'phase4-active-session-v1',
    });
    expect(context?.sourceSnapshotHash).toMatch(/^session-start-/);

    const metadata = createSessionStartMetadata({
      sourceContext: context!,
      nowIso: '2026-05-11T00:00:00.000Z',
    });
    expect(metadata).toMatchObject({
      templateId: 'push-a',
      confirmed: true,
      sourceSnapshotHash: context?.sourceSnapshotHash,
      sourceSnapshotVersion: 'phase4-active-session-v1',
    });
    expect(metadata.mutationId).toMatch(/^session-start-/);
    expect(metadata.idempotencyKey).toContain(metadata.requestFingerprint);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('requires confirmation and disables duplicate submit while pending', () => {
    const sourceContext = createSessionStartSourceContext(makeAppData())!;
    const withoutConfirmation = renderToStaticMarkup(createElement(DevApiSessionStartPrototypePanel, {
      config: enabledConfig,
      confirmed: false,
      pending: false,
      sourceContext,
      state: { status: 'idle' },
    }));
    const pending = renderToStaticMarkup(createElement(DevApiSessionStartPrototypePanel, {
      config: enabledConfig,
      confirmed: true,
      pending: true,
      sourceContext,
      state: { status: 'pending', templateId: sourceContext.templateId },
    }));
    const lock = createSessionStartSubmitLock();

    expect(withoutConfirmation.match(/<button[\s\S]*?<\/button>/)?.[0]).toContain('disabled');
    expect(pending.match(/<button[\s\S]*?<\/button>/)?.[0]).toContain('disabled');
    expect(pending).toContain('Pending');
    expect(lock.acquire()).toBe(true);
    expect(lock.acquire()).toBe(false);
    lock.release();
    expect(lock.acquire()).toBe(true);
  });

  it('can submit only after confirmation with source snapshot metadata', () => {
    const sourceContext = createSessionStartSourceContext(makeAppData())!;

    expect(canSubmitSessionStartPrototype({
      config: enabledConfig,
      sourceContext,
      confirmed: false,
      pending: false,
    })).toBe(false);
    expect(canSubmitSessionStartPrototype({
      config: enabledConfig,
      sourceContext,
      confirmed: true,
      pending: false,
    })).toBe(true);
    expect(canSubmitSessionStartPrototype({
      config: enabledConfig,
      sourceContext: { ...sourceContext, sourceSnapshotHash: '' },
      confirmed: true,
      pending: false,
    })).toBe(false);
    expect(canSubmitSessionStartPrototype({
      config: enabledConfig,
      sourceContext,
      confirmed: true,
      pending: true,
    })).toBe(false);
  });

  it('shows success only with snapshot metadata and keeps copy local-only', () => {
    const sourceContext = createSessionStartSourceContext(makeAppData())!;
    const metadata = createSessionStartMetadata({
      sourceContext,
      nowIso: '2026-05-11T00:00:00.000Z',
    });
    const markup = renderToStaticMarkup(createElement(DevApiSessionStartPrototypePanel, {
      config: enabledConfig,
      confirmed: false,
      pending: false,
      sourceContext,
      state: {
        status: 'success',
        templateId: sourceContext.templateId,
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
    const sourceContext = createSessionStartSourceContext(makeAppData())!;
    const state = {
      status: 'failure' as const,
      templateId: sourceContext.templateId,
      error: {
        code: 'dev_mutation_not_successful' as const,
        serverCode: 'active_session_exists',
        message: 'Current dev snapshot already has a session.',
      },
    };
    const markup = renderToStaticMarkup(createElement(DevApiSessionStartPrototypePanel, {
      config: enabledConfig,
      confirmed: true,
      pending: false,
      sourceContext,
      state,
    }));
    const diagnostic = createSessionStartDiagnosticSummary({ state, sourceContext, confirmed: true });

    expect(markup).toContain('Failure');
    expect(markup).toContain('active_session_exists');
    expect(diagnostic).toMatchObject({
      state: 'failure',
      failureCode: 'active_session_exists',
      snapshotMetadataPresent: false,
    });
  });

  it('does not import persistence or write localStorage', () => {
    const source = readSource('src/devApi/DevApiSessionStartPrototype.tsx');
    expect(source).not.toMatch(/setData|saveData|loadData|localStorageAdapter/);
    expect(source).not.toMatch(/localStorage\.(getItem|setItem|removeItem|clear)|window\.localStorage|globalThis\.localStorage/);
    expect(source).not.toMatch(/node:http|node:sqlite|serverAdapter|sqliteRepository/);
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  canSubmitSessionPatchPrototype,
  createSessionPatchDiagnosticSummary,
  createSessionPatchMetadata,
  createSessionPatchSourceContext,
  createSessionPatchSubmitLock,
  DevApiSessionPatchPrototype,
  DevApiSessionPatchPrototypePanel,
} from '../src/devApi/DevApiSessionPatchPrototype';
import type { DevApiSessionPatchConfig } from '../src/devApi/devApiSessionPatchConfig';
import type { PendingSessionPatch } from '../src/models/training-model';
import { makeAppData } from './fixtures';
import { makeExercise, makeFocusSession } from './focusModeFixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

const enabledConfig: DevApiSessionPatchConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'session-patch',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

const disabledConfig: DevApiSessionPatchConfig = {
  enabled: false,
  status: 'disabled',
  reason: 'mutation_flag_off',
};

const pendingPatch: PendingSessionPatch = {
  id: 'pending-main-only',
  createdAt: '2026-05-11T00:00:00.000Z',
  sourceFingerprint: 'daily-adjustment-main-only',
  targetTemplateId: 'push-a',
  status: 'pending',
  patches: [{
    id: 'patch-main-only',
    type: 'main_only',
    title: 'Main work only',
    description: 'Keep main lifts only.',
    reason: 'Fatigue',
    reversible: true,
  }],
};

const dataWithTarget = () => makeAppData({
  activeSession: makeFocusSession([makeExercise('bench-press', 3, 0)]),
  pendingSessionPatches: [pendingPatch],
  settings: { pendingSessionPatches: [pendingPatch] },
});

describe('Dev API session patch prototype', () => {
  it('renders nothing when disabled and performs no fetch', () => {
    const data = dataWithTarget();
    let fetchCalls = 0;
    const markup = renderToStaticMarkup(createElement(DevApiSessionPatchPrototype, {
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

  it('renders the dev-only prototype only with a stable active session and pending patch', () => {
    const markup = renderToStaticMarkup(createElement(DevApiSessionPatchPrototype, {
      data: dataWithTarget(),
      config: enabledConfig,
    }));

    expect(markup).toContain('Dev API session patch experiment');
    expect(markup).toContain('Dev-only mutation experiment');
    expect(markup).toContain('localStorage remains source of truth');
    expect(markup).toContain('Pending patch target');
    expect(markup).toContain('Main work only');
    expect(markup).not.toMatch(/\b(repair|sync|overwrite|import|export|reset|apply|fix|migrate)\b/i);
  });

  it('blocks when no active session or pending patch target is available', () => {
    const noActive = createSessionPatchSourceContext(makeAppData({
      activeSession: null,
      pendingSessionPatches: [pendingPatch],
      settings: { pendingSessionPatches: [pendingPatch] },
    }));
    const noPatch = createSessionPatchSourceContext(makeAppData({
      activeSession: makeFocusSession([makeExercise('bench-press', 3, 0)]),
      pendingSessionPatches: [],
      settings: { pendingSessionPatches: [] },
    }));
    const markup = renderToStaticMarkup(createElement(DevApiSessionPatchPrototype, {
      data: makeAppData({ activeSession: null }),
      config: enabledConfig,
    }));

    expect(noActive).toBeNull();
    expect(noPatch).toBeNull();
    expect(markup).toContain('No stable session-patch target is available');
    expect(markup).toContain('No request was sent');
  });

  it('builds stable source context and metadata without mutating AppData', () => {
    const data = dataWithTarget();
    const before = JSON.stringify(data);
    const context = createSessionPatchSourceContext(data);

    expect(context).toMatchObject({
      activeSessionId: 'session-focus',
      pendingPatchId: 'pending-main-only',
      sourceSnapshotVersion: 'phase5-session-patch-v1',
    });
    expect(context?.sourceSnapshotHash).toMatch(/^session-patch-/);

    const metadata = createSessionPatchMetadata({
      sourceContext: context!,
      nowIso: '2026-05-11T00:00:00.000Z',
    });
    expect(metadata).toMatchObject({
      activeSessionId: 'session-focus',
      pendingPatchId: 'pending-main-only',
      confirmed: true,
      sourceSnapshotHash: context?.sourceSnapshotHash,
      sourceSnapshotVersion: 'phase5-session-patch-v1',
    });
    expect(metadata.mutationId).toMatch(/^session-patch-/);
    expect(metadata.idempotencyKey).toContain(metadata.requestFingerprint);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('requires confirmation and disables duplicate submit while pending', () => {
    const sourceContext = createSessionPatchSourceContext(dataWithTarget())!;
    const withoutConfirmation = renderToStaticMarkup(createElement(DevApiSessionPatchPrototypePanel, {
      config: enabledConfig,
      confirmed: false,
      pending: false,
      sourceContext,
      state: { status: 'idle' },
    }));
    const pending = renderToStaticMarkup(createElement(DevApiSessionPatchPrototypePanel, {
      config: enabledConfig,
      confirmed: true,
      pending: true,
      sourceContext,
      state: { status: 'pending', activeSessionId: sourceContext.activeSessionId, pendingPatchId: sourceContext.pendingPatchId },
    }));
    const lock = createSessionPatchSubmitLock();

    expect(withoutConfirmation.match(/<button[\s\S]*?<\/button>/)?.[0]).toContain('disabled');
    expect(pending.match(/<button[\s\S]*?<\/button>/)?.[0]).toContain('disabled');
    expect(pending).toContain('Pending');
    expect(lock.acquire()).toBe(true);
    expect(lock.acquire()).toBe(false);
    lock.release();
    expect(lock.acquire()).toBe(true);
  });

  it('can submit only after confirmation with source snapshot metadata', () => {
    const sourceContext = createSessionPatchSourceContext(dataWithTarget())!;

    expect(canSubmitSessionPatchPrototype({
      config: enabledConfig,
      sourceContext,
      confirmed: false,
      pending: false,
    })).toBe(false);
    expect(canSubmitSessionPatchPrototype({
      config: enabledConfig,
      sourceContext,
      confirmed: true,
      pending: false,
    })).toBe(true);
    expect(canSubmitSessionPatchPrototype({
      config: enabledConfig,
      sourceContext: { ...sourceContext, sourceSnapshotHash: '' },
      confirmed: true,
      pending: false,
    })).toBe(false);
    expect(canSubmitSessionPatchPrototype({
      config: enabledConfig,
      sourceContext,
      confirmed: true,
      pending: true,
    })).toBe(false);
  });

  it('shows success only with snapshot metadata and keeps copy local-only', () => {
    const sourceContext = createSessionPatchSourceContext(dataWithTarget())!;
    const metadata = createSessionPatchMetadata({
      sourceContext,
      nowIso: '2026-05-11T00:00:00.000Z',
    });
    const markup = renderToStaticMarkup(createElement(DevApiSessionPatchPrototypePanel, {
      config: enabledConfig,
      confirmed: false,
      pending: false,
      sourceContext,
      state: {
        status: 'success',
        activeSessionId: sourceContext.activeSessionId,
        pendingPatchId: sourceContext.pendingPatchId,
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
    const sourceContext = createSessionPatchSourceContext(dataWithTarget())!;
    const state = {
      status: 'failure' as const,
      activeSessionId: sourceContext.activeSessionId,
      pendingPatchId: sourceContext.pendingPatchId,
      error: {
        code: 'dev_mutation_not_successful' as const,
        serverCode: 'no_active_session',
        message: 'Current dev snapshot has no session.',
      },
    };
    const markup = renderToStaticMarkup(createElement(DevApiSessionPatchPrototypePanel, {
      config: enabledConfig,
      confirmed: true,
      pending: false,
      sourceContext,
      state,
    }));
    const diagnostic = createSessionPatchDiagnosticSummary({ state, sourceContext, confirmed: true });

    expect(markup).toContain('Failure');
    expect(markup).toContain('no_active_session');
    expect(diagnostic).toMatchObject({
      state: 'failure',
      failureCode: 'no_active_session',
      snapshotMetadataPresent: false,
    });
  });

  it('does not import persistence or write localStorage', () => {
    const source = readSource('src/devApi/DevApiSessionPatchPrototype.tsx');
    expect(source).not.toMatch(/setData|saveData|loadData|localStorageAdapter/);
    expect(source).not.toMatch(/localStorage\.(getItem|setItem|removeItem|clear)|window\.localStorage|globalThis\.localStorage/);
    expect(source).not.toMatch(/node:http|node:sqlite|serverAdapter|sqliteRepository/);
  });
});

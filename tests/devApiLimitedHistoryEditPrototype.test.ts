import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  canSubmitHistorySetEditPrototype,
  createDefaultHistorySetEditPatchDraft,
  createHistorySetEditMetadata,
  createHistorySetEditSourceContext,
  createHistorySetEditSubmitLock,
  DevApiHistorySetEditExperiment,
  DevApiHistorySetEditExperimentPanel,
} from '../src/devApi/DevApiHistorySetEditExperiment';
import type { DevApiHistorySetEditConfig } from '../src/devApi/devApiHistorySetEditConfig';
import { makeAppData } from './fixtures';
import { makeRecordData } from './recordDataHealthMutationFixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

const enabledConfig: DevApiHistorySetEditConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'limited-history-edit',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

const disabledConfig: DevApiHistorySetEditConfig = {
  enabled: false,
  status: 'disabled',
  reason: 'mutation_flag_off',
};

describe('Dev API limited history edit prototype', () => {
  it('renders nothing when disabled and performs no fetch', () => {
    const data = makeRecordData();
    let fetchCalls = 0;
    const markup = renderToStaticMarkup(createElement(DevApiHistorySetEditExperiment, {
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

  it('does not render mutation UI for compare flag alone or wrong mutation flag', () => {
    const data = makeRecordData();
    expect(renderToStaticMarkup(createElement(DevApiHistorySetEditExperiment, {
      data,
      config: { enabled: false, status: 'disabled', reason: 'mutation_flag_off' },
    }))).toBe('');
    expect(renderToStaticMarkup(createElement(DevApiHistorySetEditExperiment, {
      data,
      config: { enabled: false, status: 'disabled', reason: 'mutation_flag_off' },
    }))).toBe('');
  });

  it('renders the minimal dev-only prototype only with a stable target session, exercise, and set', () => {
    const data = makeRecordData();
    const markup = renderToStaticMarkup(createElement(DevApiHistorySetEditExperiment, {
      data,
      config: enabledConfig,
    }));

    expect(markup).toContain('Dev API history set edit experiment');
    expect(markup).toContain('Dev-only mutation experiment');
    expect(markup).toContain('localStorage remains source of truth');
    expect(markup).toContain('Target session');
    expect(markup).toContain('Target exercise');
    expect(markup).toContain('Target set');
    expect(markup).toContain('Before values');
    expect(markup).toContain('After values');
    expect(markup).toContain('Changed fields');
    expect(markup).toContain('Calculation impact warning');
    expect(markup).not.toMatch(/\b(repair|sync|overwrite|import|export|reset|apply|fix)\b/i);
  });

  it('shows safe empty-state diagnostics with no POST when no stable target exists', () => {
    const data = makeAppData({ history: [] });
    let fetchCalls = 0;
    const markup = renderToStaticMarkup(createElement(DevApiHistorySetEditExperiment, {
      data,
      config: enabledConfig,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response('{}');
      },
    }));

    expect(markup).toContain('No stable history session, exercise, and set target is available');
    expect(markup).toContain('No request was sent');
    expect(fetchCalls).toBe(0);
  });

  it('shows before/after values and changed fields from allowed patch fields', () => {
    const data = makeRecordData();
    const context = createHistorySetEditSourceContext(
      data,
      'record-mutation-session',
      'bench-press',
      'bench-press-1',
      { ...createDefaultHistorySetEditPatchDraft(), note: 'reviewed in dev' },
    );

    expect(context).toMatchObject({
      sessionId: 'record-mutation-session',
      exerciseId: 'bench-press',
      setId: 'bench-press-1',
      changedFields: ['note'],
    });
    expect(context?.beforeValues.note).toBe('');
    expect(context?.afterValues.note).toBe('reviewed in dev');
    expect(context?.sourceFingerprint).toMatch(/^history-set-edit-/);
  });

  it('requires confirmation and disables duplicate submit while pending', () => {
    const data = makeRecordData();
    const sourceContext = createHistorySetEditSourceContext(data)!;
    const patchDraft = createDefaultHistorySetEditPatchDraft(sourceContext.selectedSet);
    const withoutConfirmation = renderToStaticMarkup(createElement(DevApiHistorySetEditExperimentPanel, {
      config: enabledConfig,
      confirmed: false,
      pending: false,
      patchDraft,
      sourceContext,
      state: { status: 'idle' },
    }));
    const pending = renderToStaticMarkup(createElement(DevApiHistorySetEditExperimentPanel, {
      config: enabledConfig,
      confirmed: true,
      pending: true,
      patchDraft,
      sourceContext,
      state: { status: 'pending', sessionId: sourceContext.sessionId },
    }));
    const lock = createHistorySetEditSubmitLock();

    expect(withoutConfirmation.match(/<button[\s\S]*?<\/button>/)?.[0]).toContain('disabled');
    expect(pending.match(/<button[\s\S]*?<\/button>/)?.[0]).toContain('disabled');
    expect(pending).toContain('Pending');
    expect(lock.acquire()).toBe(true);
    expect(lock.acquire()).toBe(false);
    lock.release();
    expect(lock.acquire()).toBe(true);
  });

  it('can submit only after explicit confirmation with source context and changed fields', () => {
    const data = makeRecordData();
    const sourceContext = createHistorySetEditSourceContext(data)!;

    expect(canSubmitHistorySetEditPrototype({
      config: enabledConfig,
      sourceContext,
      confirmed: false,
      pending: false,
    })).toBe(false);
    expect(canSubmitHistorySetEditPrototype({
      config: enabledConfig,
      sourceContext,
      confirmed: true,
      pending: false,
    })).toBe(true);
    expect(canSubmitHistorySetEditPrototype({
      config: enabledConfig,
      sourceContext,
      confirmed: true,
      pending: true,
    })).toBe(false);
  });

  it('shows success only with snapshot metadata and keeps copy local-only', () => {
    const data = makeRecordData();
    const sourceContext = createHistorySetEditSourceContext(data)!;
    const metadata = createHistorySetEditMetadata({
      sessionId: sourceContext.sessionId,
      exerciseId: sourceContext.exerciseId,
      setId: sourceContext.setId,
      changedFields: sourceContext.changedFields,
      sourceFingerprint: sourceContext.sourceFingerprint,
      nowIso: '2026-05-10T00:00:00.000Z',
    });
    const markup = renderToStaticMarkup(createElement(DevApiHistorySetEditExperimentPanel, {
      config: enabledConfig,
      confirmed: false,
      pending: false,
      patchDraft: createDefaultHistorySetEditPatchDraft(sourceContext.selectedSet),
      sourceContext,
      state: {
        status: 'success',
        sessionId: sourceContext.sessionId,
        exerciseId: sourceContext.exerciseId,
        setId: sourceContext.setId,
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
    const sourceContext = createHistorySetEditSourceContext(data)!;
    const markup = renderToStaticMarkup(createElement(DevApiHistorySetEditExperimentPanel, {
      config: enabledConfig,
      confirmed: true,
      pending: false,
      patchDraft: createDefaultHistorySetEditPatchDraft(sourceContext.selectedSet),
      sourceContext,
      state: {
        status: 'failure',
        sessionId: sourceContext.sessionId,
        exerciseId: sourceContext.exerciseId,
        setId: sourceContext.setId,
        error: {
          code: 'dev_mutation_unavailable',
          message: 'History set edit request is unavailable.',
        },
      },
    }));

    expect(markup).toContain('Failure');
    expect(markup).toContain('dev_mutation_unavailable');
  });

  it('does not mutate AppData while building source context or rendering', () => {
    const data = makeRecordData();
    const before = JSON.stringify(data);

    createHistorySetEditSourceContext(data);
    renderToStaticMarkup(createElement(DevApiHistorySetEditExperiment, {
      data,
      config: enabledConfig,
    }));

    expect(JSON.stringify(data)).toBe(before);
  });

  it('does not import persistence or write localStorage', () => {
    const source = readSource('src/devApi/DevApiHistorySetEditExperiment.tsx');
    expect(source).not.toMatch(/setData|saveData|loadData|localStorageAdapter/);
    expect(source).not.toMatch(/localStorage\.(getItem|setItem|removeItem|clear)|window\.localStorage|globalThis\.localStorage/);
    expect(source).not.toMatch(/node:http|node:sqlite|serverAdapter|sqliteRepository/);
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  canSubmitHistorySetEditPrototype,
  createDefaultHistorySetEditPatchDraft,
  createHistorySetEditSourceContext,
  createHistorySetEditSubmitLock,
  DevApiHistorySetEditExperimentPanel,
} from '../src/devApi/DevApiHistorySetEditExperiment';
import type { DevApiHistorySetEditConfig } from '../src/devApi/devApiHistorySetEditConfig';
import { makeAppData } from './fixtures';
import { makeRecordData } from './recordDataHealthMutationFixtures';

const enabledConfig: DevApiHistorySetEditConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'limited-history-edit',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

describe('limited history edit acceptance interaction states', () => {
  it('keeps no stable target safely disabled with no source context', () => {
    expect(createHistorySetEditSourceContext(makeAppData({ history: [] }))).toBeNull();
    expect(canSubmitHistorySetEditPrototype({
      config: enabledConfig,
      sourceContext: null,
      confirmed: true,
      pending: false,
    })).toBe(false);
  });

  it('shows target, before/after values, changed fields, calculation impact, and source-of-truth copy', () => {
    const sourceContext = createHistorySetEditSourceContext(makeRecordData())!;
    const markup = renderToStaticMarkup(createElement(DevApiHistorySetEditExperimentPanel, {
      config: enabledConfig,
      confirmed: false,
      pending: false,
      patchDraft: createDefaultHistorySetEditPatchDraft(sourceContext.selectedSet),
      sourceContext,
      state: { status: 'idle' },
    }));

    expect(markup).toContain('Target session');
    expect(markup).toContain('Target exercise');
    expect(markup).toContain('Target set');
    expect(markup).toContain('Before values');
    expect(markup).toContain('After values');
    expect(markup).toContain('Changed fields');
    expect(markup).toContain('Calculation impact warning');
    expect(markup).toContain('localStorage remains source of truth');
  });

  it('requires confirmation, disables pending submit, and blocks duplicate acquisition', () => {
    const sourceContext = createHistorySetEditSourceContext(makeRecordData())!;

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

    const lock = createHistorySetEditSubmitLock();
    expect(lock.acquire()).toBe(true);
    expect(lock.acquire()).toBe(false);
    lock.release();
    expect(lock.acquire()).toBe(true);
  });

  it('fingerprint changes when target or patch changes, preventing stale confirmation trust', () => {
    const data = makeRecordData();
    const base = createHistorySetEditSourceContext(data, undefined, undefined, undefined, {
      ...createDefaultHistorySetEditPatchDraft(),
      note: 'first',
    })!;
    const nextPatch = createHistorySetEditSourceContext(data, base.sessionId, base.exerciseId, base.setId, {
      ...createDefaultHistorySetEditPatchDraft(),
      note: 'second',
    })!;

    expect(base.sourceFingerprint).not.toBe(nextPatch.sourceFingerprint);
    expect(base.afterValues.note).toBe('first');
    expect(nextPatch.afterValues.note).toBe('second');
  });
});

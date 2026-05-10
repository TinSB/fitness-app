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
import { makeRecordData } from './recordDataHealthMutationFixtures';

const config: DevApiHistorySetEditConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'limited-history-edit',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

describe('limited history edit hardening confirmation and duplicate-submit', () => {
  it('requires confirmation and changed fields before submit', () => {
    const data = makeRecordData();
    const sourceContext = createHistorySetEditSourceContext(data)!;
    const noChangeContext = createHistorySetEditSourceContext(data, sourceContext.sessionId, sourceContext.exerciseId, sourceContext.setId, {
      ...createDefaultHistorySetEditPatchDraft(sourceContext.selectedSet),
      note: sourceContext.beforeValues.note,
    })!;

    expect(canSubmitHistorySetEditPrototype({ config, sourceContext, confirmed: false, pending: false })).toBe(false);
    expect(canSubmitHistorySetEditPrototype({ config, sourceContext, confirmed: true, pending: false })).toBe(true);
    expect(canSubmitHistorySetEditPrototype({ config, sourceContext: noChangeContext, confirmed: true, pending: false })).toBe(false);
  });

  it('keeps pending state visibly disabled and duplicate attempts locked', () => {
    const sourceContext = createHistorySetEditSourceContext(makeRecordData())!;
    const markup = renderToStaticMarkup(createElement(DevApiHistorySetEditExperimentPanel, {
      config,
      confirmed: true,
      pending: true,
      patchDraft: createDefaultHistorySetEditPatchDraft(sourceContext.selectedSet),
      sourceContext,
      state: { status: 'pending', sessionId: sourceContext.sessionId, duplicateSubmitBlocked: true },
    }));
    const lock = createHistorySetEditSubmitLock();

    expect(markup).toContain('Pending');
    expect(markup).toContain('Duplicate attempt');
    expect(markup).toContain('blocked');
    expect(markup.match(/<button[\s\S]*?<\/button>/)?.[0]).toContain('disabled');
    expect(lock.acquire()).toBe(true);
    expect(lock.acquire()).toBe(false);
  });

  it('changes source fingerprint when patch changes', () => {
    const data = makeRecordData();
    const first = createHistorySetEditSourceContext(data, undefined, undefined, undefined, {
      ...createDefaultHistorySetEditPatchDraft(),
      note: 'first',
    })!;
    const second = createHistorySetEditSourceContext(data, first.sessionId, first.exerciseId, first.setId, {
      ...createDefaultHistorySetEditPatchDraft(),
      note: 'second',
    })!;

    expect(first.sourceFingerprint).not.toBe(second.sourceFingerprint);
  });
});

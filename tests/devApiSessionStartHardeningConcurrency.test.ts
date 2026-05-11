import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  canSubmitSessionStartPrototype,
  createSessionStartDiagnosticSummary,
  createSessionStartSourceContext,
  createSessionStartSubmitLock,
  DevApiSessionStartPrototypePanel,
} from '../src/devApi/DevApiSessionStartPrototype';
import type { DevApiSessionStartConfig } from '../src/devApi/devApiSessionStartConfig';
import { makeAppData } from './fixtures';

const enabledConfig: DevApiSessionStartConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'session-start',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

describe('Session Start hardening concurrency and confirmation', () => {
  it('blocks duplicate submit and disables submit while pending', () => {
    const sourceContext = createSessionStartSourceContext(makeAppData())!;
    const lock = createSessionStartSubmitLock();
    const pending = renderToStaticMarkup(createElement(DevApiSessionStartPrototypePanel, {
      config: enabledConfig,
      confirmed: true,
      pending: true,
      sourceContext,
      state: { status: 'pending', templateId: sourceContext.templateId, duplicateSubmitBlocked: true },
    }));

    expect(lock.acquire()).toBe(true);
    expect(lock.acquire()).toBe(false);
    lock.release();
    expect(lock.acquire()).toBe(true);
    expect(pending.match(/<button[\s\S]*?<\/button>/)?.[0]).toContain('disabled');
    expect(pending).toContain('Duplicate submit was blocked');
  });

  it('requires re-confirmation after failure and blocks active-session targets', () => {
    const sourceContext = createSessionStartSourceContext(makeAppData())!;
    const activeContext = createSessionStartSourceContext(makeAppData({
      activeSession: {
        id: 'active-1',
        date: '2026-05-11',
        templateId: 'push-a',
        templateName: 'Push A',
        trainingMode: 'hybrid',
        focus: 'push',
        exercises: [],
        status: makeAppData().todayStatus,
        completed: false,
      },
    }));

    expect(canSubmitSessionStartPrototype({ config: enabledConfig, sourceContext, confirmed: false, pending: false })).toBe(false);
    expect(canSubmitSessionStartPrototype({ config: enabledConfig, sourceContext, confirmed: true, pending: false })).toBe(true);
    expect(canSubmitSessionStartPrototype({ config: enabledConfig, sourceContext, confirmed: true, pending: true })).toBe(false);
    expect(canSubmitSessionStartPrototype({ config: enabledConfig, sourceContext: activeContext, confirmed: true, pending: false })).toBe(false);
  });

  it('reports failure diagnostics without snapshot success', () => {
    const sourceContext = createSessionStartSourceContext(makeAppData())!;
    const diagnostic = createSessionStartDiagnosticSummary({
      sourceContext,
      confirmed: false,
      state: {
        status: 'failure',
        templateId: sourceContext.templateId,
        error: { code: 'dev_mutation_not_successful', serverCode: 'active_session_exists', message: 'exists' },
      },
    });

    expect(diagnostic).toMatchObject({
      state: 'failure',
      failureCode: 'active_session_exists',
      snapshotMetadataPresent: false,
      duplicateSubmitBlocked: false,
    });
  });
});

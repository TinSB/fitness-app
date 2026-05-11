import { describe, expect, it } from 'vitest';
import {
  canSubmitSessionStartPrototype,
  createSessionStartMetadata,
  createSessionStartSourceContext,
  createSessionStartSubmitLock,
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

describe('Session Start acceptance interaction', () => {
  it('blocks submit without stable target, source snapshot, or confirmation', () => {
    const context = createSessionStartSourceContext(makeAppData())!;

    expect(canSubmitSessionStartPrototype({ config: enabledConfig, sourceContext: null, confirmed: true, pending: false })).toBe(false);
    expect(canSubmitSessionStartPrototype({ config: enabledConfig, sourceContext: { ...context, sourceSnapshotHash: '' }, confirmed: true, pending: false })).toBe(false);
    expect(canSubmitSessionStartPrototype({ config: enabledConfig, sourceContext: context, confirmed: false, pending: false })).toBe(false);
    expect(canSubmitSessionStartPrototype({ config: enabledConfig, sourceContext: context, confirmed: true, pending: false })).toBe(true);
  });

  it('blocks when local active session exists', () => {
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
    const context = createSessionStartSourceContext(makeAppData({ activeSession }));

    expect(context).toMatchObject({ hasActiveSession: true, sourceSnapshotHash: '' });
    expect(canSubmitSessionStartPrototype({ config: enabledConfig, sourceContext: context, confirmed: true, pending: false })).toBe(false);
  });

  it('creates metadata and prevents duplicate submit while pending', () => {
    const context = createSessionStartSourceContext(makeAppData())!;
    const metadata = createSessionStartMetadata({ sourceContext: context, nowIso: '2026-05-11T00:00:00.000Z' });
    const lock = createSessionStartSubmitLock();

    expect(metadata).toMatchObject({
      templateId: context.templateId,
      sourceSnapshotHash: context.sourceSnapshotHash,
      sourceSnapshotVersion: 'phase4-active-session-v1',
      confirmed: true,
    });
    expect(metadata.idempotencyKey).toContain(metadata.requestFingerprint);
    expect(lock.acquire()).toBe(true);
    expect(lock.acquire()).toBe(false);
    lock.release();
    expect(lock.acquire()).toBe(true);
  });
});

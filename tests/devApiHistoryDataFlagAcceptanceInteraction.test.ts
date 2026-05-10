import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  canSubmitHistoryDataFlagPrototype,
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

describe('History data-flag acceptance interaction behavior', () => {
  it('shows safe target-record diagnostics and sends no POST when no stable record exists', () => {
    let fetchCalls = 0;
    const markup = renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototype, {
      data: makeAppData({ history: [] }),
      config: enabledConfig,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response('{}');
      },
    }));

    expect(markup).toContain('No stable history record is available');
    expect(markup).toContain('No request was sent');
    expect(markup).toContain('Target record');
    expect(fetchCalls).toBe(0);
  });

  it('shows current and target dataFlag values with exactly the accepted target options', () => {
    const data = makeRecordData();
    const sourceContext = createHistoryDataFlagSourceContext(data)!;
    const markup = renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototypePanel, {
      config: enabledConfig,
      confirmed: false,
      pending: false,
      selectedSessionId: sourceContext.sessionId,
      sourceContext,
      targetDataFlag: sourceContext.targetDataFlag,
      state: { status: 'idle' },
    }));

    expect(markup).toContain('Current dataFlag: normal');
    expect(markup).toContain('Target dataFlag: test');
    expect(markup).toContain('Statistics may change');
    expect(markup).toContain('value="normal"');
    expect(markup).toContain('value="test"');
    expect(markup).toContain('value="excluded"');
    expect(markup).not.toContain('value="archived"');
  });

  it('requires explicit confirmation before submit and cancel clears confirmation without POST', () => {
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

    expect(withoutConfirmation.match(/<button[\s\S]*?Send dataFlag request[\s\S]*?<\/button>/)?.[0]).toContain('disabled');
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

    const source = readSource('src/devApi/DevApiHistoryDataFlagPrototype.tsx');
    expect(source).toMatch(/const cancel = \(\) => \{[\s\S]*setConfirmed\(false\);/);
    expect(source).toMatch(/if \(!confirmed \|\| state\.status === 'pending'\) return;/);
  });

  it('keeps pending visible, disables duplicate submit, and releases retry only after explicit re-confirmation', () => {
    const data = makeRecordData();
    const sourceContext = createHistoryDataFlagSourceContext(data)!;
    const lock = createHistoryDataFlagSubmitLock();
    const pending = renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototypePanel, {
      config: enabledConfig,
      confirmed: true,
      pending: true,
      selectedSessionId: sourceContext.sessionId,
      sourceContext,
      targetDataFlag: sourceContext.targetDataFlag,
      state: {
        status: 'pending',
        sessionId: sourceContext.sessionId,
        duplicateSubmitBlocked: true,
      },
    }));

    expect(pending).toContain('Pending');
    expect(pending).toContain('Duplicate attempt');
    expect(pending).toContain('blocked');
    expect(pending.match(/<button[\s\S]*?Pending[\s\S]*?<\/button>/)?.[0]).toContain('disabled');
    expect(lock.acquire()).toBe(true);
    expect(lock.acquire()).toBe(false);
    lock.release();
    expect(lock.acquire()).toBe(true);

    const source = readSource('src/devApi/DevApiHistoryDataFlagPrototype.tsx');
    expect(source).toMatch(/if \(result\.ok\) \{[\s\S]*setConfirmed\(false\);/);
    expect(source).toMatch(/status: 'failure'[\s\S]*setConfirmed\(false\);/);
  });

  it('clears stale confirmation when target record or target dataFlag changes', () => {
    const source = readSource('src/devApi/DevApiHistoryDataFlagPrototype.tsx');

    expect(source).toMatch(/const changeSession = \(sessionId: string\) => \{[\s\S]*setConfirmed\(false\);/);
    expect(source).toMatch(/const changeTargetDataFlag = \(dataFlag: HistoryDataFlagValue\) => \{[\s\S]*setConfirmed\(false\);/);
    expect(source).toMatch(/setSelectedSessionId\(sourceContext\.sessionId\);[\s\S]*setConfirmed\(false\);/);
  });

  it('does not expose forbidden action controls in the acceptance UI', () => {
    const data = makeRecordData();
    const markup = renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototype, {
      data,
      config: enabledConfig,
    }));

    expect(markup).not.toMatch(/\b(repair|sync|overwrite|import|export|reset|apply|fix|migrate)\b/i);
  });
});

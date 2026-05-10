import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  createHistoryDataFlagSourceContext,
  createHistoryDataFlagSubmitLock,
  DevApiHistoryDataFlagPrototypePanel,
} from '../src/devApi/DevApiHistoryDataFlagPrototype';
import type { DevApiHistoryDataFlagConfig } from '../src/devApi/devApiHistoryDataFlagConfig';
import { makeRecordData } from './recordDataHealthMutationFixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

const enabledConfig: DevApiHistoryDataFlagConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'history-data-flag',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

describe('History data-flag hardening concurrency behavior', () => {
  it('uses a synchronous pending lock so duplicate events can send only one request', () => {
    const lock = createHistoryDataFlagSubmitLock();

    expect(lock.acquire()).toBe(true);
    expect(lock.acquire()).toBe(false);
    expect(lock.isLocked()).toBe(true);
    lock.release();
    expect(lock.isLocked()).toBe(false);
    expect(lock.acquire()).toBe(true);
  });

  it('shows pending state, disables controls, and records duplicate-submit blocking', () => {
    const sourceContext = createHistoryDataFlagSourceContext(makeRecordData())!;
    const markup = renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototypePanel, {
      config: enabledConfig,
      confirmed: true,
      pending: true,
      selectedSessionId: sourceContext.sessionId,
      sourceContext,
      targetDataFlag: sourceContext.targetDataFlag,
      state: {
        status: 'pending',
        sessionId: sourceContext.sessionId,
        targetDataFlag: sourceContext.targetDataFlag,
        duplicateSubmitBlocked: true,
      },
    }));

    expect(markup).toContain('Pending');
    expect(markup).toContain('Duplicate attempt');
    expect(markup).toContain('blocked');
    expect(markup.match(/<button[\s\S]*?Pending[\s\S]*?<\/button>/)?.[0]).toContain('disabled');
    expect(markup).not.toContain('Snapshot recorded');
  });

  it('guards repeated click or repeated Enter before React state rerenders', () => {
    const source = readSource('src/devApi/DevApiHistoryDataFlagPrototype.tsx');

    expect(source).toContain('submitLockRef');
    expect(source).toMatch(/if \(!submitLockRef\.current\.acquire\(\)\) \{[\s\S]*duplicateSubmitBlocked: true/);
    expect(source).toMatch(/if \(!confirmed \|\| state\.status === 'pending'\) return;/);
    expect(source).toMatch(/submitLockRef\.current\.release\(\);[\s\S]*status: 'success'/);
    expect(source).toMatch(/submitLockRef\.current\.release\(\);[\s\S]*status: 'failure'/);
  });

  it('requires explicit re-confirmation after success or failure and does not auto-retry', () => {
    const source = readSource('src/devApi/DevApiHistoryDataFlagPrototype.tsx');

    expect(source).toMatch(/if \(result\.ok\) \{[\s\S]*setConfirmed\(false\);[\s\S]*return;/);
    expect(source).toMatch(/status: 'failure'[\s\S]*message: safeErrorMessage\(result\.error\),[\s\S]*setConfirmed\(false\);/);
    expect(source).not.toMatch(/setTimeout\([^)]*(submit|retry)|autoRetry/i);
  });

  it('does not set state after abort or unmount completion', () => {
    const source = readSource('src/devApi/DevApiHistoryDataFlagPrototype.tsx');

    expect(source).toMatch(/mountedRef\.current = false;[\s\S]*submitLockRef\.current\.release\(\);[\s\S]*controllerRef\.current\?\.abort\(\);/);
    expect(source).toMatch(/if \(controller\.signal\.aborted \|\| !mountedRef\.current\) \{[\s\S]*submitLockRef\.current\.release\(\);[\s\S]*return;/);
  });
});

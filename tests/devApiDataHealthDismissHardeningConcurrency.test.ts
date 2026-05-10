import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  canSubmitDataHealthDismissPrototype,
  createDataHealthDismissSubmitLock,
  createDataHealthDismissSourceContext,
  DevApiDataHealthDismissPrototypePanel,
} from '../src/devApi/DevApiDataHealthDismissPrototype';
import type { DevApiDataHealthDismissEnabledConfig } from '../src/devApi/devApiDataHealthDismissConfig';
import { makeRepairableWeightData } from './recordDataHealthMutationFixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

const config: DevApiDataHealthDismissEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'datahealth-dismiss',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 1500,
};

const sourceContext = createDataHealthDismissSourceContext(makeRepairableWeightData())!;
const buttonMarkup = (markup: string) => markup.match(/<button[\s\S]*?<\/button>/)?.[0] || '';

describe('DataHealth dismiss hardening concurrency behavior', () => {
  it('uses a synchronous lock so repeated submit attempts can only acquire once', () => {
    const lock = createDataHealthDismissSubmitLock();

    expect(lock.isLocked()).toBe(false);
    expect(lock.acquire()).toBe(true);
    expect(lock.acquire()).toBe(false);
    expect(lock.isLocked()).toBe(true);

    lock.release();

    expect(lock.isLocked()).toBe(false);
    expect(lock.acquire()).toBe(true);
  });

  it('pending disables submit and blocks repeated click or Enter attempts', () => {
    expect(canSubmitDataHealthDismissPrototype({
      config,
      sourceContext,
      confirmed: true,
      pending: true,
    })).toBe(false);

    const markup = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototypePanel, {
      config,
      sourceContext,
      selectedIssueId: sourceContext.issueId,
      confirmed: true,
      pending: true,
      state: { status: 'pending', issueId: sourceContext.issueId },
    }));

    expect(buttonMarkup(markup)).toContain('disabled');
    expect(markup).toContain('Pending');
    expect(markup).not.toContain('Snapshot recorded');
  });

  it('completion can release pending lock for explicit retry paths', () => {
    const lock = createDataHealthDismissSubmitLock();

    expect(lock.acquire()).toBe(true);
    lock.release();
    expect(lock.acquire()).toBe(true);
    lock.release();
    expect(lock.acquire()).toBe(true);
  });

  it('retry after failure requires explicit confirmation again', () => {
    expect(canSubmitDataHealthDismissPrototype({
      config,
      sourceContext,
      confirmed: false,
      pending: false,
    })).toBe(false);

    const markup = renderToStaticMarkup(createElement(DevApiDataHealthDismissPrototypePanel, {
      config,
      sourceContext,
      selectedIssueId: sourceContext.issueId,
      confirmed: false,
      pending: false,
      state: {
        status: 'failure',
        issueId: sourceContext.issueId,
        error: {
          code: 'dev_mutation_not_successful',
          message: 'No change.',
          serverCode: 'no_change',
        },
      },
    }));

    expect(markup).toContain('Failure');
    expect(buttonMarkup(markup)).toContain('disabled');
  });

  it('source includes abort/unmount guards before completion state updates', () => {
    const source = readSource('src/devApi/DevApiDataHealthDismissPrototype.tsx');

    expect(source).toContain('mountedRef.current = false');
    expect(source).toContain('controllerRef.current?.abort()');
    expect(source).toContain('controller.signal.aborted || !mountedRef.current');
    expect(source).toContain('submitLockRef.current.release()');
  });
});

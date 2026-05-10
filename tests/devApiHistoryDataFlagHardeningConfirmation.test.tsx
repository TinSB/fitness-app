import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  canSubmitHistoryDataFlagPrototype,
  createHistoryDataFlagSourceContext,
  DevApiHistoryDataFlagPrototype,
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

const disabledConfig: DevApiHistoryDataFlagConfig = {
  enabled: false,
  status: 'disabled',
  reason: 'mutation_flag_off',
};

describe('History data-flag hardening confirmation behavior', () => {
  it('requires confirmation and cancel prevents POST eligibility', () => {
    const sourceContext = createHistoryDataFlagSourceContext(makeRecordData())!;
    const markup = renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototypePanel, {
      config: enabledConfig,
      confirmed: false,
      pending: false,
      selectedSessionId: sourceContext.sessionId,
      sourceContext,
      targetDataFlag: sourceContext.targetDataFlag,
      state: { status: 'idle' },
    }));

    expect(canSubmitHistoryDataFlagPrototype({
      config: enabledConfig,
      sourceContext,
      confirmed: false,
      pending: false,
    })).toBe(false);
    expect(markup.match(/<button[\s\S]*?Send dataFlag request[\s\S]*?<\/button>/)?.[0]).toContain('disabled');

    const source = readSource('src/devApi/DevApiHistoryDataFlagPrototype.tsx');
    expect(source).toMatch(/const cancel = \(\) => \{[\s\S]*setConfirmed\(false\);/);
    expect(source).toMatch(/if \(!confirmed \|\| state\.status === 'pending'\) return;/);
  });

  it('resets confirmation after success and failure', () => {
    const source = readSource('src/devApi/DevApiHistoryDataFlagPrototype.tsx');

    expect(source).toMatch(/status: 'success'[\s\S]*message: 'Snapshot metadata was returned\. No data was changed locally\.',[\s\S]*\}\);[\s\S]*setConfirmed\(false\);/);
    expect(source).toMatch(/status: 'failure'[\s\S]*message: safeErrorMessage\(result\.error\),[\s\S]*\}\);[\s\S]*setConfirmed\(false\);/);
  });

  it('clears stale confirmation when target dataFlag or target record changes', () => {
    const source = readSource('src/devApi/DevApiHistoryDataFlagPrototype.tsx');

    expect(source).toMatch(/const changeTargetDataFlag = \(dataFlag: HistoryDataFlagValue\) => \{[\s\S]*setConfirmed\(false\);/);
    expect(source).toMatch(/const changeSession = \(sessionId: string\) => \{[\s\S]*setConfirmed\(false\);/);
    expect(source).toMatch(/setSelectedSessionId\(sourceContext\.sessionId\);[\s\S]*setTargetDataFlag\(fallbackTargetDataFlag\(sourceContext\.currentDataFlag\)\);[\s\S]*setConfirmed\(false\);/);
  });

  it('clears visible prototype state when disabled flags are supplied', () => {
    const markup = renderToStaticMarkup(createElement(DevApiHistoryDataFlagPrototype, {
      data: makeRecordData(),
      config: disabledConfig,
      fetchImpl: async () => new Response('{}'),
    }));
    const source = readSource('src/devApi/DevApiHistoryDataFlagPrototype.tsx');

    expect(markup).toBe('');
    expect(source).toMatch(/if \(!config\.enabled\) \{[\s\S]*submitLockRef\.current\.release\(\);[\s\S]*controllerRef\.current\?\.abort\(\);[\s\S]*setConfirmed\(false\);[\s\S]*setState\(\{ status: 'idle' \}\);/);
  });
});

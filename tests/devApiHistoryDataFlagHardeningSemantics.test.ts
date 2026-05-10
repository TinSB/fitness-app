import { describe, expect, it } from 'vitest';
import { buildReadMirrorHistoryDetail, buildReadMirrorHistoryList, buildReadMirrorSessionsSummary } from '../apps/api/src';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { filterAnalyticsHistory, markSessionDataFlag } from '../src/engines/sessionHistoryEngine';
import { isHistoryDataFlagValue, updateHistoryDataFlagViaDevApi, type DevApiHistoryDataFlagMetadata } from '../src/devApi/devApiHistoryDataFlagClient';
import type { DevApiHistoryDataFlagEnabledConfig } from '../src/devApi/devApiHistoryDataFlagConfig';
import { makeRecordData } from './recordDataHealthMutationFixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

const config: DevApiHistoryDataFlagEnabledConfig = {
  enabled: true,
  status: 'enabled',
  experiment: 'history-data-flag',
  baseUrl: 'http://127.0.0.1:8787',
  timeoutMs: 20,
};

const metadata: DevApiHistoryDataFlagMetadata = {
  sessionId: 'record-mutation-session',
  targetDataFlag: 'excluded',
  mutationId: 'mutation-1',
  idempotencyKey: 'key-1',
  requestFingerprint: 'request-1',
  sourceFingerprint: 'source-1',
  confirmed: true,
};

describe('History data-flag hardening data semantics', () => {
  it('keeps allowed values exactly normal, test, and excluded', async () => {
    expect(['normal', 'test', 'excluded'].filter(isHistoryDataFlagValue)).toEqual(['normal', 'test', 'excluded']);
    expect(['archived', 'deleted', 'ignored', '', null, undefined].filter(isHistoryDataFlagValue)).toEqual([]);

    let calls = 0;
    await expect(updateHistoryDataFlagViaDevApi({
      sessionId: 'record-mutation-session',
      targetDataFlag: 'ignored',
      config,
      metadata,
      fetchImpl: async () => {
        calls += 1;
        return new Response('{}');
      },
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'dev_mutation_invalid_data_flag' },
    });
    expect(calls).toBe(0);
  });

  it('keeps normal included and test/excluded visible but excluded from default statistics', () => {
    const data = makeRecordData();

    expect(buildReadMirrorHistoryList(data).sessions).toHaveLength(1);
    expect(buildReadMirrorHistoryDetail(data, 'record-mutation-session')?.session.dataFlag).toBe('normal');
    expect(buildReadMirrorSessionsSummary(data).analyticsSessionCount).toBe(1);
    expect(filterAnalyticsHistory(data.history)).toHaveLength(1);
    expect(buildEffectiveVolumeSummary(data.history).completedSets).toBeGreaterThan(0);

    for (const dataFlag of ['test', 'excluded'] as const) {
      const result = markSessionDataFlag(data, 'record-mutation-session', dataFlag, true);

      expect(result.session?.dataFlag).toBe(dataFlag);
      expect(buildReadMirrorHistoryList(result.data).sessions).toHaveLength(1);
      expect(buildReadMirrorHistoryDetail(result.data, 'record-mutation-session')?.session.dataFlag).toBe(dataFlag);
      expect(buildReadMirrorSessionsSummary(result.data).analyticsSessionCount).toBe(0);
      expect(buildReadMirrorSessionsSummary(result.data).byDataFlag[dataFlag]).toBe(1);
      expect(filterAnalyticsHistory(result.data.history)).toHaveLength(0);
      expect(buildEffectiveVolumeSummary(result.data.history).completedSets).toBe(0);
    }
  });

  it('does not change PR, e1RM, effective-set, training, or backup/import semantics', () => {
    for (const path of [
      'src/engines/effectiveSetEngine.ts',
      'src/engines/e1rmEngine.ts',
      'src/engines/progressionEngine.ts',
      'src/engines/sessionBuilder.ts',
      'src/storage/backup.ts',
    ]) {
      expect(readSource(path), `${path} should not contain History data-flag prototype wiring`).not.toContain('history-data-flag');
      expect(readSource(path), `${path} should not import the prototype`).not.toContain('DevApiHistoryDataFlag');
    }

    expect(readSource('src/engines/sessionHistoryEngine.ts')).toContain('filterAnalyticsHistory');
    expect(readSource('src/engines/sessionHistoryEngine.ts')).toContain('dataFlag');
  });
});

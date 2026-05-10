import { describe, expect, it } from 'vitest';
import { buildReadMirrorHistoryDetail, buildReadMirrorHistoryList, buildReadMirrorSessionsSummary } from '../apps/api/src';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { filterAnalyticsHistory, markSessionDataFlag } from '../src/engines/sessionHistoryEngine';
import { isHistoryDataFlagValue } from '../src/devApi/devApiHistoryDataFlagClient';
import { handleRecordDataHealthMutationRequest } from '../apps/api/src/recordDataHealthMutation';
import { makeRecordData, NOW } from './recordDataHealthMutationFixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('History data-flag acceptance data semantics', () => {
  it('locks allowed dataFlag values exactly to normal, test, and excluded', () => {
    const accepted = ['normal', 'test', 'excluded'];
    const rejected = ['archived', 'deleted', 'ignored', '', undefined, null];

    expect(accepted.filter(isHistoryDataFlagValue)).toEqual(['normal', 'test', 'excluded']);
    expect(rejected.filter(isHistoryDataFlagValue)).toEqual([]);
  });

  it('keeps test and excluded records visible but excluded from default production-like statistics', () => {
    const data = makeRecordData();
    const asTest = markSessionDataFlag(data, 'record-mutation-session', 'test', true);
    const asExcluded = markSessionDataFlag(data, 'record-mutation-session', 'excluded', true);

    for (const [label, result] of [['test', asTest], ['excluded', asExcluded]] as const) {
      expect(result.session?.dataFlag).toBe(label);
      expect(buildReadMirrorHistoryList(result.data).sessions).toHaveLength(1);
      expect(buildReadMirrorHistoryDetail(result.data, 'record-mutation-session')?.session.dataFlag).toBe(label);
      expect(buildReadMirrorSessionsSummary(result.data).analyticsSessionCount).toBe(0);
      expect(buildReadMirrorSessionsSummary(result.data).byDataFlag[label]).toBe(1);
      expect(filterAnalyticsHistory(result.data.history)).toHaveLength(0);
      expect(buildEffectiveVolumeSummary(result.data.history).completedSets).toBe(0);
    }
  });

  it('keeps normal records visible and included in default statistics', () => {
    const data = makeRecordData();

    expect(data.history[0].dataFlag).toBe('normal');
    expect(buildReadMirrorHistoryList(data).sessions).toHaveLength(1);
    expect(buildReadMirrorHistoryDetail(data, 'record-mutation-session')?.session.dataFlag).toBe('normal');
    expect(buildReadMirrorSessionsSummary(data).analyticsSessionCount).toBe(1);
    expect(buildReadMirrorSessionsSummary(data).byDataFlag.normal).toBe(1);
    expect(filterAnalyticsHistory(data.history)).toHaveLength(1);
    expect(buildEffectiveVolumeSummary(data.history).completedSets).toBeGreaterThan(0);
  });

  it('preserves readMirror/server parity after the accepted dataFlag route', () => {
    const data = makeRecordData();
    const response = handleRecordDataHealthMutationRequest(data, {
      method: 'POST',
      path: '/history/record-mutation-session/data-flag',
      nowIso: NOW,
      body: { dataFlag: 'excluded' },
    });

    expect(response.result).toMatchObject({
      ok: true,
      changed: true,
      status: 'success',
      reasonCode: 'record_updated',
    });
    expect(response.nextData).toBeDefined();
    expect(buildReadMirrorHistoryDetail(response.nextData!, 'record-mutation-session')?.session.dataFlag).toBe('excluded');
    expect(buildReadMirrorSessionsSummary(response.nextData!).analyticsSessionCount).toBe(0);
    expect(response.nextData!.history[0].editHistory?.at(-1)?.changedFields).toEqual(['dataFlag']);
  });

  it('does not change training algorithms or backup import/export semantics', () => {
    for (const path of [
      'src/engines/effectiveSetEngine.ts',
      'src/engines/e1rmEngine.ts',
      'src/engines/progressionEngine.ts',
      'src/engines/sessionBuilder.ts',
      'src/storage/backup.ts',
    ]) {
      expect(readSource(path), `${path} should not contain prototype wiring`).not.toContain('history-data-flag');
      expect(readSource(path), `${path} should not contain Dev API prototype imports`).not.toContain('DevApiHistoryDataFlag');
    }

    expect(readSource('src/engines/sessionHistoryEngine.ts')).toContain('dataFlag');
    expect(readSource('src/engines/sessionHistoryEngine.ts')).toContain('filterAnalyticsHistory');
  });
});

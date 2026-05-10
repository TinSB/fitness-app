import { describe, expect, it } from 'vitest';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { filterAnalyticsHistory, markSessionDataFlag } from '../src/engines/sessionHistoryEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { makeRecordData } from './recordDataHealthMutationFixtures';
import { readSource } from './runtimeBoundaryTestHelpers';

describe('Dev API History data-flag semantics', () => {
  it('locks allowed values and rejects invalid values in the browser client', async () => {
    const source = readSource('src/devApi/devApiHistoryDataFlagClient.ts');
    expect(source).toContain("'normal'");
    expect(source).toContain("'test'");
    expect(source).toContain("'excluded'");
    expect(source).toContain('dev_mutation_invalid_data_flag');
  });

  it('keeps test and excluded visible but excluded from default statistics', () => {
    const data = makeRecordData();
    const asTest = markSessionDataFlag(data, 'record-mutation-session', 'test', true);
    const asExcluded = markSessionDataFlag(data, 'record-mutation-session', 'excluded', true);

    expect(asTest.session?.dataFlag).toBe('test');
    expect(asExcluded.session?.dataFlag).toBe('excluded');
    expect(filterAnalyticsHistory(asTest.data.history)).toHaveLength(0);
    expect(filterAnalyticsHistory(asExcluded.data.history)).toHaveLength(0);
    expect(buildEffectiveVolumeSummary(asTest.data.history).completedSets).toBe(0);
    expect(buildEffectiveVolumeSummary(asExcluded.data.history).completedSets).toBe(0);
    expect(buildSessionDetailSummary(asTest.session!).excludedFromStats).toBe(true);
    expect(buildSessionDetailSummary(asExcluded.session!).excludedFromStats).toBe(true);
  });

  it('keeps normal records in default statistics without changing algorithms', () => {
    const data = makeRecordData();
    const session = data.history[0];

    expect(session.dataFlag).toBe('normal');
    expect(filterAnalyticsHistory(data.history)).toHaveLength(1);
    expect(buildEffectiveVolumeSummary(data.history).completedSets).toBeGreaterThan(0);
    expect(buildSessionDetailSummary(session).excludedFromStats).toBe(false);
    expect(readSource('src/engines/effectiveSetEngine.ts')).not.toContain('history-data-flag');
    expect(readSource('src/engines/e1rmEngine.ts')).not.toContain('history-data-flag');
    expect(readSource('src/engines/progressionEngine.ts')).not.toContain('history-data-flag');
  });
});

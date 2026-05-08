import { describe, expect, it } from 'vitest';
import {
  buildReadMirrorAppDataSummary,
  buildReadMirrorDataHealthSummary,
  buildReadMirrorHistoryDetail,
  buildReadMirrorHistoryList,
  buildReadMirrorSessionsSummary,
} from '../apps/api/src';
import { buildDataHealthReport } from '../src/engines/dataHealthEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { filterAnalyticsHistory, listSessionHistory } from '../src/engines/sessionHistoryEngine';
import { getSessionCalendarDate } from '../src/engines/trainingCalendarEngine';
import { buildAppDataFromFixture, type RealDataFixtureName } from './helpers/realDataFixture';

const fixtures: RealDataFixtureName[] = [
  'legacy-assisted-pullup-session',
  'incomplete-draft-sets-session',
  'ppl-cycle-boundary-history',
  'legacy-unit-display',
  'duplicate-plan-draft',
];

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('API read mirror parity', () => {
  it.each(fixtures)('does not mutate AppData while mirroring %s', (fixtureName) => {
    const data = buildAppDataFromFixture(fixtureName);
    const before = clone(data);

    buildReadMirrorAppDataSummary(data);
    buildReadMirrorSessionsSummary(data);
    buildReadMirrorHistoryList(data);
    buildReadMirrorDataHealthSummary(data);

    expect(data).toEqual(before);
  });

  it.each(fixtures)('matches existing history summary and calendar derivation for %s', (fixtureName) => {
    const data = buildAppDataFromFixture(fixtureName);
    const history = buildReadMirrorHistoryList(data);
    const sourceHistory = listSessionHistory(data.history);

    expect(history.sessions.map((session) => session.id)).toEqual(sourceHistory.map((session) => session.id));
    history.sessions.forEach((item) => {
      const sourceSession = sourceHistory.find((session) => session.id === item.id);
      if (!sourceSession) throw new Error(`Missing source session ${item.id}`);
      const sourceSummary = buildSessionDetailSummary(sourceSession);

      expect(item.calendarDate).toBe(getSessionCalendarDate(sourceSession));
      expect(item.completedWorkingSets).toBe(sourceSummary.completedWorkingSets);
      expect(item.effectiveSets).toBe(sourceSummary.effectiveSets);
      expect(item.warmupSets).toBe(sourceSummary.warmupSets);
      expect(item.incompleteSets).toBe(sourceSummary.incompleteSets);
      expect(item.workingVolumeKg).toBe(sourceSummary.workingVolumeKg);
      expect(item.excludedFromStats).toBe(sourceSummary.excludedFromStats);
    });
  });

  it('matches existing sessions summary analytics filtering', () => {
    const data = buildAppDataFromFixture('ppl-cycle-boundary-history');
    const summary = buildReadMirrorSessionsSummary(data);

    expect(summary.totalHistorySessions).toBe(listSessionHistory(data.history).length);
    expect(summary.analyticsSessionCount).toBe(filterAnalyticsHistory(data.history).length);
    expect(summary.latestSession?.id).toBe(listSessionHistory(data.history)[0]?.id);
  });

  it('matches existing history detail and DataHealth derivation', () => {
    const data = buildAppDataFromFixture('legacy-unit-display');
    const detail = buildReadMirrorHistoryDetail(data, data.history[0].id);
    const sourceReport = buildDataHealthReport(data);
    const dataHealth = buildReadMirrorDataHealthSummary(data);

    expect(detail?.summary).toEqual(buildSessionDetailSummary(data.history[0], data.unitSettings));
    expect(dataHealth).toEqual({
      status: sourceReport.status,
      summary: sourceReport.summary,
      issueCount: sourceReport.issues.length,
      issues: sourceReport.issues,
    });
  });
});

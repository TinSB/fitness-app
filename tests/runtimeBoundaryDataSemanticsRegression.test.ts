import { describe, expect, it } from 'vitest';
import { createSqliteRepository, createServerAdapter } from '../apps/api/src/node';
import { handleReadMirrorRequest } from '../apps/api/src';
import { buildPrs } from '../src/engines/analytics';
import { analyzeImportedAppData, canImportDataRepairReport, repairImportedAppData } from '../src/engines/dataRepairEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { filterAnalyticsHistory } from '../src/engines/sessionHistoryEngine';
import { exportAppData, importAppData } from '../src/storage/backup';
import { buildAppDataFromFixture, loadRealDataFixture } from './helpers/realDataFixture';
import { makeAppData, makeSession } from './fixtures';
import {
  collectActualWeightSnapshots,
  expectAppDataParity,
  expectSummaryOnlyRepairLogs,
} from './sqliteRepositoryTestHelpers';

const roundTrip = (data: ReturnType<typeof makeAppData>) => {
  const repo = createSqliteRepository();
  repo.writeSnapshot(data, {
    snapshotId: 'runtime-boundary-semantics',
    createdAt: '2026-05-09T10:00:00.000Z',
  });
  const restored = repo.readSnapshot();
  repo.close();
  return restored;
};

const readMirrorPaths = (data: ReturnType<typeof makeAppData>) => [
  '/app-data/summary',
  '/sessions/summary',
  '/history',
  data.history[0] ? `/history/${encodeURIComponent(data.history[0].id)}` : '/data-health/summary',
  '/data-health/summary',
];

describe('runtime boundary data semantics regression acceptance', () => {
  it('keeps legacy unit display and actualWeightKg stable through SQLite and readMirror boundaries', () => {
    const data = buildAppDataFromFixture('legacy-unit-display');
    const restored = roundTrip(data);

    expectAppDataParity(restored, data);
    expect(collectActualWeightSnapshots(restored)).toEqual(collectActualWeightSnapshots(data));
    expect(restored.history[0]?.exercises[0]?.sets?.some((set) => set.displayWeight !== undefined)).toBe(true);

    readMirrorPaths(data).forEach((path) => {
      expect(handleReadMirrorRequest(restored, { method: 'GET', path })).toEqual(
        handleReadMirrorRequest(data, { method: 'GET', path }),
      );
    });
  });

  it('keeps identityInvalid and legacyActualExerciseId out of PR, e1RM and effective-set pollution', () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const restored = roundTrip(data);

    expect(JSON.stringify(restored)).toContain('legacyActualExerciseId');
    expect(JSON.stringify(restored)).toContain('identityInvalid');
    expect(buildPrs(restored.history).some((item) => item.exerciseId.includes('__alt_'))).toBe(false);
    expect(buildE1RMProfile(restored.history, '__alt_legacy_pull').best).toBeUndefined();
    expect(buildEffectiveVolumeSummary(restored.history).effectiveSets).toBe(
      buildEffectiveVolumeSummary(data.history).effectiveSets,
    );
  });

  it('keeps test and excluded records visible but excluded from default statistics', () => {
    const testSession = {
      ...makeSession({
        id: 'runtime-test-session',
        date: '2026-05-04',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 100, reps: 5, rir: 2 }],
      }),
      dataFlag: 'test' as const,
    };
    const excludedSession = {
      ...makeSession({
        id: 'runtime-excluded-session',
        date: '2026-05-05',
        templateId: 'pull-a',
        exerciseId: 'lat-pulldown',
        setSpecs: [{ weight: 70, reps: 8, rir: 2 }],
      }),
      dataFlag: 'excluded' as const,
    };
    const restored = roundTrip(makeAppData({ history: [testSession, excludedSession] }));

    expect(restored.history.map((session) => session.id)).toEqual(['runtime-test-session', 'runtime-excluded-session']);
    expect(filterAnalyticsHistory(restored.history)).toHaveLength(0);
    expect(buildEffectiveVolumeSummary(restored.history).completedSets).toBe(0);
  });

  it('keeps backup unsafe, cleaned and needs-review semantics unchanged across boundaries', () => {
    const unsafeImport = importAppData(JSON.stringify({ source: 'health-json', samples: [] }));
    expect(unsafeImport.ok).toBe(false);

    const cleaned = buildAppDataFromFixture('legacy-unit-display');
    const cleanedImport = importAppData(exportAppData(roundTrip(cleaned)));
    expect(cleanedImport.ok).toBe(true);
    expectAppDataParity(cleanedImport.data!, cleaned);

    const rawNeedsReview = loadRealDataFixture('legacy-assisted-pullup-session').data;
    const report = analyzeImportedAppData(rawNeedsReview);
    if (report.status === 'needs_review') {
      expect(canImportDataRepairReport(report)).toBe(true);
      const repaired = repairImportedAppData(rawNeedsReview, report);
      expectSummaryOnlyRepairLogs(repaired.repairedData);
      expect(importAppData(exportAppData(repaired.repairedData)).ok).toBe(true);
    } else {
      expect(['safe', 'needs_review']).toContain(report.status);
    }
  });

  it('keeps server adapter read results equal to direct readMirror after repository round-trip', () => {
    const data = buildAppDataFromFixture('ppl-cycle-boundary-history');
    const repo = createSqliteRepository();
    repo.writeSnapshot(data, {
      snapshotId: 'runtime-boundary-server-semantics',
      createdAt: '2026-05-09T10:00:00.000Z',
    });
    const adapter = createServerAdapter({ repository: repo });

    readMirrorPaths(data).forEach((path) => {
      const direct = handleReadMirrorRequest(repo.readSnapshot(), { method: 'GET', path });
      const viaAdapter = adapter.handleRequest({ method: 'GET', path });
      expect(viaAdapter.status).toBe(direct.status);
      expect(viaAdapter.result).toEqual(direct.body);
    });

    repo.close();
  });
});

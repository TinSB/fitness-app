import { describe, expect, it } from 'vitest';
import { createSqliteRepository } from '../apps/api/src/node';
import { buildPrs } from '../src/engines/analytics';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { filterAnalyticsHistory } from '../src/engines/sessionHistoryEngine';
import { exportAppData, importAppData } from '../src/storage/backup';
import { buildAppDataFromFixture } from './helpers/realDataFixture';
import { makeAppData, makeSession } from './fixtures';
import {
  collectActualWeightSnapshots,
  expectAppDataParity,
} from './sqliteRepositoryTestHelpers';

const roundTrip = (data: ReturnType<typeof makeAppData>) => {
  const repo = createSqliteRepository();
  repo.writeSnapshot(data, {
    snapshotId: 'legacy-parity',
    createdAt: '2026-05-08T10:00:00.000Z',
  });
  const restored = repo.readSnapshot();
  repo.close();
  return restored;
};

const collectLegacyActualIds = (data: ReturnType<typeof makeAppData>) =>
  (data.history || []).flatMap((session) =>
    (session.exercises || []).map((exercise) => ({
      sessionId: session.id,
      exerciseId: exercise.id,
      actualExerciseId: exercise.actualExerciseId,
      legacyActualExerciseId: exercise.legacyActualExerciseId,
      identityInvalid: exercise.identityInvalid,
    })),
  );

describe('SQLite repository legacy compatibility', () => {
  it('keeps legacy displayWeight semantics and actualWeightKg values stable', () => {
    const data = buildAppDataFromFixture('legacy-unit-display');
    const restored = roundTrip(data);

    expectAppDataParity(restored, data);
    expect(collectActualWeightSnapshots(restored)).toEqual(collectActualWeightSnapshots(data));
    expect(restored.history[0]?.exercises[0]?.sets?.some((set) => set.displayWeight !== undefined)).toBe(true);
  });

  it('keeps identityInvalid and legacyActualExerciseId semantics stable', () => {
    const data = buildAppDataFromFixture('legacy-assisted-pullup-session');
    const restored = roundTrip(data);

    expect(collectLegacyActualIds(restored)).toEqual(collectLegacyActualIds(data));
    expect(JSON.stringify(restored)).toContain('legacyActualExerciseId');
    expect(JSON.stringify(restored)).toContain('identityInvalid');
    expect(buildPrs(restored.history).some((item) => item.exerciseId.includes('legacy-assisted-pullup'))).toBe(false);
    expect(buildE1RMProfile(restored.history, 'legacy-assisted-pullup').best).toBeUndefined();
    expect(buildEffectiveVolumeSummary(restored.history).effectiveSets).toBe(buildEffectiveVolumeSummary(data.history).effectiveSets);
  });

  it('keeps test and excluded records visible but out of default analytics after round-trip', () => {
    const testSession = {
      ...makeSession({
        id: 'sqlite-test-session',
        date: '2026-05-04',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: [{ weight: 100, reps: 5, rir: 2 }],
      }),
      dataFlag: 'test' as const,
    };
    const excludedSession = {
      ...makeSession({
        id: 'sqlite-excluded-session',
        date: '2026-05-05',
        templateId: 'pull-a',
        exerciseId: 'lat-pulldown',
        setSpecs: [{ weight: 70, reps: 8, rir: 2 }],
      }),
      dataFlag: 'excluded' as const,
    };
    const data = makeAppData({ history: [testSession, excludedSession] });
    const restored = roundTrip(data);

    expect(restored.history.map((session) => session.id)).toEqual(['sqlite-test-session', 'sqlite-excluded-session']);
    expect(filterAnalyticsHistory(restored.history)).toHaveLength(0);
    expect(buildEffectiveVolumeSummary(restored.history).completedSets).toBe(0);
  });

  it('does not alter backup import/export safety through SQLite round-trip', () => {
    const unsafe = importAppData(JSON.stringify({ source: 'health-json', samples: [] }));
    expect(unsafe.ok).toBe(false);

    const data = buildAppDataFromFixture('legacy-unit-display');
    const restored = roundTrip(data);
    const reimported = importAppData(exportAppData(restored));

    expect(reimported.ok).toBe(true);
    expect(reimported.data).toBeDefined();
    expectAppDataParity(reimported.data!, data);
  });
});

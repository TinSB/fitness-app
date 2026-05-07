import { describe, expect, it } from 'vitest';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import type { TrainingSession } from '../src/models/training-model';
import { makeSession } from './fixtures';

const sessionWithStaleCachedFields = (): TrainingSession & {
  completedSets?: number;
  effectiveSets?: number;
  totalVolumeKg?: number;
} => {
  const session = makeSession({
    id: 'summary-trust',
    date: '2026-05-04',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [
      { weight: 100, reps: 5, rir: 2, techniqueQuality: 'good' },
      { weight: 90, reps: 8, rir: 2, techniqueQuality: 'good' },
    ],
  }) as TrainingSession & { completedSets?: number; effectiveSets?: number; totalVolumeKg?: number };

  session.completedSets = 99;
  session.effectiveSets = 99;
  session.totalVolumeKg = 99999;
  return session;
};

describe('session detail summary trust boundary', () => {
  it('computes top summary only from real set logs and ignores stale cached fields', () => {
    const summary = buildSessionDetailSummary(sessionWithStaleCachedFields());

    expect(summary).toMatchObject({
      plannedWorkingSets: 2,
      completedWorkingSets: 2,
      workingSetCount: 2,
      completedWorkingSetCount: 2,
      incompleteSets: 0,
      warmupSets: 0,
      workingVolume: 100 * 5 + 90 * 8,
      workingVolumeKg: 100 * 5 + 90 * 8,
      warmupVolumeKg: 0,
      excludedFromStats: false,
      excludedReason: undefined,
      identityIssueCount: 0,
      edited: false,
    });
    expect(summary.effectiveSets).toBeGreaterThan(0);
    expect(summary.effectiveSetCount).toBe(summary.effectiveSets);
    expect(summary.totalDisplayVolume).not.toContain('99999');
  });

  it('exposes an explicit stats exclusion reason for test and excluded sessions', () => {
    const testSummary = buildSessionDetailSummary({ ...sessionWithStaleCachedFields(), dataFlag: 'test' });
    const excludedSummary = buildSessionDetailSummary({ ...sessionWithStaleCachedFields(), dataFlag: 'excluded' });

    expect(testSummary.excludedFromStatsReason).toContain('测试数据');
    expect(excludedSummary.excludedFromStatsReason).toContain('排除数据');
    expect(testSummary.excludedFromStats).toBe(true);
    expect(excludedSummary.excludedFromStats).toBe(true);
    expect(testSummary.excludedReason).toBe(testSummary.excludedFromStatsReason);
    expect(excludedSummary.excludedReason).toBe(excludedSummary.excludedFromStatsReason);
    expect(`${testSummary.excludedFromStatsReason} ${excludedSummary.excludedFromStatsReason}`).not.toMatch(/\b(undefined|null|test|excluded)\b/);
  });

  it('treats working sets without done=true as incomplete even when old completion fields are present', () => {
    const session = sessionWithStaleCachedFields();
    session.exercises[0].sets[0] = {
      ...session.exercises[0].sets[0],
      done: undefined,
      completedAt: '2026-05-04T10:00:00.000Z',
    };

    const summary = buildSessionDetailSummary(session);

    expect(summary).toMatchObject({
      plannedWorkingSets: 2,
      completedWorkingSets: 1,
      incompleteSets: 1,
      workingVolumeKg: 90 * 8,
    });
  });
});

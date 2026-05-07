import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import type { TrainingSession } from '../src/models/training-model';
import { makeSession } from './fixtures';

const sessionWithWarmup = (): TrainingSession => {
  const session = makeSession({
    id: 'summary-warmup',
    date: '2026-05-04',
    templateId: 'legs-a',
    exerciseId: 'squat',
    setSpecs: [
      { weight: 120, reps: 5, rir: 2, techniqueQuality: 'good' },
      { weight: 115, reps: 6, rir: 2, techniqueQuality: 'good' },
    ],
  });
  session.focusWarmupSetLogs = [
    { id: 'main:squat:warmup:0', exerciseId: 'squat', type: 'warmup', weight: 40, actualWeightKg: 40, reps: 8, rir: '', done: true },
    { id: 'main:squat:warmup:1', exerciseId: 'squat', type: 'warmup', weight: 80, actualWeightKg: 80, reps: 4, rir: '', done: true },
  ];
  return session;
};

describe('warmup summary isolation', () => {
  it('separates warmup sets and volume from working summary, effective sets, PR, and e1RM', () => {
    const session = sessionWithWarmup();
    const withoutWarmup = { ...session, focusWarmupSetLogs: [] };
    const summary = buildSessionDetailSummary(session);

    expect(summary).toMatchObject({
      plannedWorkingSets: 2,
      completedWorkingSets: 2,
      plannedWarmupSets: 2,
      warmupSets: 2,
      warmupVolume: 40 * 8 + 80 * 4,
      warmupVolumeKg: 40 * 8 + 80 * 4,
      workingVolume: 120 * 5 + 115 * 6,
      workingVolumeKg: 120 * 5 + 115 * 6,
    });
    expect(summary.groupedSets.warmupSets.every((entry) => entry.category === 'warmup')).toBe(true);
    expect(buildEffectiveVolumeSummary([session]).effectiveSets).toBe(buildEffectiveVolumeSummary([withoutWarmup]).effectiveSets);
    expect(buildPrs([session])).toEqual(buildPrs([withoutWarmup]));
    expect(buildE1RMProfile([session], 'squat').best?.e1rmKg).toBe(buildE1RMProfile([withoutWarmup], 'squat').best?.e1rmKg);
  });
});

import { describe, expect, it } from 'vitest';
import draftFixture from './fixtures/realDataRegression/incomplete-draft-sets-session.json';
import { buildPrs } from '../src/engines/analytics';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { completedSets, sessionCompletedSets, sessionVolume, setVolume } from '../src/engines/engineUtils';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import type { AppData } from '../src/models/training-model';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData } from './fixtures';

const fixtureData = () =>
  sanitizeData({
    ...makeAppData(),
    ...(draftFixture.data as Partial<AppData>),
  });

describe('real data incomplete draft set regression', () => {
  it('keeps done=false sets with values as incomplete drafts', () => {
    const session = fixtureData().history[0];
    const draftExercise = session.exercises.find((exercise) => exercise.id === 'incline-db-press');
    const draftSet = draftExercise?.sets?.[0];

    expect(draftSet).toMatchObject({
      done: false,
      weight: 28,
      actualWeightKg: 28,
      reps: 10,
      rir: 2,
    });
    expect(completedSets(draftExercise)).toHaveLength(0);
  });

  it('excludes done=false draft sets from completed sets, volume, PR, e1RM, and effective sets', () => {
    const session = fixtureData().history[0];
    const bench = session.exercises.find((exercise) => exercise.id === 'bench-press');
    if (!bench?.sets?.[0]) throw new Error('expected completed bench set');
    const expectedVolume = setVolume(bench.sets[0]);
    const effective = buildEffectiveVolumeSummary([session]);

    expect(sessionCompletedSets(session)).toBe(1);
    expect(sessionVolume(session)).toBe(expectedVolume);
    expect(effective.completedSets).toBe(1);
    expect(effective.effectiveSets).toBe(1);
    expect(buildPrs([session]).map((item) => item.exerciseId)).not.toContain('incline-db-press');
    expect(buildE1RMProfile([session], 'incline-db-press').best).toBeUndefined();
  });

  it('shows the draft set as incomplete in Record detail summary instead of completed work', () => {
    const session = fixtureData().history[0];
    const summary = buildSessionDetailSummary(session);

    expect(summary.completedWorkingSetCount).toBe(1);
    expect(summary.incompleteSetCount).toBe(1);
    expect(summary.workingVolumeKg).toBe(sessionVolume(session));
    expect(summary.earlyEndSummary).toContain('未完成');
    expect(summary.groupedSets.workingSets.find((entry) => entry.set.id === 'incline-db-press-draft-1')?.set.done).toBe(false);
  });
});

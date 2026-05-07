import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { sessionCompletedSets, sessionVolume } from '../src/engines/engineUtils';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import type { TrainingSession } from '../src/models/training-model';
import { makeSession } from './fixtures';

const sessionWithIncompleteDraft = (): TrainingSession => {
  const session = makeSession({
    id: 'summary-incomplete',
    date: '2026-05-04',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 80, reps: 8, rir: 2, techniqueQuality: 'good' }],
  });

  session.exercises[0].sets = [
    session.exercises[0].sets[0],
    {
      id: 'bench-draft-heavy',
      type: 'straight',
      weight: 220,
      actualWeightKg: 220,
      reps: 10,
      rir: 1,
      done: false,
      completionStatus: 'draft',
      techniqueQuality: 'good',
    },
  ];
  return session;
};

describe('incomplete set summary', () => {
  it('keeps done=false draft sets visible but outside completed, volume, effective, PR, and e1RM metrics', () => {
    const session = sessionWithIncompleteDraft();
    const summary = buildSessionDetailSummary(session);
    const effective = buildEffectiveVolumeSummary([session]);
    const prs = buildPrs([session]);
    const e1rm = buildE1RMProfile([session], 'bench-press');

    expect(summary).toMatchObject({
      plannedWorkingSets: 2,
      completedWorkingSets: 1,
      incompleteSets: 1,
      workingVolume: 80 * 8,
    });
    expect(sessionCompletedSets(session)).toBe(1);
    expect(sessionVolume(session)).toBe(80 * 8);
    expect(effective.completedSets).toBe(1);
    expect(effective.effectiveSets).toBe(1);
    expect(prs.some((record) => record.raw === 220 || record.raw === 2200)).toBe(false);
    expect(e1rm.best?.sourceSet.weightKg).toBe(80);
  });
});

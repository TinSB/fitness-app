import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import type { TrainingSession } from '../src/models/training-model';
import { makeSession } from './fixtures';

const invalidIdentitySession = (): TrainingSession => {
  const session = makeSession({
    id: 'summary-invalid-identity',
    date: '2026-05-04',
    templateId: 'pull-a',
    exerciseId: 'lat-pulldown',
    setSpecs: [{ weight: 80, reps: 10, rir: 2, techniqueQuality: 'good' }],
  });
  session.exercises[0] = {
    ...session.exercises[0],
    actualExerciseId: undefined,
    legacyActualExerciseId: '__auto_alt_lat-pulldown',
    identityInvalid: true,
    identityReviewReason: 'legacy synthetic replacement id',
  };
  return session;
};

describe('identity invalid summary', () => {
  it('keeps invalid identity logs visible while excluding them from effective, PR, and e1RM pools', () => {
    const session = invalidIdentitySession();
    const summary = buildSessionDetailSummary(session);

    expect(summary).toMatchObject({
      plannedWorkingSets: 1,
      completedWorkingSets: 1,
      effectiveSets: 0,
      identityIssueCount: 1,
      identityReviewExerciseCount: 1,
      identityReviewSetCount: 1,
    });
    expect(summary.effectiveSetGapReasons.join(' ')).toContain('动作身份');
    expect(buildEffectiveVolumeSummary([session]).completedSets).toBe(0);
    expect(buildEffectiveVolumeSummary([session]).effectiveSets).toBe(0);
    expect(buildPrs([session])).toHaveLength(0);
    expect(buildE1RMProfile([session], 'lat-pulldown').best).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary, countEffectiveSets, evaluateEffectiveSet } from '../src/engines/effectiveSetEngine';
import { buildSessionDetailSummary } from '../src/engines/sessionDetailSummaryEngine';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData, makeSession } from './fixtures';

const invalidIdentityHistory = () => {
  const session = makeSession({
    id: 'invalid-analytics',
    date: '2026-04-30',
    templateId: 'push-a',
    exerciseId: 'bench-press',
    setSpecs: [{ weight: 160, reps: 5, rir: 1, techniqueQuality: 'good' }],
  });
  session.exercises[0] = {
    ...session.exercises[0],
    originalExerciseId: 'bench-press',
    actualExerciseId: 'old-auto-alt',
  };
  return sanitizeData(makeAppData({ history: [session] })).history;
};

describe('invalid identity analytics exclusion', () => {
  it('excludes invalid identity sets from PR and e1RM', () => {
    const history = invalidIdentityHistory();

    expect(buildPrs(history).map((item) => item.exerciseId)).not.toContain('bench-press');
    expect(buildE1RMProfile(history, 'bench-press').current).toBeUndefined();
    expect(buildE1RMProfile(history, 'bench-press').best).toBeUndefined();
  });

  it('excludes invalid identity sets from effective volume while keeping history detail visible', () => {
    const history = invalidIdentityHistory();
    const exercise = history[0].exercises[0];
    const set = Array.isArray(exercise.sets) ? exercise.sets[0] : undefined;
    if (!set) throw new Error('Expected set log');

    const result = evaluateEffectiveSet(set, exercise);
    const summary = buildEffectiveVolumeSummary(history);
    const detail = buildSessionDetailSummary(history[0]);

    expect(result.isEffective).toBe(false);
    expect(result.flags).toContain('identity_invalid');
    expect(countEffectiveSets(history[0])).toBe(0);
    expect(summary.effectiveSets).toBe(0);
    expect(summary.completedSets).toBe(0);
    expect(detail.identityReviewSetCount).toBe(1);
    expect(detail.identityReviewSummary).toContain('动作身份需要检查');
  });
});

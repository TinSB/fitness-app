import { describe, expect, it } from 'vitest';
import { buildPrs } from '../src/engines/analytics';
import { buildE1RMProfile } from '../src/engines/e1rmEngine';
import { buildEffectiveVolumeSummary } from '../src/engines/effectiveSetEngine';
import { deleteTrainingSession, markSessionDataFlag } from '../src/engines/sessionHistoryEngine';
import { emptyData } from '../src/storage/persistence';
import { makeExercise, makeFocusSession } from './focusModeFixtures';

const completedSession = (id: string, weight = 100, dataFlag: 'normal' | 'test' | 'excluded' = 'normal') => {
  const exercise = {
    ...makeExercise('bench', 1, 1),
    canonicalExerciseId: 'bench',
    sets: [{ id: `${id}-set`, weight, reps: 5, rir: 2, done: true, techniqueQuality: 'good' as const }],
  };
  return {
    ...makeFocusSession([exercise]),
    id,
    date: '2026-04-20',
    completed: true,
    dataFlag,
  };
};

describe('session history cleanup', () => {
  it('requires confirmation before deleting session', () => {
    const data = { ...emptyData(), history: [completedSession('s1')] };
    const result = deleteTrainingSession(data, 's1', false);
    expect(result.ok).toBe(false);
    expect(result.data.history).toHaveLength(1);
  });

  it('deletes a confirmed session', () => {
    const data = { ...emptyData(), history: [completedSession('s1')] };
    const result = deleteTrainingSession(data, 's1', true);
    expect(result.ok).toBe(true);
    expect(result.data.history).toHaveLength(0);
  });

  it('test data is ignored by e1RM, PR, and effective volume', () => {
    const history = [completedSession('real', 80), completedSession('test', 200, 'test')];
    expect(buildE1RMProfile(history, 'bench').best?.sourceSet.weightKg).toBe(80);
    expect(buildPrs(history).some((item) => item.raw === 200)).toBe(false);
    expect(buildEffectiveVolumeSummary(history).completedSets).toBe(1);
  });

  it('marks a session as test data', () => {
    const data = { ...emptyData(), history: [completedSession('s1')] };
    const result = markSessionDataFlag(data, 's1', 'test', true);
    expect(result.data.history[0].dataFlag).toBe('test');
  });
});

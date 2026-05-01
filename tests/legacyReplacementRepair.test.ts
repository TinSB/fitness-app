import { describe, expect, it } from 'vitest';
import { repairImportedAppData } from '../src/engines/dataRepairEngine';
import { formatExerciseName } from '../src/i18n/formatters';
import { makeAppData, getTemplate } from './fixtures';

describe('legacy replacement repair', () => {
  it('does not fallback invalid history actualExerciseId to originalExerciseId', () => {
    const push = getTemplate('push-a');
    const data = makeAppData({
      history: [
        {
          id: 'session-invalid-actual',
          date: '2026-04-30',
          templateId: 'push-a',
          templateName: push.name,
          trainingMode: 'hybrid',
          focus: push.focus,
          completed: true,
          exercises: [
            {
              ...push.exercises[0],
              originalExerciseId: 'bench-press',
              actualExerciseId: '__auto_alt_alt',
              replacementExerciseId: '',
              sets: [{ id: 'set-1', type: 'top', weight: 40, reps: 8, done: true }],
            },
          ],
          status: { sleep: '一般', energy: '中', time: '60', soreness: ['无'] },
        },
      ],
    });

    const result = repairImportedAppData(data, { repairDate: '2026-05-01' });
    const exercise = result.repairedData.history[0]?.exercises[0];

    expect(exercise?.actualExerciseId).toBe('__auto_alt_alt');
    expect(exercise?.actualExerciseId).not.toBe('bench-press');
    expect(exercise?.legacyActualExerciseId).toBe('__auto_alt_alt');
    expect(result.report.status).toBe('needs_review');
  });

  it('repairs display name conflicts when actualExerciseId is valid', () => {
    const push = getTemplate('push-a');
    const data = makeAppData({
      history: [
        {
          id: 'session-name-conflict',
          date: '2026-04-30',
          templateId: 'push-a',
          templateName: push.name,
          trainingMode: 'hybrid',
          focus: push.focus,
          completed: true,
          exercises: [
            {
              ...push.exercises[0],
              name: '卧推',
              originalExerciseId: 'bench-press',
              actualExerciseId: 'db-bench-press',
              replacementExerciseId: 'db-bench-press',
              sets: [{ id: 'set-1', type: 'top', weight: 30, reps: 10, done: true }],
            },
          ],
          status: { sleep: '一般', energy: '中', time: '60', soreness: ['无'] },
        },
      ],
    });

    const result = repairImportedAppData(data, { repairDate: '2026-05-01' });
    const exercise = result.repairedData.history[0]?.exercises[0];

    expect(exercise?.actualExerciseId).toBe('db-bench-press');
    expect(exercise?.name).toBe(formatExerciseName('db-bench-press'));
    expect(result.repairLog.some((entry) => entry.action.includes('显示名'))).toBe(true);
  });
});

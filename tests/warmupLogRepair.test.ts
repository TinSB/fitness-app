import { describe, expect, it } from 'vitest';
import { repairImportedAppData } from '../src/engines/dataRepairEngine';
import { makeAppData, getTemplate } from './fixtures';

describe('warmup log repair', () => {
  it('fills structured warmup log fields without moving warmups into working sets', () => {
    const pull = getTemplate('pull-a');
    const data = makeAppData({
      history: [
        {
          id: 'session-warmup',
          date: '2026-04-30',
          templateId: 'pull-a',
          templateName: pull.name,
          trainingMode: 'hybrid',
          focus: pull.focus,
          completed: true,
          exercises: [
            {
              ...pull.exercises[0],
              originalExerciseId: 'lat-pulldown',
              actualExerciseId: 'lat-pulldown',
              sets: [{ id: 'work-1', type: 'top', weight: 45, reps: 10, done: true }],
            },
          ],
          focusWarmupSetLogs: ['main:lat-pulldown:warmup:0'] as never,
          status: { sleep: '一般', energy: '中', time: '60', soreness: ['无'] },
        },
      ],
    });

    const result = repairImportedAppData(data, { repairDate: '2026-05-01' });
    const session = result.repairedData.history[0];
    const warmup = session?.focusWarmupSetLogs?.[0];

    expect(warmup).toMatchObject({
      exerciseId: 'lat-pulldown',
      originalExerciseId: 'lat-pulldown',
      actualExerciseId: 'lat-pulldown',
      type: 'warmup',
      warmupType: 'feeder_set',
      setIndex: 0,
    });
    expect(session?.exercises[0]?.sets).toHaveLength(1);
    expect(result.repairLog.some((entry) => entry.category === 'warmup')).toBe(true);
  });
});

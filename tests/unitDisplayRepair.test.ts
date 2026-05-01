import { describe, expect, it } from 'vitest';
import { analyzeImportedAppData, repairImportedAppData } from '../src/engines/dataRepairEngine';
import { makeAppData, getTemplate } from './fixtures';

describe('unit display repair', () => {
  it('keeps actualWeightKg as the calculation source and clears inconsistent legacy display fields', () => {
    const pull = getTemplate('pull-a');
    const data = makeAppData({
      unitSettings: {
        weightUnit: 'lb',
        defaultIncrementKg: 2.5,
        defaultIncrementLb: 5,
        customIncrementsKg: [2.5, 5],
        customIncrementsLb: [5, 10],
      },
      history: [
        {
          id: 'session-unit',
          date: '2026-04-30',
          templateId: 'pull-a',
          templateName: pull.name,
          trainingMode: 'hybrid',
          focus: pull.focus,
          completed: true,
          exercises: [
            {
              ...pull.exercises[0],
              sets: [
                {
                  id: 'set-1',
                  type: 'top',
                  weight: 50,
                  actualWeightKg: 52.6,
                  displayWeight: 0,
                  displayUnit: 'lb',
                  reps: 10,
                  done: true,
                },
              ],
            },
          ],
          status: { sleep: '一般', energy: '中', time: '60', soreness: ['无'] },
        },
      ],
    });

    const result = repairImportedAppData(data, { repairDate: '2026-05-01' });
    const set = result.repairedData.history[0]?.exercises[0]?.sets[0];

    expect(set.actualWeightKg).toBe(52.6);
    expect(set.displayWeight).toBeUndefined();
    expect(result.repairLog.some((entry) => entry.category === 'unit')).toBe(true);
  });

  it('keeps display fields and requests review when actualWeightKg is missing', () => {
    const pull = getTemplate('pull-a');
    const data = makeAppData({
      history: [
        {
          id: 'session-missing-actual',
          date: '2026-04-30',
          templateId: 'pull-a',
          templateName: pull.name,
          trainingMode: 'hybrid',
          focus: pull.focus,
          completed: true,
          exercises: [
            {
              ...pull.exercises[0],
              sets: [{ id: 'set-1', type: 'top', weight: 0, displayWeight: 120, displayUnit: 'lb', reps: 10, done: true }],
            },
          ],
          status: { sleep: '一般', energy: '中', time: '60', soreness: ['无'] },
        },
      ],
    });

    const report = analyzeImportedAppData(data);
    const result = repairImportedAppData(data, { repairDate: '2026-05-01' });
    const set = result.repairedData.history[0]?.exercises[0]?.sets[0];

    expect(report.status).toBe('needs_review');
    expect(set.displayWeight).toBe(120);
    expect(set.displayUnit).toBe('lb');
    expect(set.actualWeightKg).toBeUndefined();
  });
});

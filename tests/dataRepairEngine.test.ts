import { describe, expect, it } from 'vitest';
import { analyzeImportedAppData, repairImportedAppData } from '../src/engines/dataRepairEngine';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData, getTemplate } from './fixtures';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('dataRepairEngine', () => {
  it('reports synthetic replacement ids and writes bounded repair logs without deleting history', () => {
    const pull = getTemplate('pull-a');
    const data = makeAppData({
      selectedTemplateId: 'pull-a',
      activeProgramTemplateId: 'pull-a',
      history: [
        {
          id: 'session-1',
          date: '2026-04-30',
          templateId: 'pull-a',
          templateName: pull.name,
          trainingMode: 'hybrid',
          focus: pull.focus,
          completed: true,
          exercises: [
            {
              ...pull.exercises[0],
              id: 'lat-pulldown__auto_alt',
              originalExerciseId: 'lat-pulldown',
              actualExerciseId: '__auto_alt',
              sets: [{ id: 'set-1', type: 'top', weight: 40, reps: 10, done: true }],
            },
          ],
          status: { sleep: '一般', energy: '中', time: '60', soreness: ['无'] },
        },
      ],
    });

    const report = analyzeImportedAppData(data);
    expect(report.issues.some((issue) => issue.id === 'replacement.synthetic_id')).toBe(true);

    const result = repairImportedAppData(clone(data), {
      repairDate: '2026-05-01',
      sourceFileName: 'anonymous.json',
      maxRepairLogEntries: 200,
    });

    expect(result.repairedData.history).toHaveLength(1);
    expect(result.repairLog.length).toBeLessThanOrEqual(200);
    expect(result.repairedData.settings.dataRepairLogs?.length).toBe(result.repairLog.length);
    expect(JSON.stringify(result.repairLog)).not.toContain('"history"');
    expect(() => sanitizeData(result.repairedData)).not.toThrow();
  });

  it('marks non app-data JSON as unsafe', () => {
    const report = analyzeImportedAppData({ records: [{ value: 1 }] });

    expect(report.status).toBe('unsafe');
    expect(report.issues[0]?.message).toContain('禁止');
  });
});

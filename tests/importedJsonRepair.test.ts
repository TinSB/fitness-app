import { describe, expect, it } from 'vitest';
import { analyzeImportedAppData, canImportDataRepairReport, isNoSoreness, normalizeSoreness, repairImportedAppData } from '../src/engines/dataRepairEngine';
import { buildTrainingDecisionContext } from '../src/engines/trainingDecisionContext';
import { makeAppData } from './fixtures';

describe('imported JSON repair workflow', () => {
  it('allows needs_review repaired data through strong confirmation while blocking unsafe JSON', () => {
    const data = makeAppData({
      activeProgramTemplateId: 'pull-a',
      todayStatus: { sleep: '一般', energy: '中', time: '60', soreness: ['背'] },
    });

    const report = analyzeImportedAppData(data);
    expect(report.status).toBe('needs_review');
    expect(canImportDataRepairReport(report)).toBe(true);

    const unsafe = analyzeImportedAppData({ source: 'health-json', samples: [] });
    expect(unsafe.status).toBe('unsafe');
    expect(canImportDataRepairReport(unsafe)).toBe(false);
  });

  it('does not let no-date legacy soreness pollute the repaired current day', () => {
    const data = makeAppData({
      todayStatus: { sleep: '一般', energy: '中', time: '60', soreness: ['背'] },
    });

    const result = repairImportedAppData(data, { repairDate: '2026-05-01', sourceFileName: 'anonymous.json' });
    const context = buildTrainingDecisionContext(result.repairedData, '2026-05-01');

    expect(result.repairedData.todayStatus.date).toBe('2026-05-01');
    expect(context.todayStatus.soreness).toEqual(['无']);
  });

  it('treats no-soreness markers as no soreness instead of a body area', () => {
    expect(normalizeSoreness(['无'])).toEqual(['无']);
    expect(isNoSoreness(['无'])).toBe(true);
    expect(normalizeSoreness(['无', '背'])).toEqual(['背']);
  });
});

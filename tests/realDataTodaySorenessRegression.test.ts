import { describe, expect, it } from 'vitest';
import sorenessFixture from './fixtures/realDataRegression/stale-today-soreness.json';
import { buildEnginePipeline } from '../src/engines/enginePipeline';
import { actionableSorenessAreas, isNoSoreness } from '../src/engines/engineUtils';
import { buildTrainingDecisionContext } from '../src/engines/trainingDecisionContext';
import type { AppData, TodayStatus } from '../src/models/training-model';
import { sanitizeData } from '../src/storage/persistence';
import { makeAppData } from './fixtures';

const baseData = (todayStatus: unknown) =>
  sanitizeData({
    ...makeAppData(),
    todayStatus,
  });

describe('real data Today soreness date regression', () => {
  it('ignores stale dated soreness while preserving sleep, energy, and time', () => {
    const data = baseData((sorenessFixture.data as Partial<AppData>).todayStatus);
    const context = buildTrainingDecisionContext(data, '2026-05-04');
    const pipeline = buildEnginePipeline(data, '2026-05-04');

    expect(context.todayStatus.date).toBe('2026-05-04');
    expect(isNoSoreness(context.todayStatus.soreness)).toBe(true);
    expect(actionableSorenessAreas(context.todayStatus.soreness)).toHaveLength(0);
    expect(context.todayStatus).toMatchObject({ sleep: '好', energy: '高', time: '60' });
    expect(context.painPatterns).toHaveLength(0);
    expect(pipeline.nextWorkout.templateId).toBe(pipeline.nextWorkout.plannedTemplateId);
    expect(pipeline.nextWorkout.overrideReason).toBeUndefined();
  });

  it('ignores legacy soreness without a date', () => {
    const raw = (sorenessFixture.data as Record<string, unknown>).legacyTodayStatusWithoutDate;
    const data = baseData(raw);
    const context = buildTrainingDecisionContext(data, '2026-05-04');

    expect(context.todayStatus.date).toBe('2026-05-04');
    expect(isNoSoreness(context.todayStatus.soreness)).toBe(true);
    expect(actionableSorenessAreas(context.todayStatus.soreness)).toHaveLength(0);
    expect(context.todayStatus).toMatchObject({ sleep: '好', energy: '高', time: '60' });
  });

  it('uses soreness only after the user records it for the current date', () => {
    const stale = (sorenessFixture.data as Partial<AppData>).todayStatus as TodayStatus;
    const data = baseData({ ...stale, date: '2026-05-04' });
    const context = buildTrainingDecisionContext(data, '2026-05-04');

    expect(context.todayStatus.date).toBe('2026-05-04');
    expect(isNoSoreness(context.todayStatus.soreness)).toBe(false);
    expect(actionableSorenessAreas(context.todayStatus.soreness)).toEqual(['背']);
  });
});

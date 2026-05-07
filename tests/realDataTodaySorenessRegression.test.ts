import { describe, expect, it } from 'vitest';
import { buildEnginePipeline } from '../src/engines/enginePipeline';
import { actionableSorenessAreas, isNoSoreness } from '../src/engines/engineUtils';
import { buildTrainingDecisionContext } from '../src/engines/trainingDecisionContext';
import type { AppData, TodayStatus } from '../src/models/training-model';
import { buildAppDataFromFixture, loadRealDataFixture } from './helpers/realDataFixture';

const sorenessFixtureData = loadRealDataFixture<Partial<AppData> & { legacyTodayStatusWithoutDate?: unknown }>('stale-today-soreness').data;
const baseData = (todayStatus: unknown) => buildAppDataFromFixture('stale-today-soreness', { todayStatus: todayStatus as TodayStatus });

describe('real data Today soreness date regression', () => {
  it('ignores stale dated soreness while preserving sleep, energy, and time', () => {
    const data = baseData(sorenessFixtureData.todayStatus);
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
    const raw = sorenessFixtureData.legacyTodayStatusWithoutDate;
    const data = baseData(raw);
    const context = buildTrainingDecisionContext(data, '2026-05-04');

    expect(context.todayStatus.date).toBe('2026-05-04');
    expect(isNoSoreness(context.todayStatus.soreness)).toBe(true);
    expect(actionableSorenessAreas(context.todayStatus.soreness)).toHaveLength(0);
    expect(context.todayStatus).toMatchObject({ sleep: '好', energy: '高', time: '60' });
  });

  it('uses soreness only after the user records it for the current date', () => {
    const stale = sorenessFixtureData.todayStatus as TodayStatus;
    const data = baseData({ ...stale, date: '2026-05-04' });
    const context = buildTrainingDecisionContext(data, '2026-05-04');

    expect(context.todayStatus.date).toBe('2026-05-04');
    expect(isNoSoreness(context.todayStatus.soreness)).toBe(false);
    expect(actionableSorenessAreas(context.todayStatus.soreness)).toEqual(['背']);
  });
});

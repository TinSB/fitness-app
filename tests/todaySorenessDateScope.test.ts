import { describe, expect, it } from 'vitest';
import { buildTrainingDecisionContext } from '../src/engines/trainingDecisionContext';
import { makeAppData, makeStatus } from './fixtures';

describe('Today soreness date scope', () => {
  it('does not carry yesterday soreness into the current day', () => {
    const context = buildTrainingDecisionContext(
      makeAppData({
        todayStatus: makeStatus({ date: '2026-04-30', soreness: ['肩'] }),
      }),
      '2026-05-01',
    );

    expect(context.todayStatus.soreness).toEqual(['无']);
    expect(context.todayStatus.date).toBe('2026-05-01');
  });

  it('does not carry legacy soreness without a date', () => {
    const context = buildTrainingDecisionContext(
      makeAppData({
        todayStatus: makeStatus({ soreness: ['背'] }),
      }),
      '2026-05-01',
    );

    expect(context.todayStatus.soreness).toEqual(['无']);
  });

  it('keeps same-day soreness available to the pipeline', () => {
    const context = buildTrainingDecisionContext(
      makeAppData({
        todayStatus: makeStatus({ date: '2026-05-01', soreness: ['背'] }),
      }),
      '2026-05-01',
    );

    expect(context.todayStatus.soreness).toEqual(['背']);
  });
});

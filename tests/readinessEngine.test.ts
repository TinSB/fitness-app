import { describe, expect, it } from 'vitest';
import { buildReadinessResult } from '../src/engines/readinessEngine';

describe('readinessEngine', () => {
  it('poor sleep and low energy produce a low score', () => {
    const result = buildReadinessResult({
      sleep: 'poor',
      energy: 'low',
      sorenessAreas: ['chest'],
      painAreas: [],
      availableTimeMin: 30,
      plannedTimeMin: 60,
    });

    expect(result.score).toBeLessThan(50);
    expect(result.level).toBe('low');
  });

  it('high readiness supports normal or push', () => {
    const result = buildReadinessResult(
      {
        sleep: 'good',
        energy: 'high',
        sorenessAreas: [],
        painAreas: [],
        availableTimeMin: 90,
        plannedTimeMin: 60,
      },
      { adherenceHigh: true }
    );

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(['normal', 'push']).toContain(result.trainingAdjustment);
  });

  it('pain areas force a conservative or recovery adjustment', () => {
    const result = buildReadinessResult({
      sleep: 'ok',
      energy: 'medium',
      sorenessAreas: ['back'],
      painAreas: ['shoulder'],
      availableTimeMin: 60,
      plannedTimeMin: 60,
    });

    expect(['conservative', 'recovery']).toContain(result.trainingAdjustment);
  });
});

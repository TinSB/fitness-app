import { describe, expect, it } from 'vitest';
import { buildProgressClaritySummary, type ProgressClaritySummaryInput } from '../src/engines/progressClaritySummary';

const baseInput = (overrides: ProgressClaritySummaryInput = {}): ProgressClaritySummaryInput => ({
  dataCoverageStatus: 'sufficient',
  effectiveSetSummary: {
    completedSets: 12,
    effectiveSets: 8,
    highConfidenceEffectiveSets: 6,
    mediumConfidenceEffectiveSets: 2,
    lowConfidenceEffectiveSets: 0,
  },
  volumeSummary: {
    thisMonthSessions: 6,
    recentFourWeekAverage: 3,
    completedSets: 12,
    painSessionCount: 0,
  },
  strengthTrendItems: [
    {
      id: 'bench-press',
      label: '卧推',
      currentLabel: '100kg e1RM',
      bestLabel: '100kg x 5',
      trend: 'improving',
      explanation: '使用现有 PR / e1RM 结果。',
    },
  ],
  ...overrides,
});

describe('progressClaritySummary', () => {
  it('returns improving insight for improving strength with normal recovery pressure', () => {
    const result = buildProgressClaritySummary(baseInput({ strengthTrend: 'improving', recoveryPressure: 'normal' }));

    expect(result.insightState).toBe('improving');
    expect(result.heroTitle).toContain('上升');
    expect(result.primaryRecommendation).toBe('保守加重');
    expect(result.recoveryPressureLabel).toBe('压力正常');
  });

  it('returns fatigue risk when strength improves but recovery pressure is high', () => {
    const result = buildProgressClaritySummary(baseInput({ strengthTrend: 'improving', recoveryPressure: 'high' }));

    expect(result.insightState).toBe('fatigue_risk');
    expect(result.heroTitle).toContain('恢复压力偏高');
    expect(result.primaryRecommendation).toBe('保持重量');
    expect(result.effectiveSetExplanation).toContain('恢复压力可能增加');
  });

  it('returns stable insight for stable trends', () => {
    const result = buildProgressClaritySummary(baseInput({ strengthTrend: 'stable', recoveryPressure: 'normal' }));

    expect(result.insightState).toBe('stable');
    expect(result.heroTitle).toContain('稳定');
    expect(result.primaryRecommendation).toBe('继续观察');
  });

  it('returns insufficient data without overclaiming', () => {
    const result = buildProgressClaritySummary(baseInput({
      dataCoverageStatus: 'insufficient',
      strengthTrend: 'unknown',
      strengthTrendItems: [],
      effectiveSetSummary: {
        completedSets: 0,
        effectiveSets: 0,
        highConfidenceEffectiveSets: 0,
        mediumConfidenceEffectiveSets: 0,
        lowConfidenceEffectiveSets: 0,
      },
    }));

    expect(result.insightState).toBe('data_insufficient');
    expect(result.heroTitle).toContain('数据不足');
    expect(result.dataCoverageHint).toContain('不做趋势过度判断');
    expect(result.heroExplanation).not.toContain('明显上升');
  });

  it('explains recovery pressure when effective sets and volume are high', () => {
    const result = buildProgressClaritySummary(baseInput({
      recoveryPressure: 'high',
      effectiveSetSummary: {
        completedSets: 36,
        effectiveSets: 28,
        highConfidenceEffectiveSets: 18,
        mediumConfidenceEffectiveSets: 7,
        lowConfidenceEffectiveSets: 3,
      },
    }));

    expect(result.effectiveSetExplanation).toContain('训练刺激偏高');
    expect(result.volumeExplanation).toContain('建议先保持重量或减少一组');
  });

  it('does not mutate inputs and keeps invariant flags false', () => {
    const input = baseInput();
    const before = JSON.stringify(input);
    const result = buildProgressClaritySummary(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(result.sourceOfTruthChanged).toBe(false);
    expect(result.trainingAlgorithmChanged).toBe(false);
    expect(result.calculationChanged).toBe(false);
  });
});

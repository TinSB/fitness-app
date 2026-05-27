// RGR-3: strength_up + fatigue_high → ONE coherent decision, no contradictory triplet.
// See docs/TRAINING_RECOMMENDATION_SOURCE_OF_TRUTH_REWRITE_PLAN_V1.md §9 AR-5.

import { describe, expect, it } from 'vitest';
import { buildProgressClaritySummary } from '../src/engines/progressClaritySummary';
import { buildWeeklyProgressionRecommendation } from '../src/engines/weeklyProgressionRecommendationEngine';

describe('trainingDecisionSourceOfTruthArbitrationStrengthUpFatigueHigh', () => {
  it('progressClaritySummary: legacy triplet emitted WITHOUT trainingDecisionContext (baseline)', () => {
    const result = buildProgressClaritySummary({
      strengthTrend: 'improving',
      recoveryPressure: 'high',
      dataCoverageStatus: 'sufficient',
      effectiveSetSummary: { completedSets: 24, effectiveSets: 18 },
    });
    // Baseline (legacy) emits the contradictory triplet
    expect(result.heroTitle).toContain('力量有进步');
    expect(result.heroTitle).toContain('恢复压力偏高');
    expect(result.primaryRecommendation).toContain('保持重量');
  });

  it('progressClaritySummary: triplet SUPPRESSED when sessionIntent=reentry-productive', () => {
    const result = buildProgressClaritySummary({
      strengthTrend: 'improving',
      recoveryPressure: 'high',
      dataCoverageStatus: 'sufficient',
      effectiveSetSummary: { completedSets: 24, effectiveSets: 18 },
      trainingDecisionContext: {
        sessionIntent: 'reentry-productive',
        activePhase: 'reentry',
      },
    });
    // Triplet must not appear together; AR-5 forces coherent single direction
    const concat = `${result.heroTitle} | ${result.primaryRecommendation} | ${result.heroExplanation}`;
    expect(concat).not.toMatch(/力量有进步.*恢复压力偏高/);
    expect(result.heroTitle).toContain('回归周');
  });

  it('progressClaritySummary: controlled-reload uses single coherent line', () => {
    const result = buildProgressClaritySummary({
      strengthTrend: 'improving',
      recoveryPressure: 'high',
      dataCoverageStatus: 'sufficient',
      trainingDecisionContext: {
        sessionIntent: 'controlled-reload',
      },
    });
    expect(result.heroTitle).toContain('力量在进步');
    expect(result.heroTitle).toContain('收一档');
    expect(result.primaryRecommendation).toBe('保持重量');
  });

  it('weeklyProgressionRecommendation: "本周先控制风险" emitted WITHOUT trainingDecisionContext (baseline)', () => {
    const result = buildWeeklyProgressionRecommendation({
      volumeAdaptation: {
        weekId: '2026-05-27',
        muscles: [
          { muscleId: 'chest', decision: 'decrease', setsDelta: -2, weeklyTarget: 12, weeklyActual: 14, reasons: [] },
        ],
        sourceEngineIds: ['volumeAdaptationEngine'],
      } as never,
    });
    // Baseline produces the conservative summary
    expect(result.summary).toMatch(/本周先控制风险|继续记录后再判断|维持当前节奏/);
  });

  it('weeklyProgressionRecommendation: SUPPRESS double penalty when reentry-active', () => {
    const result = buildWeeklyProgressionRecommendation({
      volumeAdaptation: {
        weekId: '2026-05-27',
        muscles: [
          { muscleId: 'chest', decision: 'decrease', setsDelta: -2, weeklyTarget: 12, weeklyActual: 14, reasons: [] },
        ],
        sourceEngineIds: ['volumeAdaptationEngine'],
      } as never,
      trainingDecisionContext: {
        activePhase: 'reentry',
        weeklyDirectionBlocked: true,
      },
    });
    // AR-4: no "本周先控制风险" double-penalty under reentry
    expect(result.summary).not.toBe('本周先控制风险。');
    expect(result.summary).toMatch(/回归周|维持当前节奏/);
  });
});

import { describe, expect, it } from 'vitest';
import { buildDailyTrainingAdjustment } from '../src/engines/dailyTrainingAdjustmentEngine';
import type { HealthSummary } from '../src/engines/healthSummaryEngine';
import type { LoadFeedbackSummary } from '../src/engines/loadFeedbackEngine';
import type { PainPattern, ReadinessResult } from '../src/models/training-model';
import { getTemplate, makeSession } from './fixtures';

const normalReadiness: ReadinessResult = {
  score: 82,
  level: 'high',
  trainingAdjustment: 'normal',
  reasons: [],
};

const normalHealth: HealthSummary = {
  latestSleepHours: 7.5,
  recentWorkoutCount: 0,
  recentWorkoutMinutes: 0,
  recentHighActivityDays: 0,
  notes: ['健康数据仅作恢复参考，不做医疗诊断。'],
  confidence: 'medium',
};

const visibleText = (adjustment: ReturnType<typeof buildDailyTrainingAdjustment>) =>
  [
    adjustment.title,
    adjustment.summary,
    ...adjustment.reasons,
    ...adjustment.suggestedChanges.map((item) => item.reason),
  ].join('\n');

describe('dailyTrainingAdjustmentEngine', () => {
  it('turns low sleep into a conservative training suggestion', () => {
    const adjustment = buildDailyTrainingAdjustment({
      readinessResult: normalReadiness,
      healthSummary: { ...normalHealth, latestSleepHours: 5.2 },
      activeTemplate: getTemplate('push-a'),
      trainingLevel: 'intermediate',
    });

    expect(adjustment.type).toBe('conservative');
    expect(adjustment.title).toBe('保守训练');
    expect(adjustment.reasons.join('\n')).toContain('睡眠');
    expect(adjustment.requiresUserConfirmation).toBe(true);
  });

  it('reduces support work after high external activity in the previous 24 hours', () => {
    const adjustment = buildDailyTrainingAdjustment({
      readinessResult: normalReadiness,
      healthSummary: normalHealth,
      previous24hActivity: { workoutMinutes: 75, activeEnergyKcal: 620, highActivity: true },
      activeTemplate: getTemplate('legs-a'),
      trainingLevel: 'intermediate',
    });

    expect(adjustment.type).toBe('reduce_support');
    expect(adjustment.suggestedChanges.some((item) => item.type === 'reduce_support')).toBe(true);
    expect(adjustment.summary).toContain('减少辅助');
  });

  it('suggests substitutions when pain patterns match the active template', () => {
    const pain: PainPattern = {
      area: '胸',
      exerciseId: 'bench-press',
      frequency: 2,
      severityAvg: 3.5,
      lastOccurredAt: '2026-04-28',
      suggestedAction: 'substitute',
    };

    const adjustment = buildDailyTrainingAdjustment({
      readinessResult: normalReadiness,
      healthSummary: normalHealth,
      painPatterns: [pain],
      activeTemplate: getTemplate('push-a'),
      trainingLevel: 'intermediate',
    });

    expect(adjustment.type).toBe('substitute_risky_exercises');
    expect(adjustment.suggestedChanges.some((item) => item.type === 'substitute_exercise' && item.targetId === 'bench-press')).toBe(true);
    expect(adjustment.reasons.join('\n')).toContain('不适');
  });

  it('keeps normal status when there are no meaningful limiting signals', () => {
    const adjustment = buildDailyTrainingAdjustment({
      readinessResult: normalReadiness,
      healthSummary: normalHealth,
      activeTemplate: getTemplate('pull-a'),
      trainingLevel: 'intermediate',
    });

    expect(adjustment.type).toBe('normal');
    expect(adjustment.title).toBe('照常训练');
    expect(adjustment.suggestedChanges).toEqual([]);
    expect(adjustment.requiresUserConfirmation).toBe(false);
  });

  it('keeps unknown training level conservative without enabling aggressive progression', () => {
    const adjustment = buildDailyTrainingAdjustment({
      readinessResult: normalReadiness,
      healthSummary: normalHealth,
      activeTemplate: getTemplate('legs-a'),
      trainingLevel: 'unknown',
    });

    expect(adjustment.type).toBe('conservative');
    expect(adjustment.reasons.join('\n')).toContain('训练基线');
    expect(adjustment.suggestedChanges.some((item) => item.type === 'keep_main_lifts')).toBe(true);
  });

  it('uses too-heavy load feedback as an exercise-specific conservative signal', () => {
    const feedback: LoadFeedbackSummary = {
      exerciseId: 'bench-press',
      total: 3,
      counts: { too_light: 0, good: 1, too_heavy: 2 },
      dominantFeedback: 'too_heavy',
      adjustment: {
        direction: 'conservative',
        dominantFeedback: 'too_heavy',
        reasons: ['近期反馈偏重。'],
      },
    };

    const adjustment = buildDailyTrainingAdjustment({
      readinessResult: normalReadiness,
      healthSummary: normalHealth,
      loadFeedbackSummary: feedback,
      activeTemplate: getTemplate('push-a'),
      trainingLevel: 'intermediate',
    });

    expect(adjustment.type).toBe('conservative');
    expect(adjustment.suggestedChanges.some((item) => item.targetId === 'bench-press' && item.type === 'reduce_volume')).toBe(true);
    expect(adjustment.reasons.join('\n')).toContain('偏重');
  });

  it('can suggest recovery when readiness is very low', () => {
    const adjustment = buildDailyTrainingAdjustment({
      readinessResult: {
        score: 38,
        level: 'low',
        trainingAdjustment: 'recovery',
        reasons: ['精力偏低'],
      },
      healthSummary: normalHealth,
      activeTemplate: getTemplate('legs-a'),
      trainingLevel: 'intermediate',
    });

    expect(adjustment.type).toBe('rest_or_recovery');
    expect(adjustment.summary).toContain('恢复');
  });

  it('does not mutate the active template or history inputs', () => {
    const template = getTemplate('push-a');
    const history = [
      makeSession({
        id: 'history-high-volume',
        date: '2026-04-28',
        templateId: 'push-a',
        exerciseId: 'bench-press',
        setSpecs: Array.from({ length: 4 }, () => ({ weight: 80, reps: 8, rir: 2, techniqueQuality: 'good' as const })),
      }),
    ];
    const beforeTemplate = JSON.stringify(template);
    const beforeHistory = JSON.stringify(history);

    buildDailyTrainingAdjustment({
      readinessResult: normalReadiness,
      healthSummary: normalHealth,
      recentHistory: history,
      activeTemplate: template,
      trainingLevel: 'intermediate',
    });

    expect(JSON.stringify(template)).toBe(beforeTemplate);
    expect(JSON.stringify(history)).toBe(beforeHistory);
  });

  it('keeps visible text Chinese and avoids raw enum leakage', () => {
    const adjustment = buildDailyTrainingAdjustment({
      readinessResult: normalReadiness,
      healthSummary: { ...normalHealth, latestSleepHours: 5.5 },
      activeTemplate: getTemplate('push-a'),
      trainingLevel: 'unknown',
    });
    const text = visibleText(adjustment);

    expect(text).not.toMatch(/\b(conservative|normal|unknown|reduce_support|too_heavy|undefined|null)\b/);
    expect(text).toMatch(/[保守训练睡眠训练基线]/);
  });
});

import { describe, expect, it } from 'vitest';
import {
  formatAdherenceConfidence,
  formatBlockType,
  formatComplexityLevel,
  formatConfidence,
  formatCyclePhase,
  formatDataFlag,
  formatExerciseName,
  formatFatigueCost,
  formatGoal,
  formatIntensityBias,
  formatPainAction,
  formatReplacementCategory,
  formatRiskLevel,
  formatRomPriority,
  formatSkippedReason,
  formatSkillDemand,
  formatSplitType,
  formatSupportDoseAdjustment,
  formatTechniqueQuality,
  formatTrainingAdjustment,
  formatWarmupPolicy,
  formatWeeklyActionCategory,
  formatWeeklyActionPriority,
} from '../src/i18n/formatters';

describe('i18n formatters', () => {
  it('formats core enums as Chinese user-facing labels', () => {
    expect(formatCyclePhase('deload')).toBe('减量周');
    expect(formatIntensityBias('aggressive')).toBe('积极');
    expect(formatSplitType('upper_lower')).toBe('上下肢分化');
    expect(formatGoal('hypertrophy')).toBe('肌肥大（增肌）');
    expect(formatBlockType('functional')).toBe('功能补丁');
    expect(formatTechniqueQuality('poor')).toBe('较差');
    expect(formatTrainingAdjustment('conservative')).toBe('保守训练');
    expect(formatAdherenceConfidence('high')).toBe('高');
    expect(formatSkippedReason('too_tired')).toContain('疲劳');
    expect(formatPainAction('substitute')).toContain('替代');
    expect(formatSupportDoseAdjustment('remove_optional')).toContain('移除');
    expect(formatComplexityLevel('minimal')).toContain('最小');
  });

  it('does not expose known raw enum values', () => {
    expect(formatCyclePhase('base')).not.toBe('base');
    expect(formatIntensityBias('normal')).not.toBe('normal');
    expect(formatTechniqueQuality('acceptable')).not.toBe('acceptable');
  });

  it('uses a safe fallback for unknown values', () => {
    expect(formatCyclePhase('unknown')).toContain('未识别');
  });

  it('formats weekly coach action enums as Chinese labels', () => {
    expect(formatWeeklyActionPriority('high')).toContain('优先级');
    expect(formatWeeklyActionCategory('load_feedback')).toContain('重量');
    expect(formatWeeklyActionCategory('volume')).not.toBe('volume');
  });

  it('formats replacement and status labels without exposing raw English enums', () => {
    const labels = [
      formatFatigueCost('high'),
      formatFatigueCost('medium'),
      formatFatigueCost('low'),
      formatConfidence('medium'),
      formatReplacementCategory('optional'),
      formatReplacementCategory('not_recommended'),
      formatSkillDemand('high'),
      formatRomPriority('medium'),
      formatWarmupPolicy('skipped_by_policy'),
      formatDataFlag('test'),
      formatRiskLevel('high'),
    ];

    labels.forEach((label) => {
      expect(label).not.toMatch(/\b(high|medium|low|optional|skipped_by_policy|test)\b/);
      expect(label).not.toMatch(/undefined|null/);
    });
  });

  it('formats exercise names as Chinese by default and never falls back to pure English ids', () => {
    expect(formatExerciseName('bench-press')).toBe('平板卧推');
    expect(formatExerciseName({ id: 'db-bench-press', name: 'Dumbbell Bench Press' })).toBe('哑铃卧推');
    expect(formatExerciseName('Unknown English Exercise')).toBe('未知动作');
  });
});

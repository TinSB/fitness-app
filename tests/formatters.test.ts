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
  formatMovementPattern,
  formatMuscleName,
  formatPainAction,
  formatPrimaryGoal,
  formatReplacementCategory,
  formatRirLabel,
  formatRiskLevel,
  formatRomPriority,
  formatSetType,
  formatSkippedReason,
  formatSkillDemand,
  formatSplitType,
  formatSupportDoseAdjustment,
  formatTemplateName,
  formatTechniqueQuality,
  formatTrainingAdjustment,
  formatTrainingDayName,
  formatTrainingMode,
  formatWarmupPolicy,
  formatWarmupDecision,
  formatWeeklyActionCategory,
  formatWeeklyActionPriority,
} from '../src/i18n/formatters';

describe('i18n formatters', () => {
  it('formats core enums as Chinese user-facing labels', () => {
    expect(formatCyclePhase('deload')).toBe('减量周');
    expect(formatIntensityBias('aggressive')).toBe('积极');
    expect(formatSplitType('upper_lower')).toBe('上下肢分化');
    expect(formatGoal('hypertrophy')).toBe('肌肥大（增肌）');
    expect(formatPrimaryGoal('fat_loss')).toBe('减脂');
    expect(formatPrimaryGoal('health_maintenance')).toBe('健康维持');
    expect(formatTrainingMode('hybrid')).toBe('综合');
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
    expect(formatCyclePhase('unknown')).toBe('未知状态');
  });

  it('formats template and training day names consistently in Chinese', () => {
    expect(formatTemplateName('legs-a')).toBe('腿 A');
    expect(formatTemplateName('Legs A')).toBe('腿 A');
    expect(formatTemplateName('pushA')).toBe('推 A');
    expect(formatTemplateName('Pull A')).toBe('拉 A');
    expect(formatTrainingDayName('Upper A')).toBe('上肢 A');
    expect(formatTrainingDayName('Full Body')).toBe('全身训练');
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
      formatWarmupDecision('feeder_set'),
      formatDataFlag('test'),
      formatRiskLevel('high'),
      formatMuscleName('chest'),
      formatMovementPattern('horizontal_push'),
      formatSetType('warmup'),
      formatRirLabel('1-3 RIR'),
    ];

    labels.forEach((label) => {
      expect(label).not.toMatch(/\b(high|medium|low|optional|skipped_by_policy|test)\b/);
      expect(label).not.toMatch(/undefined|null/);
    });
  });

  it('formats exercise names as Chinese by default and never falls back to pure English ids', () => {
    expect(formatExerciseName('bench-press')).toBe('平板卧推');
    expect(formatExerciseName({ id: 'db-bench-press', name: 'Dumbbell Bench Press' })).toBe('哑铃卧推');
    expect(formatExerciseName('Unknown English Exercise')).toBe('未命名动作');
  });
});

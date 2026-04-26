import { describe, expect, it } from 'vitest';
import {
  formatAdherenceConfidence,
  formatBlockType,
  formatComplexityLevel,
  formatCyclePhase,
  formatGoal,
  formatIntensityBias,
  formatPainAction,
  formatSkippedReason,
  formatSplitType,
  formatSupportDoseAdjustment,
  formatTechniqueQuality,
  formatTrainingAdjustment,
  formatWeeklyActionCategory,
  formatWeeklyActionPriority,
} from '../src/i18n/formatters';

describe('i18n formatters', () => {
  it('formats core enums as Chinese user-facing labels', () => {
    expect(formatCyclePhase('deload')).toBe('减量周');
    expect(formatIntensityBias('aggressive')).toBe('积极');
    expect(formatSplitType('upper_lower')).toBe('上下肢分化');
    expect(formatGoal('hypertrophy')).toBe('肌肥大');
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
});

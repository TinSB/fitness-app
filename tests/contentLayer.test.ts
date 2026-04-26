import { describe, expect, it } from 'vitest';
import { DEFINITIONS } from '../src/content/definitions';
import { TRAINING_STANDARDS } from '../src/content/evidenceRules';
import { buildCoachSentence, hasTextPollution } from '../src/content/professionalCopy';
import { PHASE_LABELS, TERMS } from '../src/i18n/terms';
import { buildTodayExplanations } from '../src/engines/explainabilityEngine';
import { DEFAULT_SCREENING_PROFILE } from '../src/data/defaults';

describe('中文术语与循证内容层', () => {
  it('统一核心术语映射', () => {
    expect(TERMS.readinessScore).toBe('准备度评分');
    expect(PHASE_LABELS.deload).toBe('减量周');
    expect(TERMS.functionalBlock).toBe('功能补丁');
  });

  it('关键定义包含中文解释', () => {
    expect(DEFINITIONS.RIR.body).toContain('剩余');
    expect(DEFINITIONS.ROM.body).toContain('动作');
    expect(DEFINITIONS.medicalBoundary.body).toContain('不提供医疗诊断');
  });

  it('训练标准规则可被稳定引用', () => {
    expect(TRAINING_STANDARDS.hypertrophyRepRange.min).toBeGreaterThan(0);
    expect(TRAINING_STANDARDS.rirRecommendedRange.note).toContain('RIR');
    expect(TRAINING_STANDARDS.poorTechniqueProgression.progressionAllowed).toBe(false);
  });

  it('专业解释模板不输出空值或污染文本', () => {
    const text = buildCoachSentence({
      conclusion: '本次不建议加重',
      reason: '动作质量较差',
      action: '先维持重量并提高控制质量',
    });

    expect(text).toContain('本次不建议加重');
    expect(text).not.toContain('undefined');
    expect(hasTextPollution(text)).toBe(false);
  });

  it('今日解释有稳定回退文案', () => {
    const explanations = buildTodayExplanations({
      template: { id: 'push-a', name: '推 A', focus: '推' },
      adjustedPlan: {
        id: 'push-a',
        name: '推 A',
        focus: '推',
        exercises: [],
      },
      supportPlan: {
        primaryGoal: 'hypertrophy',
        mainline: { name: '推 A', splitType: 'upper_lower', durationMin: 60, ratio: 80 },
        correctionModules: [],
        functionalAddons: [],
        totalDurationMin: 60,
        ratios: { mainline: 80, correction: 10, functional: 10 },
      },
      weeklyPrescription: { weekStart: '2026-04-20', muscles: [] },
      screening: DEFAULT_SCREENING_PROFILE,
      todayStatus: { sleep: '一般', energy: '中', soreness: ['无'], time: '60' },
    });

    expect(explanations.join(' ')).toContain('正常推进');
    expect(explanations.join(' ')).not.toContain('undefined');
    expect(hasTextPollution(explanations.join(' '))).toBe(false);
  });
});

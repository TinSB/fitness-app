import { describe, expect, it } from 'vitest';
import type { RecommendationFactor, RecommendationTrace } from '../src/engines/recommendationTraceEngine';
import { buildRecommendationExplanationViewModel } from '../src/presenters/recommendationExplanationPresenter';

const factor = (source: RecommendationFactor['source'], reason: string): RecommendationFactor => ({
  id: source,
  label: source,
  effect: 'decrease',
  magnitude: 'moderate',
  source,
  reason,
});

const trace = (factors: RecommendationFactor[]): RecommendationTrace => ({
  sessionTemplateId: 'pull-a',
  primaryGoal: '增肌',
  trainingMode: '综合',
  trainingLevel: '中阶',
  globalFactors: factors,
  exerciseFactors: {},
  volumeFactors: [],
  loadFeedbackFactors: [],
  finalSummary: '推荐说明。',
});

describe('recommendation explanation source labels', () => {
  it('maps new recovery and restriction sources to Chinese labels', () => {
    const vm = buildRecommendationExplanationViewModel(
      trace([
        factor('soreness', '你今天标记了背部酸痛。'),
        factor('recoveryConflict', '当前训练安排与今天的恢复状态有一定冲突。'),
        factor('painPattern', '近期训练中该动作出现过不适记录。'),
        factor('screeningRestriction', '当前筛查记录提示该动作模式需要保守处理。'),
      ]),
    );
    const text = [...vm.primaryFactors, ...vm.secondaryFactors].flatMap((item) => [item.label, item.reason]).join(' ');

    expect(text).toContain('酸痛状态');
    expect(text).toContain('恢复提醒');
    expect(text).toContain('不适记录');
    expect(text).toContain('限制提醒');
    expect(text).not.toContain('不适信号');
    expect(text).not.toMatch(/\b(soreness|recoveryConflict|painPattern|screeningRestriction|undefined|null)\b/);
  });

  it('does not hide true pain history when recovery recommendation exists', () => {
    const vm = buildRecommendationExplanationViewModel(
      trace([
        factor('recoveryConflict', '今天酸痛与模板有冲突。'),
        factor('painPattern', '近期训练中该动作出现过不适记录。'),
      ]),
      {
        recoveryRecommendation: {
          kind: 'modified_train',
          templateId: 'pull-a',
          templateName: '拉 A',
          title: '今日建议',
          summary: '拉 A 保守版',
          conflictLevel: 'moderate',
          affectedAreas: ['背'],
          reasons: ['你今天标记了背部酸痛。'],
          suggestedChanges: [],
          requiresConfirmationToOverride: true,
          templateRecoveryConflict: {
            templateId: 'pull-a',
            templateName: '拉 A',
            conflictLevel: 'moderate',
            kind: 'modified_train',
            conflictingExercises: [],
            safeExercises: [],
            suggestedChanges: [],
            summary: '拉 A 保守版',
          },
        },
      },
    );
    const labels = vm.primaryFactors.map((item) => item.label);

    expect(labels).toContain('恢复提醒');
    expect(labels).toContain('不适记录');
    expect(labels).not.toContain('不适信号');
  });
});

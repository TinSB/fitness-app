import type { AdjustmentEffectReview, ProgramAdjustmentDiff, WeeklyActionRecommendation } from '../../models/training-model';
import { buildTemplate } from './shared';

export const explainAdjustmentDefaultSelection = (recommendation: WeeklyActionRecommendation) =>
  buildTemplate(
    recommendation.priority === 'high' && recommendation.confidence !== 'low' ? '该建议默认选中' : '该建议默认仅作参考',
    recommendation.priority === 'high' && recommendation.confidence !== 'low'
      ? '它同时具备较高优先级和可用置信度，适合进入下周实验模板预览。'
      : '它的优先级或置信度还不够高，适合先人工查看，不自动进入实验调整。',
    '你仍然可以手动选择或取消选择，系统不会强制修改原模板。'
  );

export const explainExperimentalTemplatePolicy = () =>
  buildTemplate(
    '系统会生成实验模板，而不是直接覆盖原模板',
    '这些建议来自近期训练数据，但本质上仍然属于需要验证的微调。直接覆盖原模板会降低可追踪性和可回滚性。',
    '应用后会复制出一份实验版本，原模板和回滚入口都会保留。'
  );

export const explainAdjustmentRisk = (change: ProgramAdjustmentDiff['changes'][number]) =>
  buildTemplate(
    `${change.label} 的风险等级为${change.riskLevel === 'high' ? '高风险' : change.riskLevel === 'medium' ? '中风险' : '低风险'}`,
    change.riskLevel === 'high'
      ? '这次调整缺少足够明确的自动落地条件，或者会改变动作插入与训练日分配，所以需要人工确认。'
      : '这次调整幅度较小，并且可以映射到当前模板里的具体动作或 support 配置。',
    change.riskLevel === 'high' ? '高风险变更默认不直接自动应用，建议先看清楚预览差异。' : '可以把它放进下周实验模板，继续短周期观察。'
  );

export const explainAdjustmentReview = (review: AdjustmentEffectReview) =>
  buildTemplate(
    review.status === 'improved' ? '实验模板初步有效' : review.status === 'worse' ? '实验模板需要复核' : '实验模板仍需继续观察',
    review.summary,
    review.recommendation === 'rollback'
      ? '建议回滚到原模板。'
      : review.recommendation === 'keep'
        ? '可以先保留实验模板，并继续记录后续表现。'
        : '先不要自动定论，继续收集完成度、不适和有效组数据。'
  );

export const explainAddNewExerciseDecision = (change: {
  exerciseName?: string;
  dayTemplateName?: string;
  previewNote?: string;
  existingExerciseName?: string;
}) =>
  buildTemplate(
    change.dayTemplateName ? `这次更适合新增 ${change.exerciseName || '动作'}` : `这次先不自动插入 ${change.exerciseName || '动作'}`,
    change.dayTemplateName
      ? `当前周目标更需要补一个新的动作槽位，而不是继续给 ${change.existingExerciseName || '原动作'} 堆组数。`
      : change.previewNote || '系统暂时不能安全判断该插入哪个训练日，所以不会替你硬塞进去。',
    change.dayTemplateName
      ? `${change.exerciseName || '这个动作'} 会优先放在 ${change.dayTemplateName} 的辅助动作区，尽量不打乱主复合动作顺序。`
      : '先手动确认训练日，再重新生成预览会更稳。'
  );

export const explainSupportAdjustmentChange = (change: {
  type: 'reduce_support' | 'increase_support';
  summaryBefore?: string;
  summaryAfter?: string;
  skipped?: boolean;
}) =>
  buildTemplate(
    change.skipped ? '这次 support 调整没有自动应用' : change.type === 'reduce_support' ? '这次会主动减 support 剂量' : '这次会主动加 support 剂量',
    change.skipped
      ? '当前配置里没有足够明确、又能安全落地的 support 改动空间。'
      : change.type === 'reduce_support'
        ? '近期完成度或恢复信号更需要把资源让给主训练，所以会减少纠偏或功能补丁的剂量。'
        : '当前筛查与反馈提示 support 层不够，适合补一个关键纠偏模块或功能补丁。',
    change.skipped ? '这次会保留现有 support 配置，并把原因写进预览备注。' : `${change.summaryBefore || '调整前状态'}，会变成 ${change.summaryAfter || '调整后状态'}。`
  );

export const explainAdjustmentDraftStale = () =>
  buildTemplate(
    '旧预览不会直接应用到新模板上',
    '生成预览后，如果原模板又被你改过，旧预览里的前后差异就已经失真了。',
    '系统会把这份 draft 标记为过期，并提示你重新生成调整预览。'
  );

export const explainAdjustmentTooEarly = () =>
  buildTemplate(
    '现在评价实验效果还太早',
    '实验模板至少要跑过 1 到 2 次相关训练，才能开始判断它到底是在帮你，还是只是在制造噪音。',
    '先继续记录完成度、不适信号和有效组，再看是否保留或回滚。'
  );

export const explainAdjustmentRollbackDecision = (reason?: string) =>
  buildTemplate(
    '这次更建议回滚到原模板',
    reason || '实验模板后的不适、完成度或有效训练量信号说明，这次调整没有换来更好的结果。',
    '回滚不会覆盖原模板历史，只是把当前使用的模板切回到更稳定的版本。'
  );

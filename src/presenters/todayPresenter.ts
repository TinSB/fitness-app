import type { TrainingTemplate } from '../models/training-model';
import type { TodayTrainingState } from '../engines/todayStateEngine';
import type { RecoveryAwareRecommendation } from '../engines/recoveryAwareScheduler';
import { formatTemplateName } from '../i18n/formatters';

export type TodayViewModel = {
  state: TodayTrainingState['status'];
  pageTitle: string;
  recommendationLabel: string;
  primaryActionLabel: string;
  secondaryActionLabels: string[];
  statusText: string;
  currentTrainingName: string;
  decisionText: string;
  nextSuggestion: {
    templateId?: string;
    templateName: string;
    description: string;
  };
  recommendationKind?: RecoveryAwareRecommendation['kind'];
  recoverySummary?: string;
  recoveryReasons?: string[];
  requiresRecoveryOverride?: boolean;
  recommendedTemplateId?: string;
};

const buildNextSuggestion = (template?: Pick<TrainingTemplate, 'id' | 'name'> | null): TodayViewModel['nextSuggestion'] => {
  if (!template?.id && !template?.name) {
    return {
      templateName: '暂无下次建议',
      description: '暂无下次建议。已完成的训练记录会保留在记录页。',
    };
  }
  const templateName = formatTemplateName(template.id || template.name, '暂无下次建议');
  return {
    templateId: template.id,
    templateName,
    description: `下次建议：${templateName}。这是下一次训练参考，不会覆盖今日已完成状态。`,
  };
};

export const buildTodayViewModel = ({
  todayState,
  selectedTemplate,
  completedTemplateName,
  activeTemplateName,
  nextSuggestion,
  recoveryRecommendation,
}: {
  todayState: TodayTrainingState;
  selectedTemplate: TrainingTemplate;
  completedTemplateName?: string;
  activeTemplateName?: string;
  nextSuggestion?: Pick<TrainingTemplate, 'id' | 'name'> | null;
  recoveryRecommendation?: RecoveryAwareRecommendation;
}): TodayViewModel => {
  const selectedTemplateName = formatTemplateName(selectedTemplate);
  const resolvedNextSuggestion = buildNextSuggestion(nextSuggestion);

  if (todayState.status === 'completed') {
    const completedName = completedTemplateName ? formatTemplateName(completedTemplateName, '本次训练') : '本次训练';
    return {
      state: 'completed',
      pageTitle: '今日训练已完成',
      recommendationLabel: '下次建议',
      primaryActionLabel: '查看本次训练',
      secondaryActionLabels: ['查看训练日历', '再练一场'],
      statusText: `已完成 ${completedName}。下次建议只作为参考，不代表今天必须继续训练。`,
      currentTrainingName: resolvedNextSuggestion.templateName,
      decisionText: `已完成 ${completedName}。下次建议只作为参考，不是今天必须继续训练。`,
      nextSuggestion: resolvedNextSuggestion,
    };
  }

  if (todayState.status === 'in_progress') {
    const currentTrainingName = activeTemplateName ? formatTemplateName(activeTemplateName, '当前训练') : '当前训练';
    return {
      state: 'in_progress',
      pageTitle: '训练进行中',
      recommendationLabel: '当前训练',
      primaryActionLabel: '继续训练',
      secondaryActionLabels: ['查看完整训练页'],
      statusText: '当前有未完成训练，继续记录即可。',
      currentTrainingName,
      decisionText: '当前训练还没有结束，继续记录当前组即可。',
      nextSuggestion: resolvedNextSuggestion,
    };
  }

  if (recoveryRecommendation && recoveryRecommendation.kind !== 'train') {
    const currentTrainingName =
      recoveryRecommendation.kind === 'modified_train' && recoveryRecommendation.templateName
        ? `${recoveryRecommendation.templateName}（保守建议）`
        : recoveryRecommendation.title.replace('今日建议：', '');
    const primaryActionLabel =
      recoveryRecommendation.kind === 'rest'
        ? '查看恢复建议'
        : recoveryRecommendation.kind === 'active_recovery'
          ? '查看恢复安排'
          : recoveryRecommendation.kind === 'mobility_only'
            ? '开始轻量恢复'
            : '查看保守建议';
    return {
      state: 'not_started',
      pageTitle: recoveryRecommendation.kind === 'rest' || recoveryRecommendation.kind === 'active_recovery' ? '今日恢复优先' : '今日建议已调整',
      recommendationLabel: '今日建议',
      primaryActionLabel,
      secondaryActionLabels: ['仍要训练'],
      statusText: recoveryRecommendation.summary,
      currentTrainingName,
      decisionText: recoveryRecommendation.summary,
      nextSuggestion: resolvedNextSuggestion,
      recommendationKind: recoveryRecommendation.kind,
      recoverySummary: recoveryRecommendation.summary,
      recoveryReasons: recoveryRecommendation.reasons,
      requiresRecoveryOverride: recoveryRecommendation.requiresConfirmationToOverride,
      recommendedTemplateId: recoveryRecommendation.templateId,
    };
  }

  if (recoveryRecommendation?.templateId && recoveryRecommendation.templateId !== selectedTemplate.id) {
    return {
      state: 'not_started',
      pageTitle: '今天该怎么练',
      recommendationLabel: '今日建议',
      primaryActionLabel: '开始推荐训练',
      secondaryActionLabels: ['查看动作安排'],
      statusText: recoveryRecommendation.summary,
      currentTrainingName: recoveryRecommendation.templateName || formatTemplateName(recoveryRecommendation.templateId),
      decisionText: recoveryRecommendation.summary,
      nextSuggestion: resolvedNextSuggestion,
      recommendationKind: recoveryRecommendation.kind,
      recoverySummary: recoveryRecommendation.summary,
      recoveryReasons: recoveryRecommendation.reasons,
      requiresRecoveryOverride: recoveryRecommendation.requiresConfirmationToOverride,
      recommendedTemplateId: recoveryRecommendation.templateId,
    };
  }

  return {
    state: 'not_started',
    pageTitle: '今天该怎么练',
    recommendationLabel: '今日建议',
    primaryActionLabel: '开始训练',
    secondaryActionLabels: ['查看动作安排'],
    statusText: `建议执行 ${selectedTemplateName}。`,
    currentTrainingName: selectedTemplateName,
    decisionText: `建议今天执行 ${selectedTemplateName}。如果你要采用系统推荐的其他安排，请先切换安排再开始训练。`,
    nextSuggestion: resolvedNextSuggestion,
  };
};

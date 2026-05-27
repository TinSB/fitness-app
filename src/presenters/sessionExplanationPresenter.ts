// Pure presenter: build an ExplanationUserFacing payload from a TrainingSession.
// Replaces buildSessionRecommendationTrace from the deleted
// recommendationExplanationPresenter / recommendationTraceEngine.

import type { TrainingSession } from '../models/training-model';
import type { ExplanationUserFacing, RecommendationFactorView } from '../engines/trainingDecisionTypes';
import { formatTrainingMode } from '../i18n/formatters';

const DEFAULT_FALLBACK = '当前主要依据起始模板和默认处方，系统仍在积累你的训练数据。';

export const buildSessionExplanation = (
  session: Pick<TrainingSession, 'templateId' | 'trainingMode' | 'explanations'>,
): ExplanationUserFacing => {
  const reasons = (session.explanations || []).filter(Boolean);
  const trainingMode = formatTrainingMode(session.trainingMode || 'hybrid');
  const factors: RecommendationFactorView[] = reasons.length
    ? reasons.map((reason, index) => ({
        id: `session-explanation-${index}`,
        label: '本次建议',
        effectLabel: '信息参考',
        effectTone: 'neutral' as const,
        reason,
        priority: 100 - index,
        source: 'defaultPolicy' as const,
        effect: 'informational' as const,
      }))
    : [
        {
          id: 'session-default-explanation',
          label: '默认规则',
          effectLabel: '维持建议',
          effectTone: 'neutral' as const,
          reason: DEFAULT_FALLBACK,
          priority: 1,
          source: 'defaultPolicy' as const,
          effect: 'maintain' as const,
        },
      ];

  return {
    surfaceId: 'explanation',
    headline: '推荐说明',
    oneLineAdvice: `训练侧重：${trainingMode}`,
    title: '为什么这样推荐？',
    summary: reasons[0] || DEFAULT_FALLBACK,
    primaryFactors: factors,
    secondaryFactors: [],
    warnings: [],
  };
};

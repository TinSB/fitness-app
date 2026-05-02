import type {
  E1RMProfile,
  EffectiveVolumeSummary,
  LoadFeedback,
  LoadFeedbackValue,
  PainPattern,
  TrainingSession,
} from '../models/training-model';
import { formatExerciseName, formatMuscleName } from '../i18n/formatters';
import { buildSessionQualityResult, type SessionQualityResult } from './sessionQualityEngine';
import {
  buildRecommendationConfidence,
  type RecommendationConfidenceResult,
} from './recommendationConfidenceEngine';
import { detectExercisePlateau, type PlateauDetectionResult, type PlateauStatus } from './plateauDetectionEngine';
import {
  buildVolumeAdaptationReport,
  type BuildVolumeAdaptationReportParams,
  type MuscleVolumeAdaptation,
  type VolumeAdaptationReport,
} from './volumeAdaptationEngine';
import type { LoadFeedbackSummary } from './loadFeedbackEngine';
import type { AutoTrainingLevel } from './trainingLevelEngine';
import { filterAnalyticsHistory } from './sessionHistoryEngine';
import { hasInvalidExerciseIdentity } from './replacementEngine';

export type TrainingIntelligenceSummary = {
  sessionQuality?: SessionQualityResult;
  recommendationConfidence?: RecommendationConfidenceResult[];
  plateauResults?: PlateauDetectionResult[];
  volumeAdaptation?: VolumeAdaptationReport;
  keyInsights: string[];
  recommendedActions: Array<{
    id: string;
    label: string;
    reason: string;
    actionType:
      | 'review_session'
      | 'review_exercise'
      | 'review_volume'
      | 'create_adjustment_preview'
      | 'keep_observing';
    requiresConfirmation: boolean;
  }>;
};

type LoadFeedbackInput =
  | LoadFeedback[]
  | LoadFeedbackSummary
  | LoadFeedbackSummary[]
  | Record<string, LoadFeedbackSummary | LoadFeedbackValue | undefined>
  | null
  | undefined;

export type BuildTrainingIntelligenceSummaryParams = {
  latestSession?: TrainingSession | null;
  history?: TrainingSession[];
  weeklyVolumeSummary?: BuildVolumeAdaptationReportParams['weeklyVolumeSummary'];
  e1rmProfiles?: E1RMProfile[];
  effectiveSetSummary?: Partial<EffectiveVolumeSummary> | null;
  loadFeedback?: LoadFeedbackInput;
  painPatterns?: PainPattern[] | null;
  trainingLevel?: AutoTrainingLevel | string | null;
};

type Action = TrainingIntelligenceSummary['recommendedActions'][number];

const unique = (items: string[]) => [...new Set(items.filter(Boolean))];

const isNormalSession = (session?: TrainingSession | null) =>
  Boolean(session && session.dataFlag !== 'test' && session.dataFlag !== 'excluded');

const getExerciseIds = (exercise: TrainingSession['exercises'][number]) =>
  hasInvalidExerciseIdentity(exercise)
    ? []
    : [
        exercise.canonicalExerciseId,
        exercise.baseId,
        exercise.actualExerciseId,
        exercise.replacementExerciseId,
        exercise.originalExerciseId,
        exercise.id,
      ]
        .filter(Boolean)
        .map(String);

const exerciseLabelFromHistory = (exerciseId: string, latestSession?: TrainingSession | null, history: TrainingSession[] = []) => {
  const sessions = [latestSession, ...history].filter(Boolean) as TrainingSession[];
  for (const session of sessions) {
    const exercise = (session.exercises || []).find((item) => getExerciseIds(item).includes(exerciseId));
    if (exercise) return formatExerciseName(exercise);
  }
  return formatExerciseName(exerciseId);
};

const selectExerciseIds = (latestSession?: TrainingSession | null, history: TrainingSession[] = [], e1rmProfiles: E1RMProfile[] = []) => {
  const fromLatest = isNormalSession(latestSession)
    ? (latestSession?.exercises || []).flatMap((exercise) => getExerciseIds(exercise).slice(0, 1))
    : [];
  const fromProfiles = e1rmProfiles.map((profile) => profile.exerciseId).filter(Boolean);
  const fromHistory = filterAnalyticsHistory(history)
    .slice(0, 3)
    .flatMap((session) => (session.exercises || []).flatMap((exercise) => getExerciseIds(exercise).slice(0, 1)));

  return unique([...fromLatest, ...fromProfiles, ...fromHistory]).slice(0, 4);
};

const plateauIsImportant = (status: PlateauStatus) =>
  status !== 'none' && status !== 'insufficient_data';

const plateauInsight = (result: PlateauDetectionResult, label: string) => {
  if (result.status === 'plateau') return `${label} 近期进展停滞，建议进入计划调整预览前重点复核。`;
  if (result.status === 'possible_plateau') return `${label} 近期进展放缓，先继续观察并提高完成质量。`;
  if (result.status === 'load_too_aggressive') return `${label} 反馈偏重，下一次不宜急于加重。`;
  if (result.status === 'technique_limited') return `${label} 更受动作质量限制，先稳定动作再推进。`;
  if (result.status === 'fatigue_limited') return `${label} 有疲劳或不适记录，先降低风险再加量。`;
  if (result.status === 'volume_limited') return `${label} 可能受有效训练量不足限制。`;
  return '';
};

const confidenceInsight = (result: RecommendationConfidenceResult, label: string) => {
  if (result.level === 'low') return `${label} 的推荐可信度偏低，建议保守参考。`;
  if (result.level === 'medium') return `${label} 的推荐可信度中等，继续补齐记录会更稳定。`;
  return '';
};

const volumeInsight = (item: MuscleVolumeAdaptation) => {
  const name = item.title.split('：')[0] || formatMuscleName(item.muscleId);
  if (item.decision === 'increase') return `${name} 下周可小幅增加 ${item.setsDelta || 1} 组。`;
  if (item.decision === 'decrease') return `${name} 下周建议减少 ${Math.abs(item.setsDelta || 1)} 组，优先控制疲劳。`;
  if (item.decision === 'hold') return `${name} 暂缓调整，先继续积累稳定记录。`;
  return '';
};

const addAction = (actions: Action[], action: Action) => {
  if (!actions.some((item) => item.id === action.id)) actions.push(action);
};

const buildActions = ({
  sessionQuality,
  plateauResults,
  volumeAdaptation,
  latestSession,
}: {
  sessionQuality?: SessionQualityResult;
  plateauResults: PlateauDetectionResult[];
  volumeAdaptation?: VolumeAdaptationReport;
  latestSession?: TrainingSession | null;
}) => {
  const actions: Action[] = [];

  if (sessionQuality && sessionQuality.level !== 'high' && sessionQuality.level !== 'insufficient_data') {
    addAction(actions, {
      id: 'review-latest-session',
      label: '查看本次训练',
      reason: '最近一次训练质量还有可复核空间，建议先查看完成组、动作质量和不适标记。',
      actionType: 'review_session',
      requiresConfirmation: false,
    });
  }

  const importantPlateau = plateauResults.find((item) => plateauIsImportant(item.status));
  if (importantPlateau) {
    addAction(actions, {
      id: `review-exercise-${importantPlateau.exerciseId}`,
      label: '查看动作进展',
      reason: '有动作出现进展放缓或限制信号，建议先查看该动作历史。',
      actionType: 'review_exercise',
      requiresConfirmation: false,
    });
  }

  const volumeChange = volumeAdaptation?.muscles.find((item) => item.decision === 'increase' || item.decision === 'decrease');
  if (volumeChange) {
    addAction(actions, {
      id: `review-volume-${volumeChange.muscleId}`,
      label: '查看训练量建议',
      reason: '有肌群训练量可能需要小幅调整，先查看原因和建议组数。',
      actionType: 'review_volume',
      requiresConfirmation: false,
    });
    addAction(actions, {
      id: 'create-adjustment-preview',
      label: '生成计划调整预览',
      reason: '仅生成可确认的预览，不会自动修改当前计划。',
      actionType: 'create_adjustment_preview',
      requiresConfirmation: true,
    });
  }

  if (!actions.length) {
    addAction(actions, {
      id: 'keep-observing',
      label: isNormalSession(latestSession) ? '继续观察' : '继续记录训练',
      reason: '当前没有需要立即处理的高优先级信号，继续记录后判断会更稳定。',
      actionType: 'keep_observing',
      requiresConfirmation: false,
    });
  }

  return actions.slice(0, 4);
};

export const buildTrainingIntelligenceSummary = ({
  latestSession,
  history = [],
  weeklyVolumeSummary,
  e1rmProfiles = [],
  effectiveSetSummary,
  loadFeedback,
  painPatterns = [],
  trainingLevel,
}: BuildTrainingIntelligenceSummaryParams): TrainingIntelligenceSummary => {
  const analyticsHistory = filterAnalyticsHistory(history);
  const normalLatestSession = isNormalSession(latestSession) ? latestSession : undefined;
  const exerciseIds = selectExerciseIds(normalLatestSession, analyticsHistory, e1rmProfiles);
  const sessionQuality = normalLatestSession
    ? buildSessionQualityResult({
        session: normalLatestSession,
        effectiveSetSummary,
        loadFeedback,
        painPatterns,
      })
    : undefined;
  const recommendationConfidence = exerciseIds.map((exerciseId) =>
    buildRecommendationConfidence({
      exerciseId,
      history: analyticsHistory,
      e1rmProfile: e1rmProfiles.find((profile) => profile.exerciseId === exerciseId),
      effectiveSetSummary,
      loadFeedback,
      painPatterns,
      trainingLevel,
    }),
  );
  const plateauResults = exerciseIds.map((exerciseId) =>
    detectExercisePlateau({
      exerciseId,
      history: analyticsHistory,
      e1rmProfile: e1rmProfiles.find((profile) => profile.exerciseId === exerciseId),
      effectiveSetSummary,
      loadFeedback,
      painPatterns,
    }),
  );
  const volumeAdaptation = buildVolumeAdaptationReport({
    weeklyVolumeSummary,
    effectiveSetSummary,
    adherenceReport: undefined,
    painPatterns,
    loadFeedback,
    sessionQualityResults: sessionQuality ? [sessionQuality] : [],
    trainingLevel,
  });

  const insightCandidates: string[] = [];

  if (sessionQuality) {
    if (sessionQuality.level === 'high') insightCandidates.push('最近一次训练质量较好，可以作为后续推荐参考。');
    else if (sessionQuality.level === 'medium') insightCandidates.push('最近一次训练质量中等，建议复核动作质量和余力（RIR）记录。');
    else if (sessionQuality.level === 'low') insightCandidates.push('最近一次训练质量偏低，下次建议先保证关键主训练完成度。');
  }

  plateauResults
    .filter((result) => plateauIsImportant(result.status))
    .slice(0, 2)
    .forEach((result) => {
      insightCandidates.push(plateauInsight(result, exerciseLabelFromHistory(result.exerciseId, normalLatestSession, analyticsHistory)));
    });

  volumeAdaptation.muscles
    .filter((item) => item.decision === 'increase' || item.decision === 'decrease' || item.decision === 'hold')
    .slice(0, 2)
    .forEach((item) => insightCandidates.push(volumeInsight(item)));

  recommendationConfidence
    .filter((result) => result.level !== 'high')
    .slice(0, 1)
    .forEach((result, index) => {
      const exerciseId = exerciseIds[index] || '';
      insightCandidates.push(confidenceInsight(result, exerciseLabelFromHistory(exerciseId, normalLatestSession, analyticsHistory)));
    });

  const keyInsights = unique(insightCandidates).filter(Boolean).slice(0, 4);
  const finalInsights = keyInsights.length
    ? keyInsights
    : ['当前训练智能数据还在积累中，继续记录训练、余力（RIR）和动作质量后会更稳定。'];

  return {
    sessionQuality,
    recommendationConfidence,
    plateauResults,
    volumeAdaptation,
    keyInsights: finalInsights,
    recommendedActions: buildActions({
      sessionQuality,
      plateauResults,
      volumeAdaptation,
      latestSession: normalLatestSession,
    }),
  };
};
